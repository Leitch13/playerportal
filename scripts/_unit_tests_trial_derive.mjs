/**
 * Tests for src/lib/trial-derive.ts — the Phase 2.4 trial timeline.
 *
 * Run with:  node scripts/_unit_tests_trial_derive.mjs
 */

// Anchor "now" at 2026-06-15 UTC for stable test cases.
const NOW = Date.UTC(2026, 5, 15)
const TODAY = '2026-06-15'

// ─── Re-implementations (kept in sync with src/lib/trial-derive.ts) ───
const STALE_FOLLOWUP_DAYS = 7

function startOfUtcDay(ms) {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function deriveTrialStageFromBooking(b, nowMs = NOW) {
  if (b.converted === true) return 'converted'
  const status = (b.status || '').toLowerCase()
  if (status === 'cancelled' || status === 'no_show') return 'lost'
  if (status === 'attended') {
    if (!b.followup_sent) return 'awaiting_followup'
    const refIso = b.updated_at || b.preferred_date
    if (!refIso) return 'followed_up'
    const refMs = Date.parse(refIso)
    if (isNaN(refMs)) return 'followed_up'
    const daysSince = Math.floor((nowMs - refMs) / 86_400_000)
    return daysSince > STALE_FOLLOWUP_DAYS ? 'stale_followup' : 'followed_up'
  }
  if (!b.preferred_date) return 'upcoming'
  const preferredMs = Date.parse(b.preferred_date + 'T00:00:00Z')
  if (isNaN(preferredMs)) return 'upcoming'
  const todayMs = startOfUtcDay(nowMs)
  if (preferredMs > todayMs) return 'upcoming'
  if (preferredMs === todayMs) return 'today'
  return 'awaiting_followup'
}

function deriveTrialStageFromEnrolment(e, nowMs = NOW) {
  const status = (e.status || '').toLowerCase()
  if (status === 'cancelled' || status === 'inactive') return 'lost'
  if (status === 'paused') return 'lost'
  if (e.is_trial === false) return 'converted'
  if (status === 'pending') return 'upcoming'
  if (status === 'active') {
    if (!e.trial_expires_at) return 'today'
    const expiryMs = Date.parse(e.trial_expires_at + 'T00:00:00Z')
    if (isNaN(expiryMs)) return 'today'
    const todayMs = startOfUtcDay(nowMs)
    return expiryMs <= todayMs ? 'awaiting_followup' : 'today'
  }
  return 'today'
}

function needsFollowUp(stage) {
  return stage === 'awaiting_followup' || stage === 'stale_followup'
}

function isActiveTrialStage(stage) {
  return stage === 'upcoming' || stage === 'today' || stage === 'awaiting_followup' ||
         stage === 'followed_up' || stage === 'stale_followup'
}

function daysSinceTrialDate(b, nowMs = NOW) {
  const ref = b.preferred_date || b.updated_at
  if (!ref) return null
  const ms = Date.parse(ref + (ref.length === 10 ? 'T00:00:00Z' : ''))
  if (isNaN(ms)) return null
  return Math.max(0, Math.floor((nowMs - ms) / 86_400_000))
}

// ─── Runner ────────────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}
const booking = (over = {}) => ({
  id: 'b1', status: 'pending', preferred_date: null,
  followup_sent: false, converted: false, updated_at: null, ...over,
})
const enrolment = (over = {}) => ({
  id: 'e1', status: 'active', is_trial: true,
  trial_expires_at: null, activates_on: null, ...over,
})

console.log('\n──── PHASE 1 — deriveTrialStageFromBooking ────')

// Terminal: converted
eq('converted=true → converted', deriveTrialStageFromBooking(booking({ converted: true })), 'converted')
eq('converted=true wins even when cancelled', deriveTrialStageFromBooking(booking({ converted: true, status: 'cancelled' })), 'converted')

// Terminal: lost
eq('status=cancelled → lost', deriveTrialStageFromBooking(booking({ status: 'cancelled' })), 'lost')
eq('status=no_show → lost',   deriveTrialStageFromBooking(booking({ status: 'no_show' })), 'lost')

// Pre-trial
eq('Future preferred_date → upcoming',
  deriveTrialStageFromBooking(booking({ status: 'confirmed', preferred_date: '2026-06-20' })), 'upcoming')
eq('Today preferred_date → today',
  deriveTrialStageFromBooking(booking({ status: 'confirmed', preferred_date: TODAY })), 'today')
eq('Past preferred_date but still pending → awaiting_followup (admin missed update)',
  deriveTrialStageFromBooking(booking({ status: 'pending', preferred_date: '2026-06-10' })), 'awaiting_followup')
eq('Pending without preferred_date → upcoming',
  deriveTrialStageFromBooking(booking({ status: 'pending', preferred_date: null })), 'upcoming')

// Attended branch
eq('attended + no followup → awaiting_followup',
  deriveTrialStageFromBooking(booking({ status: 'attended', preferred_date: '2026-06-10' })), 'awaiting_followup')
eq('attended + followup_sent + 3 days ago → followed_up',
  deriveTrialStageFromBooking(booking({ status: 'attended', followup_sent: true, updated_at: '2026-06-12T10:00:00Z' })), 'followed_up')
eq('attended + followup_sent + 10 days ago → stale_followup',
  deriveTrialStageFromBooking(booking({ status: 'attended', followup_sent: true, updated_at: '2026-06-05T00:00:00Z' })), 'stale_followup')
eq('attended + followup_sent but no updated_at — falls back to preferred_date — 5d ago → followed_up',
  deriveTrialStageFromBooking(booking({ status: 'attended', followup_sent: true, preferred_date: '2026-06-10' })), 'followed_up')
eq('attended + followup_sent + no reference dates → followed_up (safe default)',
  deriveTrialStageFromBooking(booking({ status: 'attended', followup_sent: true })), 'followed_up')

console.log('\n──── PHASE 2 — deriveTrialStageFromEnrolment ────')

// Terminal: lost
eq('status=cancelled → lost', deriveTrialStageFromEnrolment(enrolment({ status: 'cancelled' })), 'lost')
eq('status=paused → lost',    deriveTrialStageFromEnrolment(enrolment({ status: 'paused' })), 'lost')
eq('status=inactive → lost',  deriveTrialStageFromEnrolment(enrolment({ status: 'inactive' })), 'lost')

// Terminal: converted (is_trial flipped to false)
eq('is_trial=false → converted',
  deriveTrialStageFromEnrolment(enrolment({ is_trial: false, status: 'active' })), 'converted')

// Pre-trial
eq('status=pending → upcoming',
  deriveTrialStageFromEnrolment(enrolment({ status: 'pending' })), 'upcoming')

// Active in-progress
eq('active + future expiry → today (in-progress)',
  deriveTrialStageFromEnrolment(enrolment({ status: 'active', trial_expires_at: '2026-06-20' })), 'today')
eq('active + today expiry → awaiting_followup',
  deriveTrialStageFromEnrolment(enrolment({ status: 'active', trial_expires_at: TODAY })), 'awaiting_followup')
eq('active + past expiry → awaiting_followup',
  deriveTrialStageFromEnrolment(enrolment({ status: 'active', trial_expires_at: '2026-06-10' })), 'awaiting_followup')
eq('active + no expiry set → today',
  deriveTrialStageFromEnrolment(enrolment({ status: 'active', trial_expires_at: null })), 'today')

console.log('\n──── PHASE 3 — needsFollowUp + isActiveTrialStage ────')

eq('awaiting_followup needsFollowUp', needsFollowUp('awaiting_followup'), true)
eq('stale_followup needsFollowUp',    needsFollowUp('stale_followup'), true)
eq('today does NOT need follow-up',   needsFollowUp('today'), false)
eq('converted does NOT need',         needsFollowUp('converted'), false)
eq('lost does NOT need',              needsFollowUp('lost'), false)

eq('upcoming is active',           isActiveTrialStage('upcoming'), true)
eq('today is active',              isActiveTrialStage('today'), true)
eq('followed_up is active',        isActiveTrialStage('followed_up'), true)
eq('awaiting_followup is active',  isActiveTrialStage('awaiting_followup'), true)
eq('stale_followup is active',     isActiveTrialStage('stale_followup'), true)
eq('converted is NOT active',      isActiveTrialStage('converted'), false)
eq('lost is NOT active',           isActiveTrialStage('lost'), false)

console.log('\n──── PHASE 4 — daysSinceTrialDate ────')

eq('null inputs → null',  daysSinceTrialDate({ preferred_date: null }), null)
eq('5 days ago → 5',      daysSinceTrialDate({ preferred_date: '2026-06-10' }), 5)
eq('today → 0',           daysSinceTrialDate({ preferred_date: TODAY }), 0)
eq('Future date → 0 (clamped)', daysSinceTrialDate({ preferred_date: '2026-06-20' }), 0)
eq('Falls back to updated_at when preferred_date is null',
  daysSinceTrialDate({ preferred_date: null, updated_at: '2026-06-12T00:00:00Z' }), 3)
eq('Bad string → null',   daysSinceTrialDate({ preferred_date: 'banana' }), null)

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
