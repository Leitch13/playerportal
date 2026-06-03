/**
 * Phase 2.4 step 3 unit tests — derives + parent matching.
 *
 * Verifies:
 *   • deriveTrialFollowUpBadge maps stages → badges correctly
 *   • pickMoreUrgentStage produces the right priority
 *   • parents-derive's new `trial_followup` filter matches the badge keys
 *   • The page's FK-first / email-second matching is deterministic
 *
 * Pure — no DB. Run with:
 *   node scripts/_unit_tests_trial_followup_parents.mjs
 */

// ─── Re-implementations ────────────────────────────────────────────────
function deriveTrialFollowUpBadge(stage) {
  if (stage === 'stale_followup') return { key: 'trial_stale_followup', label: 'Stale trial follow-up', tone: 'rose', emoji: '⏰' }
  if (stage === 'awaiting_followup') return { key: 'trial_followup_due', label: 'Trial follow-up due', tone: 'amber', emoji: '⏰' }
  return null
}
function pickMoreUrgentStage(a, b) {
  if (a === 'stale_followup' || b === 'stale_followup') return 'stale_followup'
  if (a === 'awaiting_followup' || b === 'awaiting_followup') return 'awaiting_followup'
  return a
}

function parentMatchesTrialFollowUp(r) {
  return r.badges.some(b => b.key === 'trial_followup_due' || b.key === 'trial_stale_followup')
}

// Simulates the page-level FK-first / email-second match step.
function matchFollowUpsToParents(parents, followUps) {
  const fkMap = new Map(), emailMap = new Map()
  for (const f of followUps) {
    if (f.parentId) {
      const prev = fkMap.get(f.parentId)
      fkMap.set(f.parentId, prev ? pickMoreUrgentStage(prev, f.stage) : f.stage)
    } else if (f.parentEmail) {
      const key = f.parentEmail.trim().toLowerCase()
      if (key) {
        const prev = emailMap.get(key)
        emailMap.set(key, prev ? pickMoreUrgentStage(prev, f.stage) : f.stage)
      }
    }
  }
  return parents.map(p => {
    const fk = fkMap.get(p.id) ?? null
    const email = p.email ? emailMap.get(p.email.trim().toLowerCase()) ?? null : null
    let stage = null
    if (fk && email) stage = pickMoreUrgentStage(fk, email)
    else stage = fk ?? email
    const badge = stage ? deriveTrialFollowUpBadge(stage) : null
    return { id: p.id, badges: badge ? [badge] : [], stage }
  })
}

// ─── Runner ────────────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

console.log('\n──── PHASE 1 — deriveTrialFollowUpBadge ────')

eq('awaiting_followup → amber badge',
  deriveTrialFollowUpBadge('awaiting_followup'),
  { key: 'trial_followup_due', label: 'Trial follow-up due', tone: 'amber', emoji: '⏰' })
eq('stale_followup → rose badge',
  deriveTrialFollowUpBadge('stale_followup'),
  { key: 'trial_stale_followup', label: 'Stale trial follow-up', tone: 'rose', emoji: '⏰' })
eq('today → null',          deriveTrialFollowUpBadge('today'), null)
eq('converted → null',      deriveTrialFollowUpBadge('converted'), null)
eq('lost → null',           deriveTrialFollowUpBadge('lost'), null)
eq('upcoming → null',       deriveTrialFollowUpBadge('upcoming'), null)
eq('followed_up → null',    deriveTrialFollowUpBadge('followed_up'), null)

console.log('\n──── PHASE 2 — pickMoreUrgentStage ────')

eq('stale vs awaiting → stale',   pickMoreUrgentStage('stale_followup', 'awaiting_followup'), 'stale_followup')
eq('awaiting vs stale → stale',   pickMoreUrgentStage('awaiting_followup', 'stale_followup'), 'stale_followup')
eq('awaiting vs awaiting → awaiting', pickMoreUrgentStage('awaiting_followup', 'awaiting_followup'), 'awaiting_followup')
eq('stale vs stale → stale',      pickMoreUrgentStage('stale_followup', 'stale_followup'), 'stale_followup')
eq('today vs awaiting → awaiting', pickMoreUrgentStage('today', 'awaiting_followup'), 'awaiting_followup')

console.log('\n──── PHASE 3 — parentMatchesFilter (trial_followup) ────')

const noBadge = { id: 'p1', badges: [] }
const followBadge = { id: 'p2', badges: [{ key: 'trial_followup_due' }] }
const staleBadge = { id: 'p3', badges: [{ key: 'trial_stale_followup' }] }
const siblingOnly = { id: 'p4', badges: [{ key: 'sibling_eligible' }] }
const mixed = { id: 'p5', badges: [{ key: 'review_due' }, { key: 'trial_followup_due' }] }

eq('no badges → no match',          parentMatchesTrialFollowUp(noBadge), false)
eq('awaiting badge → match',        parentMatchesTrialFollowUp(followBadge), true)
eq('stale badge → match',           parentMatchesTrialFollowUp(staleBadge), true)
eq('sibling_eligible only → no',    parentMatchesTrialFollowUp(siblingOnly), false)
eq('mixed badges incl follow → yes', parentMatchesTrialFollowUp(mixed), true)

console.log('\n──── PHASE 4 — FK-first / email-second matching ────')

const parents = [
  { id: 'par-A', email: 'a@x.com' },
  { id: 'par-B', email: 'B@X.com' }, // case-tolerant
  { id: 'par-C', email: null },       // no email
  { id: 'par-D', email: 'd@x.com' },  // no follow-up at all
]
const followUps = [
  // Enrolment-source, FK match for par-A, stale
  { parentId: 'par-A', parentEmail: 'a@x.com', stage: 'stale_followup' },
  // Booking-source, no FK, email match for par-B
  { parentId: null, parentEmail: 'b@x.com', stage: 'awaiting_followup' },
  // Booking-source, no FK, no match — should be silently dropped
  { parentId: null, parentEmail: 'orphan@x.com', stage: 'awaiting_followup' },
  // Booking-source for par-A (also has FK match) — should pick the more urgent
  { parentId: null, parentEmail: 'a@x.com', stage: 'awaiting_followup' },
  // No parentId AND no email — fully orphan
  { parentId: null, parentEmail: null, stage: 'stale_followup' },
]

const matched = matchFollowUpsToParents(parents, followUps)
eq('par-A FK match wins; remains stale_followup',
  matched.find(m => m.id === 'par-A').stage, 'stale_followup')
eq('par-A gets the stale badge',
  matched.find(m => m.id === 'par-A').badges[0].key, 'trial_stale_followup')
eq('par-B email-only match → awaiting_followup',
  matched.find(m => m.id === 'par-B').stage, 'awaiting_followup')
eq('par-B gets the awaiting badge',
  matched.find(m => m.id === 'par-B').badges[0].key, 'trial_followup_due')
eq('par-C (no email) → no badge',
  matched.find(m => m.id === 'par-C').badges.length, 0)
eq('par-D (no matching follow-up) → no badge',
  matched.find(m => m.id === 'par-D').badges.length, 0)
eq('orphan booking row (no FK, no email match) silently dropped — par count unaffected',
  matched.length, parents.length)

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
