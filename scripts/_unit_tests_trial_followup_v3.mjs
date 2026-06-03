/**
 * Phase 2.4 step 4 unit tests — Players + TrialManager wiring.
 *
 * Verifies:
 *   • PlayersTable filter 'trial_followup' matches stage-bearing rows only
 *   • TrialManager 'followup' tab filter logic (mirror of needsFollowUp)
 *   • TrialManager funnel-badge precedence (stale/awaiting wins over reminder chips)
 *   • Players page playerId-only matching ignores booking-source rows
 *
 * Pure. No DB. Run with:
 *   node scripts/_unit_tests_trial_followup_v3.mjs
 */

const NOW = Date.UTC(2026, 5, 15)

// ─── Re-implementations ───────────────────────────────────────────────
function startOfUtcDay(ms) { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const STALE = 7
function deriveBooking(b, nowMs = NOW) {
  if (b.converted === true) return 'converted'
  const s = (b.status || '').toLowerCase()
  if (s === 'cancelled' || s === 'no_show') return 'lost'
  if (s === 'attended') {
    if (!b.followup_sent) return 'awaiting_followup'
    const ref = b.updated_at || b.preferred_date
    if (!ref) return 'followed_up'
    const refMs = Date.parse(ref); if (isNaN(refMs)) return 'followed_up'
    return Math.floor((nowMs - refMs) / 86_400_000) > STALE ? 'stale_followup' : 'followed_up'
  }
  if (!b.preferred_date) return 'upcoming'
  const pms = Date.parse(b.preferred_date + 'T00:00:00Z'); if (isNaN(pms)) return 'upcoming'
  const t = startOfUtcDay(nowMs)
  if (pms > t) return 'upcoming'; if (pms === t) return 'today'
  return 'awaiting_followup'
}
const needsFollowUp = (s) => s === 'awaiting_followup' || s === 'stale_followup'

// PlayersTable's filter routing — matches what's in PlayersTable.tsx
function playerMatchesFollowup(r) { return !!r.trialFollowUpStage }

// TrialManager funnel-badge precedence
function getReminderBadge(t, stage) {
  if (stage === 'stale_followup')    return { label: 'Stale follow-up', tone: 'rose' }
  if (stage === 'awaiting_followup') return { label: 'Follow-up due', tone: 'amber' }
  if (t.converted) return { label: 'Converted' }
  if (t.followupSent) return { label: 'Followed up' }
  if (t.reminder2h)  return { label: '2h sent' }
  if (t.reminder24h) return { label: '24h sent' }
  if (t.reminder48h) return { label: '48h sent' }
  return null
}

// Players page matching — playerId only (booking rows ignored)
function buildPlayerStageMap(followUpRows) {
  const map = new Map()
  for (const f of followUpRows) {
    if (!f.playerId) continue
    map.set(f.playerId, f.stage)
  }
  return map
}

const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

console.log('\n──── PHASE 1 — PlayersTable trial_followup filter ────')

eq('row with no stage → excluded',     playerMatchesFollowup({ trialFollowUpStage: null }), false)
eq('row with awaiting stage → included', playerMatchesFollowup({ trialFollowUpStage: 'awaiting_followup' }), true)
eq('row with stale stage → included',   playerMatchesFollowup({ trialFollowUpStage: 'stale_followup' }), true)
// `today` should NEVER reach this map (loader strips non-followup stages)
// but if it ever did, the filter would still surface it — that's fine because
// 'today' is only filtered into the players-list cohort if the loader thinks
// it's in the cohort, which by needsFollowUp() it never is.

console.log('\n──── PHASE 2 — Players page playerId-only matching ────')

const followUps = [
  { source: 'enrolment', playerId: 'p1', parentId: 'par-A', parentEmail: null, stage: 'awaiting_followup' },
  { source: 'enrolment', playerId: 'p2', parentId: 'par-B', parentEmail: null, stage: 'stale_followup' },
  // Booking-source rows — no playerId, should NOT contribute to the player map
  { source: 'booking',   playerId: null, parentId: null, parentEmail: 'orphan@x', stage: 'awaiting_followup' },
  { source: 'booking',   playerId: null, parentId: null, parentEmail: 'b@x', stage: 'stale_followup' },
]
const map = buildPlayerStageMap(followUps)
eq('Map size = 2 (only enrolment rows)', map.size, 2)
eq('p1 → awaiting',  map.get('p1'), 'awaiting_followup')
eq('p2 → stale',     map.get('p2'), 'stale_followup')
eq('No entry for booking-source emails', map.has('orphan@x'), false)

console.log('\n──── PHASE 3 — TrialManager follow-up tab filter ────')

// Mirrors the in-component logic: filter='followup' → needsFollowUp(stage)
const trials = [
  { id: 't1', status: 'attended',  followupSent: false, converted: false, preferredDate: '2026-06-10' }, // awaiting
  { id: 't2', status: 'attended',  followupSent: true,  converted: false, updatedAt: '2026-06-05T00:00:00Z' }, // stale (10d)
  { id: 't3', status: 'attended',  followupSent: true,  converted: false, updatedAt: '2026-06-12T00:00:00Z' }, // followed_up (3d)
  { id: 't4', status: 'confirmed', followupSent: false, converted: false, preferredDate: '2026-06-20' }, // upcoming
  { id: 't5', status: 'pending',   followupSent: false, converted: false, preferredDate: TODAY_ISO() }, // today
  { id: 't6', status: 'attended',  followupSent: true,  converted: true,  updatedAt: '2026-06-12T00:00:00Z' }, // converted
]
function TODAY_ISO() { return '2026-06-15' }

const stages = new Map()
for (const t of trials) {
  stages.set(t.id, deriveBooking({
    id: t.id, status: t.status, preferred_date: t.preferredDate, followup_sent: t.followupSent,
    converted: t.converted, updated_at: t.updatedAt ?? null,
  }))
}

const followupTab = trials.filter(t => needsFollowUp(stages.get(t.id) ?? 'upcoming'))
eq('Follow-up tab includes t1 (awaiting)', followupTab.some(t => t.id === 't1'), true)
eq('Follow-up tab includes t2 (stale)',    followupTab.some(t => t.id === 't2'), true)
eq('Follow-up tab excludes t3 (followed_up)', followupTab.some(t => t.id === 't3'), false)
eq('Follow-up tab excludes t4 (upcoming)', followupTab.some(t => t.id === 't4'), false)
eq('Follow-up tab excludes t5 (today)',    followupTab.some(t => t.id === 't5'), false)
eq('Follow-up tab excludes t6 (converted)', followupTab.some(t => t.id === 't6'), false)
eq('Follow-up tab size = 2', followupTab.length, 2)

console.log('\n──── PHASE 4 — Funnel-badge precedence ────')

eq('stale wins over reminder48h',
  getReminderBadge({ converted: false, followupSent: false, reminder48h: true, reminder24h: false, reminder2h: false }, 'stale_followup')?.label,
  'Stale follow-up')
eq('awaiting wins over followedUp signal',
  getReminderBadge({ converted: false, followupSent: true, reminder48h: false, reminder24h: false, reminder2h: false }, 'awaiting_followup')?.label,
  'Follow-up due')
eq('converted shown when stage is followed_up',
  getReminderBadge({ converted: true, followupSent: true, reminder48h: false, reminder24h: false, reminder2h: false }, 'followed_up')?.label,
  'Converted')
eq('reminder48h shown when no follow-up + no convert',
  getReminderBadge({ converted: false, followupSent: false, reminder48h: true, reminder24h: false, reminder2h: false }, 'upcoming')?.label,
  '48h sent')
eq('no badge when nothing set',
  getReminderBadge({ converted: false, followupSent: false, reminder48h: false, reminder24h: false, reminder2h: false }, 'upcoming'),
  null)

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
