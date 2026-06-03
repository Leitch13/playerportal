/**
 * Tests for src/lib/recipients-validate.ts — Phase 2.3b URL recipients parser.
 *
 * Run with:  node scripts/_unit_tests_recipients_validate.mjs
 */

// ─── Re-implementation (kept in sync with src/lib/recipients-validate.ts) ──
const MAX_RECIPIENTS = 200

function validateRecipientsParam(raw, allowedRecipients) {
  let csv = ''
  if (Array.isArray(raw)) csv = raw.join(',')
  else if (typeof raw === 'string') csv = raw
  if (!csv.trim()) return { ids: [], labels: {}, droppedCount: 0, capApplied: false }

  const allowedMap = new Map()
  for (const r of allowedRecipients) {
    if (r.id) allowedMap.set(r.id, r.full_name || r.id)
  }

  const seen = new Set()
  const validated = []
  const labels = {}
  let dropped = 0

  for (const piece of csv.split(',')) {
    const id = piece.trim()
    if (!id) continue
    if (seen.has(id)) continue
    seen.add(id)
    if (!allowedMap.has(id)) {
      dropped++
      continue
    }
    validated.push(id)
    labels[id] = allowedMap.get(id)
  }

  const capApplied = validated.length > MAX_RECIPIENTS
  const final = capApplied ? validated.slice(0, MAX_RECIPIENTS) : validated
  return {
    ids: final,
    labels: final.reduce((acc, id) => { acc[id] = labels[id]; return acc }, {}),
    droppedCount: dropped,
    capApplied,
  }
}

// ─── Runner ────────────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

const ORG_ROSTER = [
  { id: 'p1', full_name: 'Helen Hay' },
  { id: 'p2', full_name: 'John Leitch' },
  { id: 'p3', full_name: 'Sarah Tester' },
]

console.log('\n──── PHASE 1 — empty / missing input ────')
eq('undefined → empty',   validateRecipientsParam(undefined, ORG_ROSTER).ids, [])
eq('null-equivalent →',   validateRecipientsParam('', ORG_ROSTER).ids, [])
eq('whitespace only →',   validateRecipientsParam('   ', ORG_ROSTER).ids, [])
eq('array with empties →', validateRecipientsParam(['', ' ', ''], ORG_ROSTER).ids, [])

console.log('\n──── PHASE 2 — valid IDs ────')
{
  const r = validateRecipientsParam('p1,p2', ORG_ROSTER)
  eq('Two valid IDs preserved in order', r.ids, ['p1', 'p2'])
  eq('Labels are attached', r.labels, { p1: 'Helen Hay', p2: 'John Leitch' })
  eq('No dropped', r.droppedCount, 0)
  eq('No cap', r.capApplied, false)
}

console.log('\n──── PHASE 3 — invalid/cross-org IDs are silently dropped ────')
{
  // p99 doesn't exist in roster (cross-org or made-up)
  const r = validateRecipientsParam('p1,p99,p2,unknown-id', ORG_ROSTER)
  eq('Cross-org IDs dropped', r.ids, ['p1', 'p2'])
  eq('Dropped count = 2', r.droppedCount, 2)
  eq('Labels only for valid', r.labels, { p1: 'Helen Hay', p2: 'John Leitch' })
}
{
  // All IDs are cross-org
  const r = validateRecipientsParam('xxx,yyy,zzz', ORG_ROSTER)
  eq('All cross-org → empty result', r.ids, [])
  eq('Dropped count = 3', r.droppedCount, 3)
}

console.log('\n──── PHASE 4 — dedupe + trimming ────')
{
  const r = validateRecipientsParam('p1, p1 ,p2,p1', ORG_ROSTER)
  eq('Duplicate p1 collapsed to one', r.ids, ['p1', 'p2'])
}

console.log('\n──── PHASE 5 — case-sensitivity ────')
{
  // UUIDs are case-sensitive — uppercase p1 ≠ lowercase p1
  const r = validateRecipientsParam('P1,p2', ORG_ROSTER)
  eq('Wrong-case ID treated as not allowed', r.ids, ['p2'])
  eq('And counted as dropped', r.droppedCount, 1)
}

console.log('\n──── PHASE 6 — array input ────')
{
  const r = validateRecipientsParam(['p1', 'p2,p3'], ORG_ROSTER)
  // Array entries are joined with comma then split — produces 'p1,p2,p3'
  eq('Array of strings joined + split', r.ids, ['p1', 'p2', 'p3'])
}

console.log('\n──── PHASE 7 — max-recipients cap ────')
{
  // Build a 250-id roster + 250 IDs in the param
  const big = []
  for (let i = 0; i < 250; i++) big.push({ id: `id${i}`, full_name: `Name ${i}` })
  const csv = big.map(r => r.id).join(',')
  const r = validateRecipientsParam(csv, big)
  eq('Cap at 200', r.ids.length, 200)
  eq('capApplied flag set', r.capApplied, true)
  eq('First 200 preserved', r.ids[0], 'id0')
  eq('Last in cap is 199', r.ids[199], 'id199')
}

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
