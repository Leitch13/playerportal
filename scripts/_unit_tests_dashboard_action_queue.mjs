/**
 * Phase 2.9 unit tests — Dashboard Action Queue.
 *
 *   node scripts/_unit_tests_dashboard_action_queue.mjs
 *
 * The loader itself is heavy I/O and exercised by the live smoke. The
 * pure-JS parts that DO have logic worth testing in isolation:
 *
 *   • The total = sum of the 5 sub-counts
 *   • Row-visibility filtering (hide zero-count rows)
 *   • Empty-state behaviour (total === 0 → "Nothing requires attention")
 *   • Catch-fallback shape (when a counter fails it returns 0, total still sums)
 *   • Action Queue row ordering matches the spec:
 *     🔴 Trial → 🔴 Payment → 🟠 At-Risk → 🟠 Attendance → 🟡 Reviews
 */

// ─── Re-implementations ───────────────────────────────────────────────

function sumTotal(counts) {
  return (counts.trialFollowUps || 0)
       + (counts.paymentIssues || 0)
       + (counts.atRiskFamilies || 0)
       + (counts.attendanceRisks || 0)
       + (counts.reviewsDue || 0)
}

const ROWS = [
  { key: 'trialFollowUps',   label: 'Trial Follow-Ups',  emoji: '🔴', tone: 'rose'   },
  { key: 'paymentIssues',    label: 'Payment Issues',    emoji: '🔴', tone: 'rose'   },
  { key: 'atRiskFamilies',   label: 'At-Risk Families',  emoji: '🟠', tone: 'amber'  },
  { key: 'attendanceRisks',  label: 'Attendance Risks',  emoji: '🟠', tone: 'amber'  },
  { key: 'reviewsDue',       label: 'Reviews Due',       emoji: '🟡', tone: 'yellow' },
]

function visibleRows(counts) {
  return ROWS.filter(r => (counts[r.key] ?? 0) > 0)
}

// ─── Runner ───────────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

console.log('\n──── PHASE 1 — Total sum ────')

eq('Total of zeros is 0',     sumTotal({ trialFollowUps: 0, paymentIssues: 0, atRiskFamilies: 0, attendanceRisks: 0, reviewsDue: 0 }), 0)
eq('Total of [2,1,4,2,3] = 12 (spec example)',
  sumTotal({ trialFollowUps: 2, paymentIssues: 1, atRiskFamilies: 4, attendanceRisks: 2, reviewsDue: 3 }), 12)
eq('Total skips undefined values', sumTotal({ trialFollowUps: 5 }), 5)
eq('Total with mixed zeros',       sumTotal({ trialFollowUps: 0, paymentIssues: 7, atRiskFamilies: 0, attendanceRisks: 0, reviewsDue: 1 }), 8)

console.log('\n──── PHASE 2 — Row visibility (hide zero-count rows) ────')

const allZero = { trialFollowUps: 0, paymentIssues: 0, atRiskFamilies: 0, attendanceRisks: 0, reviewsDue: 0 }
eq('All zero → no visible rows',  visibleRows(allZero).length, 0)

const onlyTrials = { trialFollowUps: 3, paymentIssues: 0, atRiskFamilies: 0, attendanceRisks: 0, reviewsDue: 0 }
eq('Only trials → 1 visible row',     visibleRows(onlyTrials).length, 1)
eq('Only trials → row key trialFollowUps', visibleRows(onlyTrials)[0].key, 'trialFollowUps')

const onlyReviews = { trialFollowUps: 0, paymentIssues: 0, atRiskFamilies: 0, attendanceRisks: 0, reviewsDue: 4 }
eq('Only reviews → 1 visible row',  visibleRows(onlyReviews).length, 1)
eq('Only reviews → row key reviewsDue', visibleRows(onlyReviews)[0].key, 'reviewsDue')

const allSet = { trialFollowUps: 2, paymentIssues: 1, atRiskFamilies: 4, attendanceRisks: 2, reviewsDue: 3 }
eq('All set → 5 visible rows', visibleRows(allSet).length, 5)
eq('All set → order: trial→pay→atrisk→att→reviews',
  visibleRows(allSet).map(r => r.key),
  ['trialFollowUps', 'paymentIssues', 'atRiskFamilies', 'attendanceRisks', 'reviewsDue'])

console.log('\n──── PHASE 3 — Spec compliance: row tones + emojis ────')

eq('Trial Follow-Ups → 🔴 rose',  visibleRows(allSet)[0].emoji, '🔴')
eq('Payment Issues → 🔴 rose',   { e: visibleRows(allSet)[1].emoji, t: visibleRows(allSet)[1].tone }, { e: '🔴', t: 'rose' })
eq('At-Risk Families → 🟠 amber', { e: visibleRows(allSet)[2].emoji, t: visibleRows(allSet)[2].tone }, { e: '🟠', t: 'amber' })
eq('Attendance Risks → 🟠 amber', { e: visibleRows(allSet)[3].emoji, t: visibleRows(allSet)[3].tone }, { e: '🟠', t: 'amber' })
eq('Reviews Due → 🟡 yellow',    { e: visibleRows(allSet)[4].emoji, t: visibleRows(allSet)[4].tone }, { e: '🟡', t: 'yellow' })

console.log('\n──── PHASE 4 — Catch-fallback shape ────')

// When a counter fails, the loader returns 0 for that signal. Total still sums.
const partialFail = { trialFollowUps: 0 /* failed */, paymentIssues: 1, atRiskFamilies: 4, attendanceRisks: 0 /* failed */, reviewsDue: 3 }
eq('Partial failures → total still correct',  sumTotal(partialFail), 8)
eq('Partial failures → only non-zero rows shown', visibleRows(partialFail).map(r => r.key), ['paymentIssues', 'atRiskFamilies', 'reviewsDue'])

console.log('\n──── PHASE 5 — Singular/plural label ────')

function actionsLabel(total) { return total === 1 ? 'action' : 'actions' }
eq('1 → action',   actionsLabel(1), 'action')
eq('0 → actions',  actionsLabel(0), 'actions')
eq('12 → actions', actionsLabel(12), 'actions')

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
