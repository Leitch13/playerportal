/**
 * Phase 2.5 derive layer unit tests.
 *
 *   node scripts/_unit_tests_contact_derive.mjs
 *
 * Covers:
 *   • contactBucket: today / recent_7d / recent_30d / stale_30plus / never
 *   • formatContactAge: 'Today' / 'Yesterday' / 'N days ago' / 'Never'
 *   • matchesContactFilter: 3 keys, boundary cases on day=30, day=31
 *   • contactNeedsAttention: never+stale = true; recent variants = false
 *   • Mixed input handling: null signal, null lastIso, bad ISO string
 */

const NOW = Date.UTC(2026, 5, 15) // 2026-06-15 UTC

// ─── Re-implementations (kept in sync with src/lib/contact-derive.ts) ─
const STALE_DAYS = 30
const startOfUtcDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const parseSafe = (s) => { const ms = Date.parse(/[T ]/.test(s) ? s : s + 'T00:00:00Z'); return isNaN(ms) ? null : ms }

function contactBucket(signal, nowMs = NOW) {
  if (!signal || !signal.lastIso) return 'never'
  const ms = parseSafe(signal.lastIso)
  if (ms === null) return 'never'
  const days = Math.floor((startOfUtcDay(nowMs) - startOfUtcDay(ms)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days <= 7) return 'recent_7d'
  if (days <= STALE_DAYS) return 'recent_30d'
  return 'stale_30plus'
}

function formatContactAge(signal, nowMs = NOW) {
  if (!signal || !signal.lastIso) return 'Never'
  const ms = parseSafe(signal.lastIso)
  if (ms === null) return 'Never'
  const days = Math.floor((startOfUtcDay(nowMs) - startOfUtcDay(ms)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function matchesContactFilter(signal, filter, nowMs = NOW) {
  const bucket = contactBucket(signal, nowMs)
  switch (filter) {
    case 'contacted_recently':
      return bucket === 'today' || bucket === 'recent_7d' || bucket === 'recent_30d'
    case 'not_contacted_30d':
      return bucket === 'stale_30plus'
    case 'never_contacted':
      return bucket === 'never'
    default:
      return false
  }
}

function contactNeedsAttention(signal, nowMs = NOW) {
  const bucket = contactBucket(signal, nowMs)
  return bucket === 'never' || bucket === 'stale_30plus'
}

// ─── Runner ───────────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}
const sig = (lastIso) => ({ lastIso, mostRecentMessageIso: lastIso, conversationCount: 0 })

console.log('\n──── PHASE 1 — contactBucket ────')

eq('null signal → never',              contactBucket(null), 'never')
eq('undefined signal → never',         contactBucket(undefined), 'never')
eq('null lastIso → never',             contactBucket(sig(null)), 'never')
eq('Today (same UTC day, midday)',     contactBucket(sig('2026-06-15T12:00:00Z')), 'today')
eq('Today (same UTC day, 00:00)',      contactBucket(sig('2026-06-15T00:00:00Z')), 'today')
eq('1 day ago → recent_7d',            contactBucket(sig('2026-06-14T00:00:00Z')), 'recent_7d')
eq('7 days ago → recent_7d',           contactBucket(sig('2026-06-08T00:00:00Z')), 'recent_7d')
eq('8 days ago → recent_30d',          contactBucket(sig('2026-06-07T00:00:00Z')), 'recent_30d')
eq('30 days ago → recent_30d (BOUNDARY)', contactBucket(sig('2026-05-16T00:00:00Z')), 'recent_30d')
eq('31 days ago → stale_30plus',       contactBucket(sig('2026-05-15T00:00:00Z')), 'stale_30plus')
eq('Future date → today (anomaly)',    contactBucket(sig('2026-07-01T00:00:00Z')), 'today')
eq('Bad ISO string → never',           contactBucket(sig('banana')), 'never')
eq('Bare date (YYYY-MM-DD) handled',   contactBucket(sig('2026-06-14')), 'recent_7d')

console.log('\n──── PHASE 2 — formatContactAge ────')

eq('null signal → Never',          formatContactAge(null), 'Never')
eq('null lastIso → Never',         formatContactAge(sig(null)), 'Never')
eq('today → Today',                formatContactAge(sig('2026-06-15T08:00:00Z')), 'Today')
eq('1 day ago → Yesterday',        formatContactAge(sig('2026-06-14T00:00:00Z')), 'Yesterday')
eq('3 days ago → "3 days ago"',    formatContactAge(sig('2026-06-12T00:00:00Z')), '3 days ago')
eq('14 days ago → "14 days ago"',  formatContactAge(sig('2026-06-01T00:00:00Z')), '14 days ago')
eq('60 days ago → "60 days ago"',  formatContactAge(sig('2026-04-16T00:00:00Z')), '60 days ago')

console.log('\n──── PHASE 3 — matchesContactFilter (BOUNDARIES) ────')

const s_today = sig('2026-06-15T00:00:00Z')
const s_5d    = sig('2026-06-10T00:00:00Z')
const s_30d   = sig('2026-05-16T00:00:00Z')  // exactly 30 days ago
const s_31d   = sig('2026-05-15T00:00:00Z')  // 31 days ago
const s_60d   = sig('2026-04-16T00:00:00Z')
const s_never = null

eq('today → contacted_recently',        matchesContactFilter(s_today, 'contacted_recently'), true)
eq('today → not not_contacted_30d',     matchesContactFilter(s_today, 'not_contacted_30d'),  false)
eq('today → not never_contacted',       matchesContactFilter(s_today, 'never_contacted'),    false)
eq('5d → contacted_recently',           matchesContactFilter(s_5d, 'contacted_recently'),    true)
eq('30d → contacted_recently (BOUND)',  matchesContactFilter(s_30d, 'contacted_recently'),   true)
eq('30d → NOT not_contacted_30d',       matchesContactFilter(s_30d, 'not_contacted_30d'),    false)
eq('31d → NOT contacted_recently',      matchesContactFilter(s_31d, 'contacted_recently'),   false)
eq('31d → not_contacted_30d',           matchesContactFilter(s_31d, 'not_contacted_30d'),    true)
eq('60d → not_contacted_30d',           matchesContactFilter(s_60d, 'not_contacted_30d'),    true)
eq('never → never_contacted',           matchesContactFilter(s_never, 'never_contacted'),    true)
eq('never → NOT contacted_recently',    matchesContactFilter(s_never, 'contacted_recently'), false)
eq('never → NOT not_contacted_30d',     matchesContactFilter(s_never, 'not_contacted_30d'),  false)

console.log('\n──── PHASE 4 — contactNeedsAttention ────')

eq('never → attention',           contactNeedsAttention(s_never), true)
eq('31d → attention',              contactNeedsAttention(s_31d), true)
eq('60d → attention',              contactNeedsAttention(s_60d), true)
eq('30d → NOT attention (BOUND)',  contactNeedsAttention(s_30d), false)
eq('5d → NOT attention',           contactNeedsAttention(s_5d), false)
eq('today → NOT attention',        contactNeedsAttention(s_today), false)

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
