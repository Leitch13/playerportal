/**
 * Tests for src/lib/parents-derive.ts — search/filter/sort helpers for the
 * Parents List v2 page (Phase 2.3a).
 *
 * Run with:  node scripts/_unit_tests_parents_derive.mjs
 */

// ─── Re-implementations (kept in sync with src/lib/parents-derive.ts) ──
function parentSearchHay(r) {
  return [r.parentName, r.parentEmail || '', r.parentPhone || '', r.childrenNames.join(' ')].join(' ').toLowerCase()
}

function needsAttention(r) {
  return r.badges.some(b => b.key !== 'sibling_eligible')
}

function parentMatchesFilter(r, filter) {
  if (filter === 'all') return true
  if (filter === 'healthy')         return r.billingStatus === 'healthy'
  if (filter === 'payment_issues')  return r.billingStatus === 'payment_issue'
  if (filter === 'pending_starts')  return r.billingStatus === 'pending_start' || r.badges.some(b => b.key === 'pending_start')
  if (filter === 'trials')          return r.badges.some(b => b.key === 'trial_expiring')
  if (filter === 'no_attendance_30d') return r.badges.some(b => b.key === 'no_attendance_30d')
  if (filter === 'review_due')      return r.badges.some(b => b.key === 'review_due')
  if (filter === 'attention')       return needsAttention(r)
  return true
}

function compareParents(a, b, key) {
  switch (key) {
    case 'children': {
      if (a.childCount !== b.childCount) return b.childCount - a.childCount
      return a.parentName.localeCompare(b.parentName)
    }
    case 'value': {
      if (a.familyValue !== b.familyValue) return b.familyValue - a.familyValue
      return a.parentName.localeCompare(b.parentName)
    }
    case 'joined': return b.joinedAtIso.localeCompare(a.joinedAtIso)
    case 'name':
    default: return a.parentName.localeCompare(b.parentName)
  }
}

// ─── Runner ────────────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

// Helper to construct a row. Uses `in` so explicit nulls are preserved
// (the `??` operator would coerce them to the default).
const row = (over = {}) => ({
  id: 'id' in over ? over.id : 'p1',
  parentName: 'parentName' in over ? over.parentName : 'John Smith',
  parentEmail: 'parentEmail' in over ? over.parentEmail : 'john@example.com',
  parentPhone: 'parentPhone' in over ? over.parentPhone : '07700900100',
  childCount: 'childCount' in over ? over.childCount : 1,
  childrenNames: 'childrenNames' in over ? over.childrenNames : ['Ollie Smith'],
  familyValue: 'familyValue' in over ? over.familyValue : 60,
  billingStatus: 'billingStatus' in over ? over.billingStatus : 'healthy',
  badges: 'badges' in over ? over.badges : [],
  joinedAtIso: 'joinedAtIso' in over ? over.joinedAtIso : '2026-01-15',
})

console.log('\n──── PHASE 1 — parentSearchHay ────')
{
  const r = row({ parentName: 'Helen Hay', parentEmail: 'uad0403167@hotmail.co.uk', parentPhone: '07973313926', childrenNames: ['Lewis Hay', 'Mia Hay'] })
  const hay = parentSearchHay(r)
  eq('contains parent name (lowercased)',  hay.includes('helen hay'), true)
  eq('contains email',                     hay.includes('uad0403167@hotmail.co.uk'), true)
  eq('contains phone',                     hay.includes('07973313926'), true)
  eq('contains child first name',          hay.includes('lewis'), true)
  eq('contains child full name',           hay.includes('mia hay'), true)
  eq('does NOT contain unrelated string',  hay.includes('xyz999'), false)
}
{
  // Empty fields — hay still safe
  const r = row({ parentEmail: null, parentPhone: null, childrenNames: [] })
  eq('null fields → safe hay (just name)', parentSearchHay(r).trim(), 'john smith')
}

console.log('\n──── PHASE 2 — parentMatchesFilter — basic filters ────')
{
  const healthy = row({ billingStatus: 'healthy' })
  const past_due = row({ billingStatus: 'payment_issue' })
  const pending = row({ billingStatus: 'pending_start' })
  const none = row({ billingStatus: 'none' })

  eq('all matches everyone (1)',  parentMatchesFilter(healthy, 'all'), true)
  eq('all matches everyone (2)',  parentMatchesFilter(none, 'all'), true)
  eq('healthy filter',            parentMatchesFilter(healthy, 'healthy'), true)
  eq('healthy filter excludes past_due', parentMatchesFilter(past_due, 'healthy'), false)
  eq('payment_issues',            parentMatchesFilter(past_due, 'payment_issues'), true)
  eq('payment_issues excludes healthy', parentMatchesFilter(healthy, 'payment_issues'), false)
  eq('pending_starts via billing',  parentMatchesFilter(pending, 'pending_starts'), true)
  eq('pending_starts via badge',    parentMatchesFilter(row({ billingStatus: 'healthy', badges: [{ key: 'pending_start', label: '', tone: 'amber', emoji: '⏳' }] }), 'pending_starts'), true)
}

