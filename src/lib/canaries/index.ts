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
  error?: string
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

async function orgNames(sb: Supabase, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (!unique.length) return new Map()
  const rows = await fetchAll<{ id: string; name: string }>((f, t) =>
    sb.from('organisations').select('id, name').in('id', unique).range(f, t))
  return new Map(rows.map((o) => [o.id, o.name]))
}

async function playerNames(sb: Supabase, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean)
  if (!unique.length) return new Map()
  const rows = await fetchAll<{ id: string; first_name: string; last_name: string | null }>((f, t) =>
    sb.from('players').select('id, first_name, last_name').in('id', unique).range(f, t))
  return new Map(rows.map((p) => [p.id, `${p.first_name} ${p.last_name ?? ''}`.trim()]))
}

/**
 * CANARY 1 — Term/billing anchor mismatch (Emma's complaint).
 * A live subscription whose booked class belongs to a term, where the next
 * charge (current_period_end) lands BEFORE the term starts: the parent is
 * being billed for a period the term doesn't cover.
 */
async function canary1TermAnchorMismatch(sb: Supabase): Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> {
  const groups = await fetchAll<{ id: string; name: string; term_id: string }>((f, t) =>
    sb.from('training_groups').select('id, name, term_id').not('term_id', 'is', null).range(f, t))
  if (!groups.length) return { rowCount: 0, lines: [] }

  const terms = await fetchAll<{ id: string; name: string; start_date: string }>((f, t) =>
    sb.from('terms').select('id, name, start_date').range(f, t))
  const termById = new Map(terms.map((tm) => [tm.id, tm]))
  const groupById = new Map(groups.map((g) => [g.id, g]))

  const enrols = await fetchAll<{ player_id: string; group_id: string; organisation_id: string }>((f, t) =>
    sb.from('enrolments')
      .select('player_id, group_id, organisation_id')
      .in('group_id', groups.map((g) => g.id))
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
      if (anchor < term.start_date) {
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
  const enrols = await fetchAll<{ player_id: string; group_id: string }>((f, t) =>
    sb.from('enrolments')
      .select('player_id, group_id')
      .in('player_id', [...new Set(subs.map((s) => s.player_id as string))])
      .range(f, t))
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
  const dayRows = await fetchAll<{ id: string; date: string }>((f, t) =>
    sb.from('camp_days').select('id, date').in('id', [...new Set(dayIds)]).range(f, t))
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

const TIER1: { id: number; name: string; run: (sb: Supabase) => Promise<Omit<CanaryResult, 'id' | 'name' | 'status'>> }[] = [
  { id: 1, name: 'term/billing anchor mismatch', run: canary1TermAnchorMismatch },
  { id: 2, name: 'stuck-pending enrolments', run: canary2StuckPending },
  { id: 3, name: 'paying but not enrolled', run: canary3PayingNotEnrolled },
  { id: 4, name: 'cross-academy attribution', run: canary4CrossAcademy },
  { id: 6, name: 'duplicate camp day booking', run: canary6DuplicateCampDay },
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
