/**
 * Tests for src/lib/players-derive.ts — pure derivation helpers used by the
 * Players List v2. Re-implements each helper in vanilla JS so the tests run
 * without a TS compile step, then asserts behaviour across the cases that
 * matter for the new filter / sort / chip semantics.
 *
 * Run with:  node scripts/_unit_tests_players_derive.mjs
 */

const NOW = Date.UTC(2026, 5, 2) // 2026-06-02 00:00:00 UTC — stable test clock

// ─── Re-implementations (kept in sync with src/lib/players-derive.ts) ──
function deriveAge(dobIso, nowMs = NOW) {
  if (!dobIso) return null
  const dob = new Date(dobIso)
  if (isNaN(dob.getTime())) return null
  const now = new Date(nowMs)
  let age = now.getUTCFullYear() - dob.getUTCFullYear()
  const m = now.getUTCMonth() - dob.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--
  return age < 0 ? null : age
}

function summariseAttendance(rows) {
  const byPlayer = new Map()
  for (const r of rows) {
    const prev = byPlayer.get(r.player_id) || { present: 0, total: 0, lastDateIso: null }
    prev.total += 1
    if (r.present) prev.present += 1
    if (!prev.lastDateIso || r.session_date > prev.lastDateIso) prev.lastDateIso = r.session_date
    byPlayer.set(r.player_id, prev)
  }
  const out = new Map()
  for (const [pid, agg] of byPlayer) {
    out.set(pid, {
      present: agg.present,
      total: agg.total,
      pct: agg.total > 0 ? Math.round((agg.present / agg.total) * 100) : null,
      lastDateIso: agg.lastDateIso,
    })
  }
  return out
}

function daysSinceIso(iso, nowMs = NOW) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000))
}

function deriveSubStatus(subs) {
  if (!subs || subs.length === 0) return 'none'
  const set = new Set(subs.map(s => (s.status || '').toLowerCase()))
  if (set.has('past_due')) return 'past_due'
  if (set.has('active') || set.has('trialing')) return 'active'
  if (set.has('scheduled')) return 'pending'
  return 'cancelled'
}

function deriveRowStatus(enrolments) {
  if (!enrolments || enrolments.length === 0) return 'inactive'
  if (enrolments.some(e => (e.status || '') === 'active' && !e.is_trial)) return 'active'
  if (enrolments.some(e => e.is_trial && ((e.status || '') === 'active' || (e.status || '') === 'pending'))) return 'trial'
  if (enrolments.some(e => (e.status || '') === 'pending')) return 'pending'
  if (enrolments.some(e => (e.status || '') === 'paused')) return 'paused'
  return 'inactive'
}

function deriveReviewDue(latestReviewDateIso, nowMs = NOW) {
  if (!latestReviewDateIso) return true
  const t = new Date(latestReviewDateIso).getTime()
  if (isNaN(t)) return false
  return (nowMs - t) > 30 * 86_400_000
}

function deriveActiveClassNames(enrolments) {
  if (!enrolments) return ''
  return enrolments.filter(e => (e.status || '') === 'active').map(e => e.group?.name).filter(Boolean).join(', ')
}

// ─── Test runner ───────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

console.log('\n──── PHASE 1 — deriveAge ────')
eq('null DOB → null', deriveAge(null), null)
eq('Invalid DOB → null', deriveAge('not-a-date'), null)
eq('DOB exactly today\'s anniversary → exact age', deriveAge('2018-06-02'), 8)
eq('DOB today minus 1 day → age - 1 not yet bumped', deriveAge('2018-06-03'), 7) // birthday tomorrow
eq('DOB yesterday\'s anniversary → birthday has passed', deriveAge('2018-06-01'), 8)
eq('Born after now (impossible) → null', deriveAge('2030-01-01'), null)

console.log('\n──── PHASE 2 — summariseAttendance ────')
{
  const rows = [
    { player_id: 'p1', session_date: '2026-05-15', present: true },
    { player_id: 'p1', session_date: '2026-05-22', present: false },
    { player_id: 'p1', session_date: '2026-05-29', present: true },
    { player_id: 'p1', session_date: '2026-06-01', present: true },
    { player_id: 'p2', session_date: '2026-05-15', present: false },
    { player_id: 'p2', session_date: '2026-05-22', present: false },
  ]
  const out = summariseAttendance(rows)
  eq('p1 total=4, present=3, pct=75, last=2026-06-01', out.get('p1'), { present: 3, total: 4, pct: 75, lastDateIso: '2026-06-01' })
  eq('p2 total=2, present=0, pct=0, last=2026-05-22', out.get('p2'), { present: 0, total: 2, pct: 0, lastDateIso: '2026-05-22' })
  eq('No player p99 → undefined', out.get('p99'), undefined)
}
eq('Empty → empty map (size 0)', summariseAttendance([]).size, 0)

