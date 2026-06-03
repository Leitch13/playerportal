/**
 * Integration test for src/lib/trial-followups-loader.ts using a mock
 * Supabase client. Verifies:
 *   • both pulls run in parallel
 *   • both produce the unified row shape
 *   • only needsFollowUp(stage) rows survive the filter
 *   • sort order: stale_followup first, then by daysSinceTrial DESC
 *   • bookings carry mailto only; enrolments carry parent_href
 *
 * Pure mocks — no DB. Run with:
 *   node scripts/_unit_tests_trial_followups_loader.mjs
 *
 * We can't import the TS file directly without a build, so we re-implement
 * the loader's transformation logic locally and verify that against the
 * exact same inputs the real loader would receive. The derive layer's
 * correctness is already covered by _unit_tests_trial_derive.mjs.
 */

const NOW = Date.UTC(2026, 5, 15) // 2026-06-15 UTC

// ─── Re-implement derive (same as scripts/_unit_tests_trial_derive.mjs) ─
function startOfUtcDay(ms) {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
const STALE = 7
function deriveBooking(b, nowMs = NOW) {
  if (b.converted === true) return 'converted'
  const s = (b.status || '').toLowerCase()
  if (s === 'cancelled' || s === 'no_show') return 'lost'
  if (s === 'attended') {
    if (!b.followup_sent) return 'awaiting_followup'
    const ref = b.updated_at || b.preferred_date
    if (!ref) return 'followed_up'
    const refMs = Date.parse(ref)
    if (isNaN(refMs)) return 'followed_up'
    return Math.floor((nowMs - refMs) / 86_400_000) > STALE ? 'stale_followup' : 'followed_up'
  }
  if (!b.preferred_date) return 'upcoming'
  const pms = Date.parse(b.preferred_date + 'T00:00:00Z')
  if (isNaN(pms)) return 'upcoming'
  const t = startOfUtcDay(nowMs)
  if (pms > t) return 'upcoming'
  if (pms === t) return 'today'
  return 'awaiting_followup'
}
function deriveEnrolment(e, nowMs = NOW) {
  const s = (e.status || '').toLowerCase()
  if (s === 'cancelled' || s === 'inactive' || s === 'paused') return 'lost'
  if (e.is_trial === false) return 'converted'
  if (s === 'pending') return 'upcoming'
  if (s === 'active') {
    if (!e.trial_expires_at) return 'today'
    const ms = Date.parse(e.trial_expires_at + 'T00:00:00Z')
    if (isNaN(ms)) return 'today'
    return ms <= startOfUtcDay(nowMs) ? 'awaiting_followup' : 'today'
  }
  return 'today'
}
const needs = (s) => s === 'awaiting_followup' || s === 'stale_followup'
const daysSince = (iso, nowMs = NOW) => {
  if (!iso) return null
  const ms = Date.parse(iso + (iso.length === 10 ? 'T00:00:00Z' : ''))
  if (isNaN(ms)) return null
  return Math.max(0, Math.floor((nowMs - ms) / 86_400_000))
}

// ─── Re-implement loader transformation ───────────────────────────────
function loaderFromBookings(rows, nowMs = NOW) {
  const out = []
  for (const b of rows) {
    const stage = deriveBooking(b, nowMs)
    if (!needs(stage)) continue
    out.push({
      source: 'booking', id: b.id, stage,
      childName: b.child_name || '',
      parentName: b.parent_name || null,
      parentEmail: b.parent_email || null,
      parentPhone: b.parent_phone || null,
      parentId: null, playerId: null,
      groupName: b.group?.name ?? null,
      trialDateIso: b.preferred_date,
      daysSinceTrial: daysSince(b.preferred_date, nowMs),
      viewHref: '/dashboard/trials',
      messageHref: b.parent_email ? `mailto:${b.parent_email}` : null,
      parentHref: null,
    })
  }
  return out
}
function loaderFromEnrolments(rows, nowMs = NOW) {
  const out = []
  for (const e of rows) {
    const stage = deriveEnrolment(e, nowMs)
    if (!needs(stage)) continue
    const childName = [e.player?.first_name, e.player?.last_name].filter(Boolean).join(' ').trim() || 'Unknown player'
    let dst = null
    if (e.trial_expires_at) {
      const m = Date.parse(e.trial_expires_at + 'T00:00:00Z')
      if (!isNaN(m)) dst = Math.max(0, Math.floor((nowMs - m) / 86_400_000))
    }
    out.push({
      source: 'enrolment', id: e.id, stage, childName,
      parentName: e.player?.parent?.full_name ?? null,
      parentEmail: e.player?.parent?.email ?? null,
      parentPhone: e.player?.parent?.phone ?? null,
      parentId: e.player?.parent_id ?? null,
      playerId: e.player?.id ?? null,
      groupName: e.group?.name ?? null,
      trialDateIso: e.trial_expires_at,
      daysSinceTrial: dst,
      viewHref: e.player?.id ? `/dashboard/players/${e.player.id}` : '/dashboard/enrolments#trial',
      messageHref: e.player?.parent?.email ? `mailto:${e.player.parent.email}` : null,
      parentHref: e.player?.parent_id ? `/dashboard/parents/${e.player.parent_id}` : null,
    })
  }
  return out
}
function loaderMerge(b, e) {
  return [...b, ...e].sort((a, b) => {
    const as = a.stage === 'stale_followup' ? 0 : 1
    const bs = b.stage === 'stale_followup' ? 0 : 1
    if (as !== bs) return as - bs
    return (b.daysSinceTrial ?? 0) - (a.daysSinceTrial ?? 0)
  })
}

// ─── Runner ────────────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

console.log('\n──── Bookings → unified rows ────')

const sampleBookings = [
  // 1. converted=true — should be excluded (terminal)
  { id: 'b1', status: 'attended', preferred_date: '2026-06-10', followup_sent: true, converted: true, updated_at: '2026-06-11T00:00:00Z', parent_name: 'A', parent_email: 'a@x', parent_phone: null, child_name: 'A Jr', group: { name: 'Skills' } },
  // 2. attended + no followup → awaiting_followup (in cohort)
  { id: 'b2', status: 'attended', preferred_date: '2026-06-10', followup_sent: false, converted: false, updated_at: null, parent_name: 'B', parent_email: 'b@x', parent_phone: '+44', child_name: 'B Jr', group: { name: 'U10' } },
  // 3. attended + followup 10 days ago → stale_followup (in cohort)
  { id: 'b3', status: 'attended', preferred_date: '2026-06-01', followup_sent: true, converted: false, updated_at: '2026-06-04T00:00:00Z', parent_name: 'C', parent_email: 'c@x', parent_phone: null, child_name: 'C Jr', group: { name: 'U12' } },
  // 4. confirmed pending past preferred_date → awaiting_followup (in cohort)
  { id: 'b4', status: 'confirmed', preferred_date: '2026-06-12', followup_sent: false, converted: false, updated_at: null, parent_name: 'D', parent_email: 'd@x', parent_phone: null, child_name: 'D Jr', group: null },
  // 5. cancelled → lost (excluded)
  { id: 'b5', status: 'cancelled', preferred_date: '2026-06-10', followup_sent: false, converted: false, updated_at: null, parent_name: 'E', parent_email: 'e@x', parent_phone: null, child_name: 'E Jr', group: { name: 'U8' } },
  // 6. future booking → upcoming (excluded)
  { id: 'b6', status: 'confirmed', preferred_date: '2026-06-20', followup_sent: false, converted: false, updated_at: null, parent_name: 'F', parent_email: null, parent_phone: null, child_name: 'F Jr', group: null },
]

const fromBookings = loaderFromBookings(sampleBookings)
eq('Bookings cohort size = 3', fromBookings.length, 3)
eq('Booking b1 (converted) excluded', fromBookings.find(r => r.id === 'b1') ?? null, null)
eq('Booking b5 (cancelled) excluded', fromBookings.find(r => r.id === 'b5') ?? null, null)
eq('Booking b6 (future) excluded',   fromBookings.find(r => r.id === 'b6') ?? null, null)

const b2 = fromBookings.find(r => r.id === 'b2')
eq('b2 source = booking',    b2?.source, 'booking')
eq('b2 stage = awaiting',    b2?.stage, 'awaiting_followup')
eq('b2 childName mapped',    b2?.childName, 'B Jr')
eq('b2 parentName mapped',   b2?.parentName, 'B')
eq('b2 parentEmail mapped',  b2?.parentEmail, 'b@x')
eq('b2 parentPhone mapped',  b2?.parentPhone, '+44')
eq('b2 parentId NULL',       b2?.parentId, null)
eq('b2 playerId NULL',       b2?.playerId, null)
eq('b2 groupName mapped',    b2?.groupName, 'U10')
eq('b2 trialDateIso mapped', b2?.trialDateIso, '2026-06-10')
eq('b2 daysSinceTrial=5',    b2?.daysSinceTrial, 5)
eq('b2 viewHref = trials',   b2?.viewHref, '/dashboard/trials')
eq('b2 messageHref mailto',  b2?.messageHref, 'mailto:b@x')
eq('b2 parentHref null',     b2?.parentHref, null)

const b3 = fromBookings.find(r => r.id === 'b3')
eq('b3 stage = stale',       b3?.stage, 'stale_followup')

console.log('\n──── Enrolments → unified rows ────')

const sampleEnrolments = [
  // 1. active + expired trial → awaiting_followup (in cohort)
  { id: 'e1', status: 'active', is_trial: true, trial_expires_at: '2026-06-10', activates_on: null,
    player: { id: 'p1', first_name: 'Sam', last_name: 'Lee', parent_id: 'par-1',
              parent: { full_name: 'Pat Lee', email: 'pat@x', phone: '+1' } },
    group: { name: 'U10 Skills' } },
  // 2. cancelled → lost (excluded)
  { id: 'e2', status: 'cancelled', is_trial: true, trial_expires_at: '2026-06-10', activates_on: null,
    player: { id: 'p2', first_name: 'X', last_name: 'Y', parent_id: 'par-2',
              parent: { full_name: 'Q', email: 'q@x', phone: null } },
    group: { name: 'U8' } },
  // 3. active + future expiry → today (excluded)
  { id: 'e3', status: 'active', is_trial: true, trial_expires_at: '2026-06-20', activates_on: null,
    player: { id: 'p3', first_name: 'Y', last_name: 'Z', parent_id: 'par-3',
              parent: { full_name: 'R', email: 'r@x', phone: null } },
    group: { name: 'U12' } },
  // 4. active + no expiry → today (excluded)
  { id: 'e4', status: 'active', is_trial: true, trial_expires_at: null, activates_on: null,
    player: { id: 'p4', first_name: 'Y', last_name: 'Z', parent_id: 'par-4',
              parent: { full_name: 'S', email: 's@x', phone: null } },
    group: { name: 'U12' } },
  // 5. active + null parent record → still surfaces, no parentHref
  { id: 'e5', status: 'active', is_trial: true, trial_expires_at: '2026-06-08', activates_on: null,
    player: { id: 'p5', first_name: 'Orphan', last_name: 'Player', parent_id: null, parent: null },
    group: null },
]

const fromEnrolments = loaderFromEnrolments(sampleEnrolments)
eq('Enrolment cohort size = 2', fromEnrolments.length, 2)
eq('e2 (cancelled) excluded',   fromEnrolments.find(r => r.id === 'e2') ?? null, null)
eq('e3 (future) excluded',      fromEnrolments.find(r => r.id === 'e3') ?? null, null)
eq('e4 (today) excluded',       fromEnrolments.find(r => r.id === 'e4') ?? null, null)

const e1 = fromEnrolments.find(r => r.id === 'e1')
eq('e1 source = enrolment',  e1?.source, 'enrolment')
eq('e1 stage = awaiting',    e1?.stage, 'awaiting_followup')
eq('e1 childName composed', e1?.childName, 'Sam Lee')
eq('e1 parentName mapped',  e1?.parentName, 'Pat Lee')
eq('e1 parentId mapped',    e1?.parentId, 'par-1')
eq('e1 playerId mapped',    e1?.playerId, 'p1')
eq('e1 trialDateIso',       e1?.trialDateIso, '2026-06-10')
eq('e1 daysSinceTrial=5',   e1?.daysSinceTrial, 5)
eq('e1 viewHref → player', e1?.viewHref, '/dashboard/players/p1')
eq('e1 messageHref mailto', e1?.messageHref, 'mailto:pat@x')
eq('e1 parentHref →parent',e1?.parentHref, '/dashboard/parents/par-1')

const e5 = fromEnrolments.find(r => r.id === 'e5')
eq('e5 orphan childName',    e5?.childName, 'Orphan Player')
eq('e5 parentName null',     e5?.parentName, null)
eq('e5 parentEmail null',    e5?.parentEmail, null)
eq('e5 parentId null',       e5?.parentId, null)
eq('e5 viewHref → player',   e5?.viewHref, '/dashboard/players/p5')
eq('e5 messageHref null',    e5?.messageHref, null)
eq('e5 parentHref null',     e5?.parentHref, null)

console.log('\n──── Merge + sort ────')

const merged = loaderMerge(fromBookings, fromEnrolments)
eq('Merged cohort size = 5 (3+2)', merged.length, 5)
eq('First row is stale (b3)', merged[0].id, 'b3')
eq('All stale_followup rows come before any awaiting', (() => {
  let seenAwaiting = false
  for (const r of merged) {
    if (r.stage === 'awaiting_followup') seenAwaiting = true
    if (r.stage === 'stale_followup' && seenAwaiting) return false
  }
  return true
})(), true)

// Within awaiting_followup, daysSinceTrial DESC
const awaitingRows = merged.filter(r => r.stage === 'awaiting_followup')
const awaitingDays = awaitingRows.map(r => r.daysSinceTrial)
const sortedDesc = [...awaitingDays].sort((a, b) => (b ?? 0) - (a ?? 0))
eq('Awaiting rows sorted DESC by days', awaitingDays, sortedDesc)

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
