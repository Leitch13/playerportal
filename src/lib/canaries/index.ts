/**
 * Canary set — queries that return ZERO rows when the platform is healthy.
 * Any row means something is wrong, and the daily cron emails John before a
 * client phones. See docs: canary_build_spec_v2 (2026-07-11).
 *
 * NON-NEGOTIABLE RULES (from the spec, learned the hard way):
 *  - Never swallow errors. A canary whose query throws reports status
 *    'error', NEVER zero rows. runAllCanaries guarantees this: each canary
 *    body is free to throw; the single wrapper converts throws to 'error'
 *    results. A silently-erroring canary reports healthy while the platform
 *    burns — this exact failure produced a false deletion-crisis this week
 *    (selected `created_at` on enrolments; real column is `enrolled_at`).
 *  - Read-only. These detect. They never modify.
 *  - Schema facts verified live on 2026-07-11: enrolments(enrolled_at,
 *    activates_on, group_id, status), training_groups(term_id),
 *    terms(start_date), subscriptions(current_period_end populated in-DB for
 *    live subs).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

import { isStartDateBillingEnabled, isFutureStartBillingEnabled } from '../billing/flag'

export interface CanaryResult {
  id: number
  name: string
  status: 'ok' | 'fired' | 'error'
  rowCount: number
  /** One human-readable line per finding, e.g. "JAF: Mason Cummings — pending since 2026-06-02". */
  lines: string[]
  /**
   * Structured findings. `lines` stays for the plain-text log; these drive the
   * alert email so it can group by academy, sort oldest-first, show what is NEW
   * since yesterday, and total the money at risk.
   *
   * Sprint 2026-08-31: added after canary 7 correctly reported 21 unbilled
   * children every morning for 15 days and was tuned out, because every email
   * looked identical and none of them said what it was costing.
   */
  findings?: CanaryFinding[]
  error?: string
}

export interface CanaryFinding {
  /** Academy name, for grouping. */
  org: string
  /** What is wrong, WITHOUT the canary's boilerplate suffix. */
  what: string
  /** ISO date the underlying problem started — drives new-vs-ongoing and sorting. */
  since?: string
  /** Best estimate of monthly money at risk, so the email can lead with a number. */
  estPerMonth?: number
}

/** Days between an ISO date and today. Returns null for a missing/unparseable date. */
export function ageInDays(iso?: string): number | null {
  if (!iso) return null
  const then = Date.parse(iso.slice(0, 10))
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.floor((Date.now() - then) / 86400000))
}

/**
 * Fetch every row of a query, paginated past PostgREST's 1000-row default cap.
 * THROWS on any error — callers must not interpret a throw as zero rows.
 * (An unpaginated .select() capped at 1000 silently truncates, which reads as
 * "covered everything" when it didn't — same class of lie as a swallowed error.)
 */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const PAGE = 1000
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * PostgREST sends `.in('col', ids)` as URL query params. Past a few hundred
 * UUIDs the URL blows the server's request-line limit and the whole query
 * dies with an opaque 400 — which is exactly how canary 7 was silently dead
 * once recent-enrolment volume passed ~800 rows (855 ids = 31KB of URL).
 * Every unbounded id-list lookup goes through this instead: batches of 150
 * ids (~5.5KB of URL), results concatenated. Order is not preserved; the
 * callers all build Maps/Sets so they don't care.
 */
const IN_CHUNK = 150
async function fetchAllInChunks<T>(
  ids: string[],
  build: (chunk: string[]) => (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const unique = [...new Set(ids)].filter(Boolean)
  const rows: T[] = []
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    rows.push(...await fetchAll<T>(build(unique.slice(i, i + IN_CHUNK))))
  }
  return rows
}

async function orgNames(sb: Supabase, ids: string[]): Promise<Map<string, string>> {
  const rows = await fetchAllInChunks<{ id: string; name: string }>(ids, (chunk) => (f, t) =>
    sb.from('organisations').select('id, name').in('id', chunk).range(f, t))
  return new Map(rows.map((o) => [o.id, o.name]))
}

async function playerNames(sb: Supabase, ids: string[]): Promise<Map<string, string>> {
  const rows = await fetchAllInChunks<{ id: string; first_name: string; last_name: string | null }>(ids, (chunk) => (f, t) =>
    sb.from('players').select('id, first_name, last_name').in('id', chunk).range(f, t))
  return new Map(rows.map((p) => [p.id, `${p.first_name} ${p.last_name ?? ''}`.trim()]))
}

/**
 * CANARY 1 — Term/billing anchor mismatch (Emma's complaint).
 * A live subscription whose booked class belongs to a term, where the next
 * charge lands in an EARLIER CALENDAR MONTH than the term starts: the parent is
 * billed for a whole month (or more) before the term the class belongs to.
 *
 * Deliberately month-granular, not day: billing at the START of the month a
 * term begins in is a legitimate, business-intended model (confirmed 2026-07-23
 * for G&G — charge 1 Aug for a term starting 17 Aug is correct; the business
 * needs the 1st-of-month revenue). Only an earlier *month* is a real mismatch.
 */