console.log('\n──── PHASE 3 — daysSinceIso ────')
eq('null → null', daysSinceIso(null), null)
eq('today → 0', daysSinceIso('2026-06-02'), 0)
eq('yesterday → 1', daysSinceIso('2026-06-01'), 1)
eq('30 days ago → 30', daysSinceIso('2026-05-03'), 30)
eq('Future date → 0 (clamped)', daysSinceIso('2026-12-01'), 0)
eq('Garbage → null', daysSinceIso('banana'), null)

console.log('\n──── PHASE 4 — deriveSubStatus ────')
eq('null subs → none', deriveSubStatus(null), 'none')
eq('empty array → none', deriveSubStatus([]), 'none')
eq('past_due wins over active', deriveSubStatus([{ status: 'active' }, { status: 'past_due' }]), 'past_due')
eq('active alone → active', deriveSubStatus([{ status: 'active' }]), 'active')
eq('trialing → active', deriveSubStatus([{ status: 'trialing' }]), 'active')
eq('only scheduled → pending', deriveSubStatus([{ status: 'scheduled' }]), 'pending')
eq('only cancelled → cancelled', deriveSubStatus([{ status: 'cancelled' }]), 'cancelled')
eq('Case-insensitive: PAST_DUE → past_due', deriveSubStatus([{ status: 'PAST_DUE' }]), 'past_due')

console.log('\n──── PHASE 5 — deriveRowStatus ────')
eq('null → inactive', deriveRowStatus(null), 'inactive')
eq('empty → inactive', deriveRowStatus([]), 'inactive')
eq('non-trial active wins over pending', deriveRowStatus([{ status: 'active' }, { status: 'pending' }]), 'active')
eq('Active-trial → trial (not active)', deriveRowStatus([{ status: 'active', is_trial: true }]), 'trial')
eq('Active-trial + non-trial active → active wins', deriveRowStatus([{ status: 'active', is_trial: true }, { status: 'active', is_trial: false }]), 'active')
eq('Only pending → pending', deriveRowStatus([{ status: 'pending' }]), 'pending')
eq('Only paused → paused', deriveRowStatus([{ status: 'paused' }]), 'paused')
eq('Only cancelled → inactive', deriveRowStatus([{ status: 'cancelled' }]), 'inactive')

console.log('\n──── PHASE 6 — deriveReviewDue ────')
eq('Never reviewed → due', deriveReviewDue(null), true)
eq('Reviewed today → not due', deriveReviewDue('2026-06-02'), false)
eq('Reviewed 29 days ago → not due', deriveReviewDue('2026-05-04'), false)
eq('Reviewed 31 days ago → due', deriveReviewDue('2026-05-02'), true)
eq('Reviewed 365 days ago → due', deriveReviewDue('2025-06-02'), true)
eq('Garbage date → not due (safe fallback)', deriveReviewDue('banana'), false)

console.log('\n──── PHASE 7 — deriveActiveClassNames ────')
eq('null → ""', deriveActiveClassNames(null), '')
eq('empty → ""', deriveActiveClassNames([]), '')
eq('Filters non-active out', deriveActiveClassNames([
  { status: 'active', group: { name: 'U10 Mon' } },
  { status: 'cancelled', group: { name: 'U8 Wed' } },
  { status: 'pending', group: { name: 'U12 Fri' } },
]), 'U10 Mon')
eq('Two actives → joined', deriveActiveClassNames([
  { status: 'active', group: { name: 'U10 Mon' } },
  { status: 'active', group: { name: 'Mini Ballers Thu' } },
]), 'U10 Mon, Mini Ballers Thu')
eq('Null group safely dropped', deriveActiveClassNames([
  { status: 'active', group: null },
  { status: 'active', group: { name: 'U10 Mon' } },
]), 'U10 Mon')

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
