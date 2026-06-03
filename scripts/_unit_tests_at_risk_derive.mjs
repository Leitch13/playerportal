/**
 * Phase 2.6 derive layer unit tests.
 *
 *   node scripts/_unit_tests_at_risk_derive.mjs
 *
 * Covers:
 *   • Tier promotion (high beats medium beats healthy)
 *   • Stale trial follow-up wins over awaiting
 *   • payment_issue + trial_followup_due both fire under HIGH
 *   • Contact: never vs not_contacted_30d vs recent
 *   • Healthy when no signal fires
 *   • Empty badges + null inputs
 *   • Filter routing for the 4 chip keys
 */

const NOW = Date.UTC(2026, 5, 15)
const STALE_DAYS = 30
const startOfUtcDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const parseSafe = (s) => { const ms = Date.parse(/[T ]/.test(s) ? s : s + 'T00:00:00Z'); return isNaN(ms) ? null : ms }

const needsFollowUp = (s) => s === 'awaiting_followup' || s === 'stale_followup'
function contactBucket(sig) {
  if (!sig || !sig.lastIso) return 'never'
  const ms = parseSafe(sig.lastIso); if (ms === null) return 'never'
  const days = Math.floor((startOfUtcDay(NOW) - startOfUtcDay(ms)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days <= 7) return 'recent_7d'
  if (days <= STALE_DAYS) return 'recent_30d'
  return 'stale_30plus'
}

// Re-implementation mirroring src/lib/at-risk-derive.ts
const CATALOGUE = {
  trial_stale_followup: { label: 'Stale trial follow-up', tier: 'high',   tone: 'rose',  emoji: '⏰' },
  trial_followup_due:   { label: 'Trial follow-up due',   tier: 'high',   tone: 'rose',  emoji: '⏰' },
  payment_issue:        { label: 'Payment issue',         tier: 'high',   tone: 'rose',  emoji: '⚠️' },
  no_attendance_30d:    { label: 'No attendance 30+ days', tier: 'medium', tone: 'amber', emoji: '⏱️' },
  not_contacted_30d:    { label: 'No contact 30+ days',    tier: 'medium', tone: 'amber', emoji: '📭' },
  never_contacted:      { label: 'Never contacted',        tier: 'medium', tone: 'amber', emoji: '📭' },
  review_due:           { label: 'Review due',             tier: 'medium', tone: 'amber', emoji: '📋' },
}
const reason = (key) => ({ key, ...CATALOGUE[key] })

function deriveRisk(inputs) {
  const reasons = []
  const badgeKeys = new Set(inputs.badges.map(b => b.key))
  if (inputs.trialStage === 'stale_followup') reasons.push(reason('trial_stale_followup'))
  else if (inputs.trialStage && needsFollowUp(inputs.trialStage)) reasons.push(reason('trial_followup_due'))
  if (badgeKeys.has('payment_issue')) reasons.push(reason('payment_issue'))
  if (badgeKeys.has('no_attendance_30d')) reasons.push(reason('no_attendance_30d'))
  const cb = contactBucket(inputs.contactSignal)
  if (cb === 'never') reasons.push(reason('never_contacted'))
  else if (cb === 'stale_30plus') reasons.push(reason('not_contacted_30d'))
  if (badgeKeys.has('review_due')) reasons.push(reason('review_due'))
  const hasHigh = reasons.some(r => r.tier === 'high')
  const hasMedium = reasons.some(r => r.tier === 'medium')
  const riskLevel = hasHigh ? 'high' : hasMedium ? 'medium' : 'healthy'
  return { riskLevel, riskReasons: reasons }
}

function matchesAtRiskFilter(a, filter) {
  switch (filter) {
    case 'needs_attention':  return a.riskLevel !== 'healthy'
    case 'high_risk':        return a.riskLevel === 'high'
    case 'no_contact':       return a.riskReasons.some(r => r.key === 'never_contacted' || r.key === 'not_contacted_30d')
    case 'attendance_risk':  return a.riskReasons.some(r => r.key === 'no_attendance_30d')
    default:                 return false
  }
}

// ─── Runner ───────────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}
const sig = (iso) => ({ lastIso: iso, mostRecentMessageIso: iso, conversationCount: 0 })
// "Healthy" base — must include a RECENT contact, otherwise contact-derive
// fires the never_contacted reason and the family becomes medium.
const baseInputs = () => ({ trialStage: null, badges: [], contactSignal: sig('2026-06-10T00:00:00Z') })

console.log('\n──── PHASE 1 — Tier promotion ────')

// All possible signal combinations vs expected tier
const r1 = deriveRisk(baseInputs())
eq('No signals → healthy',
  r1.riskLevel, 'healthy')
eq('Healthy → no reasons',
  r1.riskReasons.length, 0)

const r2 = deriveRisk({ ...baseInputs(), badges: [{ key: 'review_due' }] })
eq('Only review_due → medium',
  r2.riskLevel, 'medium')
eq('Only review_due → reason count 1',
  r2.riskReasons.length, 1)

const r3 = deriveRisk({ ...baseInputs(), badges: [{ key: 'payment_issue' }] })
eq('Only payment_issue → high',
  r3.riskLevel, 'high')

const r4 = deriveRisk({ ...baseInputs(), trialStage: 'awaiting_followup' })
eq('Only trial awaiting → high',
  r4.riskLevel, 'high')
eq('trial awaiting → reason key trial_followup_due',
  r4.riskReasons[0]?.key, 'trial_followup_due')

const r5 = deriveRisk({ ...baseInputs(), trialStage: 'stale_followup' })
eq('Only trial stale → high',
  r5.riskLevel, 'high')
eq('trial stale → reason key trial_stale_followup',
  r5.riskReasons[0]?.key, 'trial_stale_followup')

const r6 = deriveRisk({ ...baseInputs(),
  trialStage: 'awaiting_followup',
  badges: [{ key: 'review_due' }, { key: 'no_attendance_30d' }],
  contactSignal: null })
eq('high + medium combined → still high',
  r6.riskLevel, 'high')
eq('combined: emits all 4 reasons',
  r6.riskReasons.length, 4)

console.log('\n──── PHASE 2 — Stale > Awaiting (defensive) ────')

const r7 = deriveRisk({ ...baseInputs(), trialStage: 'stale_followup' })
const r8 = deriveRisk({ ...baseInputs(), trialStage: 'awaiting_followup' })
eq('Stale → trial_stale_followup',  r7.riskReasons[0].key, 'trial_stale_followup')
eq('Awaiting → trial_followup_due', r8.riskReasons[0].key, 'trial_followup_due')
eq('Awaiting NEVER produces stale key',
  r8.riskReasons.some(r => r.key === 'trial_stale_followup'), false)

console.log('\n──── PHASE 3 — Contact bucket → reason mapping ────')

const r9 = deriveRisk({ ...baseInputs(), contactSignal: null })
eq('null signal → never_contacted reason',
  r9.riskReasons.some(r => r.key === 'never_contacted'), true)
eq('null signal → riskLevel medium',
  r9.riskLevel, 'medium')

const r10 = deriveRisk({ ...baseInputs(), contactSignal: sig('2026-05-15T00:00:00Z') })  // 31d ago
eq('31d ago → not_contacted_30d reason',
  r10.riskReasons.some(r => r.key === 'not_contacted_30d'), true)
eq('31d ago → riskLevel medium',
  r10.riskLevel, 'medium')

const r11 = deriveRisk({ ...baseInputs(), contactSignal: sig('2026-06-10T00:00:00Z') })  // 5d ago
eq('5d ago → no contact-related reason',
  r11.riskReasons.length, 0)
eq('5d ago → riskLevel healthy',
  r11.riskLevel, 'healthy')

console.log('\n──── PHASE 4 — Reason ordering is deterministic ────')

const r12 = deriveRisk({
  trialStage: 'stale_followup',
  badges: [{ key: 'review_due' }, { key: 'no_attendance_30d' }, { key: 'payment_issue' }],
  contactSignal: sig('2026-05-15T00:00:00Z'),  // 31d ago → not_contacted_30d
})
const keys12 = r12.riskReasons.map(r => r.key)
eq('Order is high-then-medium, then catalogue order',
  keys12,
  ['trial_stale_followup', 'payment_issue', 'no_attendance_30d', 'not_contacted_30d', 'review_due'])
eq('Composite case → high',
  r12.riskLevel, 'high')

console.log('\n──── PHASE 5 — Filter routing ────')

const high = deriveRisk({ ...baseInputs(), trialStage: 'awaiting_followup' })
const medium = deriveRisk({ ...baseInputs(), badges: [{ key: 'review_due' }] })
const healthy = deriveRisk({ ...baseInputs(), contactSignal: sig('2026-06-10T00:00:00Z') })
const onlyContact = deriveRisk({ ...baseInputs(), contactSignal: null })
const onlyAttendance = deriveRisk({ ...baseInputs(), badges: [{ key: 'no_attendance_30d' }] })

eq('high matches needs_attention',      matchesAtRiskFilter(high, 'needs_attention'), true)
eq('medium matches needs_attention',    matchesAtRiskFilter(medium, 'needs_attention'), true)
eq('healthy does NOT match needs_attention', matchesAtRiskFilter(healthy, 'needs_attention'), false)
eq('high matches high_risk',            matchesAtRiskFilter(high, 'high_risk'), true)
eq('medium does NOT match high_risk',   matchesAtRiskFilter(medium, 'high_risk'), false)
eq('only-contact medium matches no_contact', matchesAtRiskFilter(onlyContact, 'no_contact'), true)
eq('only-contact does NOT match attendance_risk', matchesAtRiskFilter(onlyContact, 'attendance_risk'), false)
eq('only-attendance matches attendance_risk', matchesAtRiskFilter(onlyAttendance, 'attendance_risk'), true)
eq('only-attendance does NOT match no_contact',
  matchesAtRiskFilter(onlyAttendance, 'no_contact'), false)
eq('Unknown filter key → false',        matchesAtRiskFilter(high, 'bogus'), false)

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