async function canary1TermAnchorMismatch(sb: Supabase): Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> {
  const groups = await fetchAll<{ id: string; name: string; term_id: string }>((f, t) =>
    sb.from('training_groups').select('id, name, term_id').not('term_id', 'is', null).range(f, t))
  if (!groups.length) return { rowCount: 0, lines: [] }

  const terms = await fetchAll<{ id: string; name: string; start_date: string }>((f, t) =>
    sb.from('terms').select('id, name, start_date').range(f, t))
  const termById = new Map(terms.map((tm) => [tm.id, tm]))
  const groupById = new Map(groups.map((g) => [g.id, g]))

  const enrols = await fetchAllInChunks<{ player_id: string; group_id: string; organisation_id: string }>(
    groups.map((g) => g.id),
    (chunk) => (f, t) => sb.from('enrolments')
      .select('player_id, group_id, organisation_id')
      .in('group_id', chunk)
      .in('status', ['pending', 'active'])
      .range(f, t))
  if (!enrols.length) return { rowCount: 0, lines: [] }

  const subs = await fetchAll<{ id: string; player_id: string | null; organisation_id: string; status: string; current_period_end: string | null }>((f, t) =>
    sb.from('subscriptions')
      .select('id, player_id, organisation_id, status, current_period_end')
      .in('status', ['trialing', 'active'])
      .not('player_id', 'is', null)
      .not('current_period_end', 'is', null)
      .range(f, t))

  const enrolsByPlayer = new Map<string, typeof enrols>()
  for (const e of enrols) {
    const list = enrolsByPlayer.get(e.player_id) ?? []
    list.push(e)
    enrolsByPlayer.set(e.player_id, list)
  }

  const findings: { orgId: string; playerId: string; anchor: string; termName: string; termStart: string }[] = []
  const seen = new Set<string>()
  for (const s of subs) {
    const anchor = (s.current_period_end as string).slice(0, 10)
    for (const e of enrolsByPlayer.get(s.player_id as string) ?? []) {
      const term = termById.get(groupById.get(e.group_id)?.term_id ?? '')
      if (!term) continue
      // Compare year-month, not full date: billing at the start of the term's
      // month is intended (see canary header). Only an EARLIER month is a bug.
      if (anchor.slice(0, 7) < term.start_date.slice(0, 7)) {
        const key = `${s.id}:${term.id}`
        if (seen.has(key)) continue
        seen.add(key)
        findings.push({ orgId: s.organisation_id, playerId: s.player_id as string, anchor, termName: term.name, termStart: term.start_date })
      }
    }
  }

  const orgs = await orgNames(sb, findings.map((x) => x.orgId))
  const players = await playerNames(sb, findings.map((x) => x.playerId))
  return {
    rowCount: findings.length,
    lines: findings.map((x) =>
      `${orgs.get(x.orgId) ?? x.orgId}: ${players.get(x.playerId) ?? x.playerId} — next charge ${x.anchor} but term "${x.termName}" starts ${x.termStart}`),
  }
}

/**
 * CANARY 2 — Stuck-pending enrolments (Harris/Mylo/Jayden/Mason).
 * Enrolment still 'pending' although its activates_on has passed. The parent
 * may be paying while the child is invisible on every roster surface (they
 * all filter status='active').
 */
async function canary2StuckPending(sb: Supabase): Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> {
  const rows = await fetchAll<{ id: string; player_id: string; organisation_id: string; activates_on: string; enrolled_at: string }>((f, t) =>
    sb.from('enrolments')
      .select('id, player_id, organisation_id, activates_on, enrolled_at')
      .eq('status', 'pending')
      .not('activates_on', 'is', null)
      .lte('activates_on', todayIso())
      .range(f, t))
  const orgs = await orgNames(sb, rows.map((r) => r.organisation_id))
  const players = await playerNames(sb, rows.map((r) => r.player_id))
  return {
    rowCount: rows.length,
    lines: rows.map((r) =>
      `${orgs.get(r.organisation_id) ?? r.organisation_id}: ${players.get(r.player_id) ?? r.player_id} — pending since ${r.enrolled_at?.slice(0, 10)}, should have activated ${r.activates_on}`),
  }
}

/**
 * CANARY 3 — Paying but not enrolled.
 * Active/trialing subscription with NO enrolment row at all for the player:
 * a paid child on no register. Downstream symptom of the cross-academy
 * routing bug. Verified 0 of ~76 on 2026-07-11 — watches for regression.
 */
async function canary3PayingNotEnrolled(sb: Supabase): Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> {
  const subs = await fetchAll<{ id: string; player_id: string | null; organisation_id: string; status: string; created_at: string }>((f, t) =>
    sb.from('subscriptions')
      .select('id, player_id, organisation_id, status, created_at')
      .in('status', ['active', 'trialing'])
      .not('player_id', 'is', null)
      .range(f, t))
  const enrols = await fetchAll<{ player_id: string }>((f, t) =>
    sb.from('enrolments').select('player_id').range(f, t))
  const enrolled = new Set(enrols.map((e) => e.player_id))
  const orphans = subs.filter((s) => !enrolled.has(s.player_id as string))
  const orgs = await orgNames(sb, orphans.map((s) => s.organisation_id))
  const players = await playerNames(sb, orphans.map((s) => s.player_id as string))
  return {
    rowCount: orphans.length,
    lines: orphans.map((s) =>
      `${orgs.get(s.organisation_id) ?? s.organisation_id}: ${players.get(s.player_id as string) ?? s.player_id} — sub ${s.status} since ${s.created_at?.slice(0, 10)}, no enrolment row`),
  }
}

/**
 * CANARY 4 — Cross-academy attribution (the bug 9b694e9 fixed).
 * A subscription whose organisation differs from the organisation of the
 * class actually booked (via the player's enrolments). Non-zero means money
 * and membership have diverged across academies — highest severity here.
 */