console.log('\n──── PHASE 3 — badge-driven filters ────')
{
  const trial = row({ badges: [{ key: 'trial_expiring', label: 'Trial expiring (7d)', tone: 'sky', emoji: '🔵' }] })
  const dormant = row({ badges: [{ key: 'no_attendance_30d', label: 'No attendance (30d)', tone: 'amber', emoji: '⏰' }] })
  const reviewdue = row({ badges: [{ key: 'review_due', label: 'Review due: 2', tone: 'amber', emoji: '📋' }] })
  const plain = row({ badges: [] })

  eq('trials filter matches trial badge',    parentMatchesFilter(trial, 'trials'), true)
  eq('trials filter excludes no badge',      parentMatchesFilter(plain, 'trials'), false)
  eq('no_attendance_30d matches',            parentMatchesFilter(dormant, 'no_attendance_30d'), true)
  eq('review_due matches',                   parentMatchesFilter(reviewdue, 'review_due'), true)
}

console.log('\n──── PHASE 4 — attention super-filter ────')
{
  const onlyGood = row({ badges: [] })
  const onlySibling = row({ badges: [{ key: 'sibling_eligible', label: 'Sibling discount eligible', tone: 'emerald', emoji: '👨‍👩‍👧' }] })
  const oneIssue = row({ badges: [{ key: 'payment_issue', label: 'Payment issue', tone: 'rose', emoji: '⚠️' }] })
  const mixed   = row({ badges: [
    { key: 'sibling_eligible', label: '', tone: 'emerald', emoji: '👨‍👩‍👧' },
    { key: 'review_due', label: '', tone: 'amber', emoji: '📋' },
  ] })

  eq('no badges → not attention',           needsAttention(onlyGood), false)
  eq('only sibling badge → not attention',  needsAttention(onlySibling), false)
  eq('payment_issue badge → attention',     needsAttention(oneIssue), true)
  eq('sibling + review_due → attention',    needsAttention(mixed), true)

  eq('filter=attention selects oneIssue',   parentMatchesFilter(oneIssue, 'attention'), true)
  eq('filter=attention skips sibling-only', parentMatchesFilter(onlySibling, 'attention'), false)
  eq('filter=attention skips plain',        parentMatchesFilter(onlyGood, 'attention'), false)
}

console.log('\n──── PHASE 5 — compareParents (sort) ────')
{
  const a = row({ parentName: 'Alice', childCount: 1, familyValue: 60, joinedAtIso: '2026-03-01' })
  const b = row({ parentName: 'Bob',   childCount: 3, familyValue: 180, joinedAtIso: '2026-05-01' })
  const c = row({ parentName: 'Carol', childCount: 2, familyValue: 90, joinedAtIso: '2026-04-01' })

  // Sort by name → A, B, C
  const byName = [a, b, c].sort((x, y) => compareParents(x, y, 'name')).map(r => r.parentName)
  eq('name sort → A, B, C', byName, ['Alice', 'Bob', 'Carol'])

  // Sort by children (most first) → B(3), C(2), A(1)
  const byKids = [a, b, c].sort((x, y) => compareParents(x, y, 'children')).map(r => r.parentName)
  eq('children sort → most first', byKids, ['Bob', 'Carol', 'Alice'])

  // Sort by value (highest first) → B(180), C(90), A(60)
  const byValue = [a, b, c].sort((x, y) => compareParents(x, y, 'value')).map(r => r.parentName)
  eq('value sort → highest first', byValue, ['Bob', 'Carol', 'Alice'])

  // Sort by joined (newest first) → B(2026-05), C(2026-04), A(2026-03)
  const byJoined = [a, b, c].sort((x, y) => compareParents(x, y, 'joined')).map(r => r.parentName)
  eq('joined sort → newest first', byJoined, ['Bob', 'Carol', 'Alice'])

  // Tie-break: same children count, alphabetic
  const aa = row({ id: 'a', parentName: 'Alice', childCount: 2 })
  const bb = row({ id: 'b', parentName: 'Bob',   childCount: 2 })
  const tied = [bb, aa].sort((x, y) => compareParents(x, y, 'children')).map(r => r.parentName)
  eq('children sort ties → alphabetic', tied, ['Alice', 'Bob'])
}

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