async function canary4CrossAcademy(sb: Supabase): Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> {
  const subs = await fetchAll<{ id: string; player_id: string | null; organisation_id: string }>((f, t) =>
    sb.from('subscriptions')
      .select('id, player_id, organisation_id')
      .in('status', ['active', 'trialing', 'scheduled'])
      .not('player_id', 'is', null)
      .range(f, t))
  if (!subs.length) return { rowCount: 0, lines: [] }
  const enrols = await fetchAllInChunks<{ player_id: string; group_id: string }>(
    subs.map((s) => s.player_id as string),
    (chunk) => (f, t) => sb.from('enrolments').select('player_id, group_id').in('player_id', chunk).range(f, t))
  const groups = await fetchAll<{ id: string; name: string; organisation_id: string }>((f, t) =>
    sb.from('training_groups').select('id, name, organisation_id').range(f, t))
  const groupById = new Map(groups.map((g) => [g.id, g]))

  const findings: { subOrg: string; classOrg: string; playerId: string; className: string }[] = []
  for (const s of subs) {
    for (const e of enrols.filter((x) => x.player_id === s.player_id)) {
      const g = groupById.get(e.group_id)
      if (g && g.organisation_id !== s.organisation_id) {
        findings.push({ subOrg: s.organisation_id, classOrg: g.organisation_id, playerId: s.player_id as string, className: g.name })
      }
    }
  }
  const orgs = await orgNames(sb, findings.flatMap((x) => [x.subOrg, x.classOrg]))
  const players = await playerNames(sb, findings.map((x) => x.playerId))
  return {
    rowCount: findings.length,
    lines: findings.map((x) =>
      `${players.get(x.playerId) ?? x.playerId}: subscription billed to ${orgs.get(x.subOrg) ?? x.subOrg} but enrolled in "${x.className}" at ${orgs.get(x.classOrg) ?? x.classOrg}`),
  }
}

/**
 * CANARY 5 — Billing flag coherence. Not SQL: an assertion over the four env
 * flags, using the REAL production gate functions from billing/flag.ts so the
 * canary can never drift from the code it guards.
 *
 * Invariant: any org that can SEE the future-start picker
 * (isFutureStartBillingEnabled) must be an org whose billing route will
 * HONOUR it (route dispatch requires isStartDateBillingEnabled AND
 * isFutureStartBillingEnabled). Picker-on + route-legacy is exactly the
 * mismatch that mischarged three JAF families in June.
 */
export function canary5FlagCoherence(): CanaryResult {
  const base = { id: 5, name: 'flag coherence' }
  try {
    const futList = (process.env.BILLING_FUTURE_START_ENABLED || '').trim()
    // '*' means every org sees the picker — a sentinel org id (not in any
    // allowlist) then correctly requires BILLING_FLOW_STARTDATE_ENABLED='*'.
    const SENTINEL = '00000000-0000-0000-0000-000000000000'
    const candidates = futList === '*' ? [SENTINEL] : futList.split(',').map((s) => s.trim()).filter(Boolean)
    const incoherent = candidates.filter(
      (org) => isFutureStartBillingEnabled(org) && !isStartDateBillingEnabled(org))
    return {
      ...base,
      status: incoherent.length ? 'fired' : 'ok',
      rowCount: incoherent.length,
      lines: incoherent.map((org) =>
        `INCOHERENT — org ${org === SENTINEL ? '* (all orgs)' : org} sees the future-start picker but the billing route will charge it as start-today`),
    }
  } catch (err) {
    return { ...base, status: 'error', rowCount: 0, lines: [], error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * CANARY 6 — Duplicate camp day booking (Jamie's "the duplicates are back").
 * The same child (camp + child name + parent email) holding the SAME camp day
 * on two live bookings. One seat, counted twice on the register.
 *
 * Fired for real on 2026-07-13: a double-submit put one child on the same four
 * charity-camp days twice. The checkout now blocks re-booking a held day
 * (5054c06), so this canary covers the other way it can happen — rows arriving
 * by any path that isn't the guarded checkout (manual insert, restore, import).
 *
 * Deliberately day-level, not booking-level: a parent legitimately returning to
 * book EXTRA days creates a second booking, and that is not a duplicate. Only an
 * overlapping day is. Whole-camp bookings have no camp_booking_days rows and so
 * are out of scope here by construction.
 */
async function canary6DuplicateCampDay(sb: Supabase): Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> {
  const bookings = await fetchAll<{
    id: string; camp_id: string; organisation_id: string
    child_name: string | null; parent_email: string | null; payment_status: string
  }>((f, t) =>
    sb.from('camp_bookings')
      .select('id, camp_id, organisation_id, child_name, parent_email, payment_status')
      .in('payment_status', ['pending', 'paid'])
      .range(f, t))
  if (!bookings.length) return { rowCount: 0, lines: [] }

  const days = await fetchAll<{ camp_booking_id: string; camp_day_id: string }>((f, t) =>
    sb.from('camp_booking_days').select('camp_booking_id, camp_day_id').range(f, t))
  if (!days.length) return { rowCount: 0, lines: [] }

  const bookingById = new Map(bookings.map((b) => [b.id, b]))
  const daysByBooking = new Map<string, string[]>()
  for (const d of days) {
    if (!bookingById.has(d.camp_booking_id)) continue // skip cancelled/refunded parents
    const list = daysByBooking.get(d.camp_booking_id) ?? []
    list.push(d.camp_day_id)
    daysByBooking.set(d.camp_booking_id, list)
  }

  // key = camp + child + parent + day → any key held by >1 booking is a dup
  const holders = new Map<string, string[]>()
  for (const [bookingId, dayIds] of daysByBooking) {
    const b = bookingById.get(bookingId)!
    const who = `${b.camp_id}|${(b.child_name ?? '').trim().toLowerCase()}|${(b.parent_email ?? '').trim().toLowerCase()}`
    for (const dayId of dayIds) {
      const key = `${who}|${dayId}`
      const list = holders.get(key) ?? []
      list.push(bookingId)
      holders.set(key, list)
    }
  }
  const dupes = [...holders.entries()].filter(([, ids]) => ids.length > 1)
  if (!dupes.length) return { rowCount: 0, lines: [] }

  const dayIds = dupes.map(([k]) => k.split('|')[3])
  const dayRows = await fetchAllInChunks<{ id: string; date: string }>(
    dayIds,
    (chunk) => (f, t) => sb.from('camp_days').select('id, date').in('id', chunk).range(f, t))
  const dayDate = new Map(dayRows.map((d) => [d.id, d.date]))
  const campRows = await fetchAll<{ id: string; name: string }>((f, t) =>
    sb.from('camps').select('id, name').in('id', [...new Set(dupes.map(([k]) => k.split('|')[0]))]).range(f, t))
  const campName = new Map(campRows.map((c) => [c.id, c.name]))
  const orgs = await orgNames(sb, dupes.map(([, ids]) => bookingById.get(ids[0])!.organisation_id))

  return {
    rowCount: dupes.length,
    lines: dupes.map(([key, ids]) => {
      const [campId, child, , dayId] = key.split('|')
      const b = bookingById.get(ids[0])!
      return `${orgs.get(b.organisation_id) ?? b.organisation_id}: ${child} booked ${dayDate.get(dayId) ?? dayId} on "${campName.get(campId) ?? campId}" ${ids.length}× — bookings ${ids.join(', ')}`
    }),
  }
}

/**
 * CANARY 7 — Enrolled without paying (paywall-bypass regression guard).
 * A recent `active` enrolment whose parent has NO subscription — of ANY of
 * 'active' / 'trialing' / 'pending_migration' — in that org. That is the exact
 * signature of the paywall bug: a self-serve parent enrolling a child into a
 * class with no subscription behind it.
 *
 * History: migration 058 added the DB paywall; the 077b cross-tenant lockdown
 * silently dropped it; it stayed open ~7 weeks and a stranger enrolled a dummy
 * child into 40 classes at G&G before it was caught by hand. Migration 100
 * restored the paywall — this canary is the guard so it can't silently rot a
 * FOURTH time: if the check ever comes off again, junk enrolments reappear and
 * this fires the next morning.
 *
 * Scoped to enrolments in the last 14 days to catch live exploitation without
 * flagging legacy rows. Excludes `pending_migration` members (imported, they
 * hold a pending_migration sub) and PILOT/demo orgs (seeded with players and no
 * real subscriptions — noise, not a bypass). A staff-comped player with no sub
 * at a real academy could still show up — that's a fair thing to surface too.
 */
async function canary7EnrolledNotPaying(sb: Supabase): Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> {
  // NO date cutoff. This used to look back only 14 days, which meant a child
  // enrolled-but-unbilled for three weeks silently DROPPED OFF the report —
  // exactly backwards, since the longer it runs the more it costs. 19 of
  // Jamie's children aged out this way between 24 and 31 Aug 2026.
  const enrols = await fetchAll<{ id: string; player_id: string; organisation_id: string; enrolled_at: string }>((f, t) =>
    sb.from('enrolments')
      .select('id, player_id, organisation_id, enrolled_at')
      .eq('status', 'active')
      .range(f, t))
  if (!enrols.length) return { rowCount: 0, lines: [] }

  // Exclude pilot/demo orgs — they carry seeded no-sub enrolments by design.
  const pilots = await fetchAll<{ id: string }>((f, t) =>
    sb.from('organisations').select('id').eq('pilot', true).range(f, t))
  const pilotOrgs = new Set(pilots.map((o) => o.id))

  // player → parent
  const players = await fetchAllInChunks<{ id: string; parent_id: string | null }>(
    enrols.map((e) => e.player_id),
    (chunk) => (f, t) => sb.from('players').select('id, parent_id').in('id', chunk).range(f, t))
  const parentOf = new Map(players.map((p) => [p.id, p.parent_id]))

  // every (parent|org) pair that holds an acceptable subscription
  const subs = await fetchAll<{ parent_id: string; organisation_id: string }>((f, t) =>
    sb.from('subscriptions')
      .select('parent_id, organisation_id')
      .in('status', ['active', 'trialing', 'pending_migration'])
      .range(f, t))
  const paid = new Set(subs.map((s) => `${s.parent_id}|${s.organisation_id}`))

  const offenders = enrols.filter((e) => {
    if (pilotOrgs.has(e.organisation_id)) return false // demo/pilot noise
    const parent = parentOf.get(e.player_id)
    if (!parent) return false // no parent (admin/legacy) — not the self-serve signature
    return !paid.has(`${parent}|${e.organisation_id}`)
  })
  if (!offenders.length) return { rowCount: 0, lines: [] }

  const orgs = await orgNames(sb, offenders.map((e) => e.organisation_id))
  const names = await playerNames(sb, offenders.map((e) => e.player_id))
  const rate = await typicalPlanPrice(sb, [...new Set(offenders.map((e) => e.organisation_id))])
  return {
    rowCount: offenders.length,
    lines: offenders.map((e) =>
      `${orgs.get(e.organisation_id) ?? e.organisation_id}: ${names.get(e.player_id) ?? e.player_id} — enrolled ${e.enrolled_at?.slice(0, 10)} with NO active/trialing/pending subscription (paywall bypass?)`),
    findings: offenders.map((e) => ({
      org: orgs.get(e.organisation_id) ?? e.organisation_id,
      what: `${names.get(e.player_id) ?? e.player_id} is in a class with no payment set up`,
      since: e.enrolled_at?.slice(0, 10),
      estPerMonth: rate.get(e.organisation_id),
    })),
  }
}

/**
 * Median active plan price per org — used to put a rough £ on findings like
 * "enrolled but not paying". Rough on purpose: it is there to make the alert
 * impossible to ignore, not to be an invoice.
 */
async function typicalPlanPrice(sb: Supabase, orgIds: string[]): Promise<Map<string, number | undefined>> {
  const out = new Map<string, number | undefined>()
  if (!orgIds.length) return out
  const plans = await fetchAllInChunks<{ organisation_id: string; amount: number | string }>(
    orgIds,
    (chunk) => (f, t) => sb.from('subscription_plans').select('organisation_id, amount').eq('active', true).in('organisation_id', chunk).range(f, t))
  const byOrg = new Map<string, number[]>()
  for (const p of plans) {
    const n = Number(p.amount)
    if (!Number.isFinite(n) || n <= 0) continue
    const arr = byOrg.get(p.organisation_id) ?? []
    arr.push(n)
    byOrg.set(p.organisation_id, arr)
  }
  for (const id of orgIds) {
    const arr = (byOrg.get(id) ?? []).sort((a, b) => a - b)
    out.set(id, arr.length ? arr[Math.floor(arr.length / 2)] : undefined)
  }
  return out
}

/**
 * CANARY 8 — Live subscription not linked to a child.
 *
 * The academy is taking money but the app cannot say who for. Breaks every
 * per-child view and hides duplicates (Luca Wishart, 31 Aug 2026: the class
 * sat on one record and the payment on another, so the parent could not pay
 * at all). 39 such rows existed platform-wide when this was written.
 */
async function canary8SubWithoutPlayer(sb: Supabase): Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> {
  const subs = await fetchAll<{ id: string; organisation_id: string; parent_id: string | null; created_at: string }>((f, t) =>
    sb.from('subscriptions')
      .select('id, organisation_id, parent_id, created_at')
      .in('status', ['active', 'trialing'])
      .is('player_id', null)
      .range(f, t))
  if (!subs.length) return { rowCount: 0, lines: [], findings: [] }
  const orgs = await orgNames(sb, subs.map((s) => s.organisation_id))
  const parents = await fetchAllInChunks<{ id: string; full_name: string | null }>(
    subs.map((s) => s.parent_id).filter((x): x is string => !!x),
    (chunk) => (f, t) => sb.from('profiles').select('id, full_name').in('id', chunk).range(f, t))
  const nameOf = new Map(parents.map((p) => [p.id, p.full_name]))
  return {
    rowCount: subs.length,
    lines: subs.map((s) =>
      `${orgs.get(s.organisation_id) ?? s.organisation_id}: ${nameOf.get(s.parent_id ?? '') ?? 'unknown parent'} — live subscription with no child attached`),
    findings: subs.map((s) => ({
      org: orgs.get(s.organisation_id) ?? s.organisation_id,
      what: `${nameOf.get(s.parent_id ?? '') ?? 'unknown parent'} is paying, but the payment is not linked to a child`,
      since: s.created_at?.slice(0, 10),
    })),
  }
}

/**
 * CANARY 9 — Duplicate player records.
 *
 * Same academy, same name, same date of birth, both unarchived. This is how a
 * family ends up billed twice (Jill Marsters, 31 Aug 2026: £192 x2 for one boy
 * across two accounts differing by a single full stop) or not at all.
 */
async function canary9DuplicatePlayers(sb: Supabase): Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> {
  const players = await fetchAll<{ id: string; organisation_id: string; first_name: string | null; last_name: string | null; date_of_birth: string | null; created_at: string }>((f, t) =>
    sb.from('players')
      .select('id, organisation_id, first_name, last_name, date_of_birth, created_at')
      .is('archived_at', null)
      .range(f, t))
  const groups = new Map<string, typeof players>()
  for (const p of players) {
    const key = [p.organisation_id, (p.first_name ?? '').trim().toLowerCase(), (p.last_name ?? '').trim().toLowerCase(), p.date_of_birth ?? ''].join('|')
    if (!p.first_name && !p.last_name) continue
    const arr = groups.get(key) ?? []
    arr.push(p)
    groups.set(key, arr)
  }
  const dupes = [...groups.values()].filter((g) => g.length > 1)
  if (!dupes.length) return { rowCount: 0, lines: [], findings: [] }
  const orgs = await orgNames(sb, dupes.map((g) => g[0].organisation_id))
  return {
    rowCount: dupes.length,
    lines: dupes.map((g) =>
      `${orgs.get(g[0].organisation_id) ?? g[0].organisation_id}: ${g[0].first_name} ${g[0].last_name} — ${g.length} duplicate records (same DOB)`),
    findings: dupes.map((g) => ({
      org: orgs.get(g[0].organisation_id) ?? g[0].organisation_id,
      what: `${(g[0].first_name ?? '').trim()} ${(g[0].last_name ?? '').trim()} has ${g.length} records with the same date of birth — risk of double billing`,
      since: g.map((x) => x.created_at).sort()[0]?.slice(0, 10),
    })),
  }
}

/**
 * CANARY 10 — A membership that started and collected nothing.
 *
 * Nothing anywhere checked that a completed signup actually took money.
 *
 * Between 1 August and 2 September 2026, 26 Gold & Gray families joined
 * mid-month and were charged £0 for the rest of that month — roughly £1,146 —
 * because their academy was not on the list that routes to prorated billing.
 * Every other signal looked healthy: the parent had a card saved, the
 * subscription was active, the money arrived on the 1st exactly as expected.
 * It went unnoticed for a month, and was found only because one parent thought
 * a £0.00 checkout page meant the booking had failed.
 *
 * So: a live subscription, more than a day old, that has never had a single
 * successful charge OR an explicit trial. £0 is legitimate when a parent joins
 * after the last session of the month — this fires on £0 with no reason for it.
 *
 * Deliberately not scoped to one academy or one billing path. The failure was
 * a per-academy setting nobody knew was wrong, so a check that needs the same
 * setting to be right would have been just as blind.
 */
async function canary10ZeroValueSignup(sb: Supabase): Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> {
  const dayAgo = new Date(Date.now() - 36 * 3600 * 1000).toISOString()
  const subs = await fetchAll<{
    id: string; organisation_id: string; parent_id: string | null
    plan_id: string | null; created_at: string; status: string
  }>((f, t) =>
    sb.from('subscriptions')
      .select('id, organisation_id, parent_id, plan_id, created_at, status')
      .in('status', ['active', 'trialing', 'past_due'])
      .lt('created_at', dayAgo)
      .range(f, t))
  if (!subs.length) return { rowCount: 0, lines: [], findings: [] }

  // Anything this parent has ever actually paid, at this academy.
  const payments = await fetchAllInChunks<{ parent_id: string; amount: number | null; status: string | null }>(
    [...new Set(subs.map((s) => s.parent_id).filter((x): x is string => !!x))],
    (chunk) => (f, t) => sb.from('payments').select('parent_id, amount, status').in('parent_id', chunk).range(f, t))
  const everPaid = new Set(
    payments.filter((p) => (Number(p.amount) || 0) > 0 && p.status !== 'failed').map((p) => p.parent_id),
  )

  const suspect = subs.filter((s) => s.parent_id && !everPaid.has(s.parent_id))
  if (!suspect.length) return { rowCount: 0, lines: [], findings: [] }

  const orgs = await orgNames(sb, suspect.map((s) => s.organisation_id))
  const parents = await fetchAllInChunks<{ id: string; full_name: string | null }>(
    suspect.map((s) => s.parent_id).filter((x): x is string => !!x),
    (chunk) => (f, t) => sb.from('profiles').select('id, full_name').in('id', chunk).range(f, t))
  const nameOf = new Map(parents.map((p) => [p.id, p.full_name]))
  const plans = await fetchAllInChunks<{ id: string; name: string | null; amount: number | null }>(
    suspect.map((s) => s.plan_id).filter((x): x is string => !!x),
    (chunk) => (f, t) => sb.from('subscription_plans').select('id, name, amount').in('id', chunk).range(f, t))
  const planOf = new Map(plans.map((p) => [p.id, p]))

  return {
    rowCount: suspect.length,
    lines: suspect.map((s) => {
      const plan = planOf.get(s.plan_id ?? '')
      return `${orgs.get(s.organisation_id) ?? s.organisation_id}: ${nameOf.get(s.parent_id ?? '') ?? 'unknown parent'} — ` +
        `signed up ${s.created_at?.slice(0, 10)} on ${plan?.name ?? 'a plan'} (£${Number(plan?.amount ?? 0).toFixed(2)}/mo) ` +
        `and has never been charged anything`
    }),
    findings: suspect.map((s) => {
      const plan = planOf.get(s.plan_id ?? '')
      return {
        org: orgs.get(s.organisation_id) ?? s.organisation_id,
        what: `${nameOf.get(s.parent_id ?? '') ?? 'A family'} joined on ${plan?.name ?? 'a plan'} and no money has ever been collected`,
        since: s.created_at?.slice(0, 10),
        estPerMonth: Number(plan?.amount ?? 0),
      }
    }),
  }
}

/**
 * CANARY 11 — Archived players still being counted, or still live.
 *
 * Two checks in one, because they fail in opposite directions.
 *
 * FIRST: the gap between players and players_active per academy. Archiving
 * works — the cascade cancels enrolments and subscriptions correctly — but on
 * 2026-09-03 five surfaces read the raw table and counted archived children
 * anyway. Gold and Gray showed 236 players where 177 were live, a 33%
 * overcount on the academy's headline figure, and the owner had spent a week
 * reconciling against it. Migration 109 added the view and moved those reads.
 *
 * A view cannot stop a future query using the raw table. This is what does:
 * the gap is reported every morning, so the sixth call site nobody converted
 * shows up as a number rather than in someone's reconciliation.
 *
 * SECOND: no archived player should hold a live subscription or an active
 * enrolment. That figure is currently ZERO across all 66 archived players and
 * must stay zero — anything else means the cascade in archive_player_safe
 * failed and a family is being charged for a child the academy has removed.
 *
 * The first check is informational and expected to be non-zero. The second
 * fires.
 */
async function canary11ArchivedStillCounted(sb: Supabase): Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> {
  const players = await fetchAll<{ id: string; organisation_id: string; archived_at: string | null }>((f, t) =>
    sb.from('players').select('id, organisation_id, archived_at').range(f, t))
  const archived = players.filter((p) => p.archived_at)
  if (!archived.length) return { rowCount: 0, lines: [], findings: [] }

  const archivedIds = new Set(archived.map((p) => p.id))
  const orgs = await orgNames(sb, archived.map((p) => p.organisation_id))

  // The gap, per academy — informational.
  const gap = new Map<string, { total: number; archived: number }>()
  for (const p of players) {
    const g = gap.get(p.organisation_id) ?? { total: 0, archived: 0 }
    g.total += 1
    if (p.archived_at) g.archived += 1
    gap.set(p.organisation_id, g)
  }

  // The part that fires: archived AND still live somewhere.
  const subs = await fetchAll<{ player_id: string | null; organisation_id: string; status: string }>((f, t) =>
    sb.from('subscriptions').select('player_id, organisation_id, status')
      .in('status', ['active', 'trialing', 'past_due']).range(f, t))
  const enrols = await fetchAll<{ player_id: string | null; organisation_id: string; status: string }>((f, t) =>
    sb.from('enrolments').select('player_id, organisation_id, status').eq('status', 'active').range(f, t))

  const stillPaying = subs.filter((s) => s.player_id && archivedIds.has(s.player_id))
  const stillEnrolled = enrols.filter((e) => e.player_id && archivedIds.has(e.player_id))
  const bad = [...stillPaying, ...stillEnrolled]

  const lines = [
    ...[...gap.entries()]
      .filter(([, g]) => g.archived > 0)
      .map(([org, g]) =>
        `${orgs.get(org) ?? org}: ${g.archived} archived of ${g.total} — any screen reading the players table shows ${g.total} where ${g.total - g.archived} are live`),
    ...stillPaying.map((s) =>
      `${orgs.get(s.organisation_id) ?? s.organisation_id}: ARCHIVED player ${s.player_id} still has a ${s.status} subscription`),
    ...stillEnrolled.map((e) =>
      `${orgs.get(e.organisation_id) ?? e.organisation_id}: ARCHIVED player ${e.player_id} is still in an active class`),
  ]

  return {
    // Only the genuinely wrong rows fire. The gap is reported, not alarmed.
    rowCount: bad.length,
    lines,
    findings: bad.map((b) => ({
      org: orgs.get(b.organisation_id) ?? b.organisation_id,
      what: `A player who has been archived is still ${'status' in b && ['active', 'trialing', 'past_due'].includes(b.status) ? 'being charged' : 'in an active class'}`,
    })),
  }
}

const TIER1: { id: number; name: string; run: (sb: Supabase) => Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> }[] = [
  { id: 1, name: 'term/billing anchor mismatch', run: canary1TermAnchorMismatch },
  { id: 2, name: 'stuck-pending enrolments', run: canary2StuckPending },
  { id: 3, name: 'paying but not enrolled', run: canary3PayingNotEnrolled },
  { id: 4, name: 'cross-academy attribution', run: canary4CrossAcademy },
  { id: 6, name: 'duplicate camp day booking', run: canary6DuplicateCampDay },
  { id: 7, name: 'enrolled without paying', run: canary7EnrolledNotPaying },
  { id: 8, name: 'payment not linked to a child', run: canary8SubWithoutPlayer },
  { id: 9, name: 'duplicate player records', run: canary9DuplicatePlayers },
  { id: 10, name: 'signed up but never charged', run: canary10ZeroValueSignup },
  { id: 11, name: 'archived players still counted or still live', run: canary11ArchivedStillCounted },
]

/**
 * Run every canary. NEVER throws for a canary failure: a canary whose query
 * errors comes back as status 'error' with the message, so the cron can email
 * "CANARY N: ERROR — ..." instead of pretending zero rows.
 */
export async function runAllCanaries(sb: Supabase): Promise<CanaryResult[]> {
  const results: CanaryResult[] = []
  for (const c of TIER1) {
    try {
      const r = await c.run(sb)
      results.push({ id: c.id, name: c.name, status: r.rowCount > 0 ? 'fired' : 'ok', ...r })
    } catch (err) {
      results.push({
        id: c.id, name: c.name, status: 'error', rowCount: 0, lines: [],
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  results.push(canary5FlagCoherence())
  return results
}

/** One line per canary in the spec's alert format. */
export function formatCanaryLine(r: CanaryResult): string {
  if (r.status === 'error') return `CANARY ${r.id} (${r.name}): ERROR — ${r.error}`
  if (r.status === 'fired') {
    const detail = r.lines.length ? ` — ${r.lines.join('; ')}` : ''
    return `CANARY ${r.id} (${r.name}): ${r.rowCount} row${r.rowCount === 1 ? '' : 's'}${detail}`
  }
  return `CANARY ${r.id} (${r.name}): 0 rows — healthy`
}

/** What to DO about each canary — the alert was unusable without this. */
const CANARY_ACTION: Record<number, string> = {
  1: 'Check the class start date against the term it belongs to.',
  2: 'These enrolments never activated — activate them or cancel them.',
  3: 'A family is paying with nothing to attend. Enrol them or refund.',
  4: 'A class is attributed to the wrong academy. Fix before it bills.',
  5: 'Billing feature flags disagree with each other. Do not deploy until resolved.',
  6: 'A camp day is booked twice for the same child. Refund one.',
  7: 'Ask the academy whether these children should be paying, then send payment invites.',
  8: 'Attach the payment to the right child, or the academy cannot see who it is for.',
  9: 'Merge the duplicates and archive the spare, before a family gets billed twice.',
}

function bucket(days: number | null): 'new' | 'recent' | 'ongoing' | 'stale' {
  if (days === null) return 'ongoing'
  if (days <= 1) return 'new'
  if (days <= 6) return 'recent'
  if (days <= 27) return 'ongoing'
  return 'stale'
}

/**
 * Build the alert email.
 *
 * Written 2026-08-31 to replace a version that sent an identical wall of text
 * every morning for 15 days. It reported 21 unbilled children, Mason Cummings
 * stuck since June and Luca Wishart's split record — all correct, all ignored,
 * because nothing distinguished day 15 from day 1 and nothing said what it cost.
 *
 * Rules: lead with money; say what is NEW; sort oldest-first because age is
 * cost; never bury a finding in boilerplate; always say what to do.
 */
export function buildAlertEmail(results: CanaryResult[]): { subject: string; html: string } {
  const firing = results.filter((r) => r.status !== 'ok')
  const all = firing.flatMap((r) => (r.findings ?? []).map((f) => ({ ...f, canary: r })))
  const money = all.reduce((sum, f) => sum + (f.estPerMonth ?? 0), 0)
  const newest = all.filter((f) => bucket(ageInDays(f.since)) === 'new').length
  const errors = results.filter((r) => r.status === 'error')

  if (!firing.length) {
    return {
      subject: '✅ Canary heartbeat: all clear',
      html: `<div style="font-family:-apple-system,sans-serif;max-width:640px"><h2>All clear</h2>
        <p style="color:#555">Every canary ran and returned zero rows. This email exists so a dead alarm cannot be mistaken for a healthy platform.</p>
        <p style="color:#999;font-size:12px">${new Date().toISOString()} — /api/cron/canaries</p></div>`,
    }
  }

  const parts: string[] = []
  const headline = money > 0
    ? `£${money.toLocaleString('en-GB', { maximumFractionDigits: 0 })}/mo at risk`
    : `${all.length || firing.reduce((n, r) => n + r.rowCount, 0)} to look at`
  const subject = errors.length
    ? `⚠️ Canary: ${errors.length} CHECK BROKEN — ${headline}`
    : `Canary: ${headline}${newest ? ` — ${newest} new today` : ' — nothing new'}`

  parts.push(`<div style="font-family:-apple-system,sans-serif;max-width:680px;color:#111">`)
  parts.push(`<div style="background:#0a0a0a;color:#fff;padding:18px 20px;border-radius:10px;margin-bottom:18px">
    <div style="font-size:26px;font-weight:800">${headline}</div>
    <div style="color:#9ca3af;font-size:13px;margin-top:4px">${newest} new since yesterday · ${all.length - newest} continuing${errors.length ? ` · ${errors.length} check(s) BROKEN` : ''}</div>
  </div>`)

  if (errors.length) {
    parts.push(`<div style="border:2px solid #dc2626;border-radius:8px;padding:12px 14px;margin-bottom:16px">
      <b style="color:#dc2626">A check itself is failing — it is reporting nothing, not zero.</b>
      <ul style="margin:8px 0 0;padding-left:18px">${errors.map((e) => `<li>${e.name}: ${e.error}</li>`).join('')}</ul></div>`)
  }

  for (const r of firing.filter((x) => x.status === 'fired')) {
    const fs = (r.findings ?? []).slice().sort((a, b) => (ageInDays(b.since) ?? 0) - (ageInDays(a.since) ?? 0))
    const sum = fs.reduce((s, f) => s + (f.estPerMonth ?? 0), 0)
    parts.push(`<h3 style="margin:20px 0 2px;font-size:15px">${r.name} — ${r.rowCount}${sum ? ` · ~£${sum.toLocaleString('en-GB', { maximumFractionDigits: 0 })}/mo` : ''}</h3>`)
    parts.push(`<p style="margin:0 0 10px;color:#6b7280;font-size:13px">${CANARY_ACTION[r.id] ?? ''}</p>`)
    if (!fs.length) {
      parts.push(`<pre style="background:#f4f4f5;padding:10px;border-radius:6px;white-space:pre-wrap;font-size:12px">${r.lines.join('\n')}</pre>`)
      continue
    }
    const byOrg = new Map<string, typeof fs>()
    for (const f of fs) byOrg.set(f.org, [...(byOrg.get(f.org) ?? []), f])
    for (const [org, items] of byOrg) {
      parts.push(`<div style="font-weight:700;font-size:13px;margin:10px 0 4px">${org}</div>`)
      parts.push(`<table style="width:100%;border-collapse:collapse;font-size:13px">${items.map((f) => {
        const d = ageInDays(f.since)
        const b = bucket(d)
        const tag = b === 'new' ? '<span style="background:#dc2626;color:#fff;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700">NEW</span>'
          : b === 'stale' ? `<span style="background:#b45309;color:#fff;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700">${d}d</span>`
          : `<span style="color:#6b7280;font-size:11px">${d ?? '?'}d</span>`
        return `<tr><td style="padding:3px 8px 3px 0;width:52px;vertical-align:top">${tag}</td><td style="padding:3px 0">${f.what}${f.estPerMonth ? ` <span style="color:#6b7280">(~£${f.estPerMonth}/mo)</span>` : ''}</td></tr>`
      }).join('')}</table>`)
    }
  }
  parts.push(`<p style="color:#9ca3af;font-size:12px;margin-top:22px">Oldest first — age is cost. ${new Date().toISOString()} — /api/cron/canaries</p></div>`)
  return { subject, html: parts.join('') }
}
