/**
 * Pure unit tests for src/lib/billing/sessions.ts.
 *
 * Re-implements the helpers in vanilla JS so they run without a TS compile
 * step, then asserts the same inputs produce the same outputs across the
 * scenarios that matter for Jamie's plan structure.
 */

const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function countSessionsBetween(startISO, anchorISO, classDayOfWeek) {
  if (!classDayOfWeek) return 0
  const targetDow = DOW.indexOf(classDayOfWeek)
  if (targetDow < 0) return 0
  const cur = new Date(startISO + 'T00:00:00Z')
  const anchor = new Date(anchorISO + 'T00:00:00Z')
  if (!(cur < anchor)) return 0
  if (isNaN(cur.getTime()) || isNaN(anchor.getTime())) return 0
  let count = 0
  for (let i = 0; i < 40 && cur < anchor; i++) {
    if (cur.getUTCDay() === targetDow) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

function firstOfNextMonthUnix(d) {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  return Math.floor(Date.UTC(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 1) / 1000)
}

function generateSessionDates(todayISO, anchorISO, classDayOfWeek) {
  if (!classDayOfWeek) return []
  const targetDow = DOW.indexOf(classDayOfWeek)
  if (targetDow < 0) return []
  const cur = new Date(todayISO + 'T00:00:00Z')
  const anchor = new Date(anchorISO + 'T00:00:00Z')
  if (!(cur < anchor)) return []
  if (isNaN(cur.getTime()) || isNaN(anchor.getTime())) return []
  const dates = []
  for (let i = 0; i < 40 && cur < anchor; i++) {
    if (cur.getUTCDay() === targetDow) dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

function estimateBridgePence(args) {
  const { monthlyPence, sessionsPerMonth, classDayOfWeek, startDate } = args
  if (!sessionsPerMonth || sessionsPerMonth <= 0) return null
  if (!classDayOfWeek) return null
  if (!(monthlyPence > 0)) return null
  if (isNaN(startDate.getTime())) return null
  const anchorUnix = firstOfNextMonthUnix(startDate)
  const anchorISO = new Date(anchorUnix * 1000).toISOString().slice(0, 10)
  const startISO = startDate.toISOString().slice(0, 10)
  const sessionsRemaining = countSessionsBetween(startISO, anchorISO, classDayOfWeek)
  const perSessionPence = Math.round(monthlyPence / sessionsPerMonth)
  const uncappedPence = perSessionPence * sessionsRemaining
  const bridgePence = Math.min(uncappedPence, monthlyPence)
  return { sessionsRemaining, perSessionPence, uncappedPence, bridgePence, capApplied: uncappedPence > monthlyPence }
}

// ─── Test runner ────────────────────────────────────────────────
const results = []
function eq(name, got, want) {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass, got, want })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}
const phase = (n) => console.log(`\n──── ${n} ────`)

// ─── PHASE 1: countSessionsBetween ────────────────────────────────
phase('PHASE 1 — countSessionsBetween')
eq('Monday class, start 15 Jun (Mon)→1 Jul', countSessionsBetween('2026-06-15','2026-07-01','Monday'), 3)
eq('Monday class, start 22 Jun (Mon)→1 Jul', countSessionsBetween('2026-06-22','2026-07-01','Monday'), 2)
eq('Monday class, start 29 Jun (Mon)→1 Jul', countSessionsBetween('2026-06-29','2026-07-01','Monday'), 1)
eq('Monday class, start 30 Jun (Tue)→1 Jul', countSessionsBetween('2026-06-30','2026-07-01','Monday'), 0)
eq('Tuesday class, start 17 Jun (Tue)→1 Jul (Wed, excluded)', countSessionsBetween('2026-06-17','2026-07-01','Tuesday'), 2)
eq('Tuesday class, start 9 Jun (Tue)→1 Jul', countSessionsBetween('2026-06-09','2026-07-01','Tuesday'), 4)
eq('Empty window', countSessionsBetween('2026-07-01','2026-07-01','Tuesday'), 0)
eq('Inverted window', countSessionsBetween('2026-07-10','2026-07-01','Monday'), 0)
eq('No day-of-week', countSessionsBetween('2026-06-16','2026-07-01', null), 0)
eq('Invalid day-of-week', countSessionsBetween('2026-06-16','2026-07-01','Funday'), 0)
eq('5-Monday May 2026: start 1 May (Fri)→1 Jun', countSessionsBetween('2026-05-01','2026-06-01','Monday'), 4)
eq('5-Friday Jan 2026: start 1 Jan (Thu)→1 Feb', countSessionsBetween('2026-01-01','2026-02-01','Friday'), 5)

// ─── PHASE 2: estimateBridgePence — user-stated examples ─────────
phase('PHASE 2 — estimateBridgePence — user-stated examples')
// £120/4 = £30/session, 3 sessions → £90
eq('£120/4 Mon, start 15 Jun (Mon) → 3 sessions, £90',
  estimateBridgePence({ monthlyPence: 12000, sessionsPerMonth: 4, classDayOfWeek: 'Monday', startDate: new Date('2026-06-15T00:00:00Z') }),
  { sessionsRemaining: 3, perSessionPence: 3000, uncappedPence: 9000, bridgePence: 9000, capApplied: false })
// £120/4 = £30/session, 1 session → £30
eq('£120/4 Mon, start 29 Jun → 1 session, £30',
  estimateBridgePence({ monthlyPence: 12000, sessionsPerMonth: 4, classDayOfWeek: 'Monday', startDate: new Date('2026-06-29T00:00:00Z') }),
  { sessionsRemaining: 1, perSessionPence: 3000, uncappedPence: 3000, bridgePence: 3000, capApplied: false })
// £60/2 = £30/session, capped at £60
eq('£60/2 Mon, start 15 Jun (Mon) → 3 sessions raw, cap to £60',
  estimateBridgePence({ monthlyPence: 6000, sessionsPerMonth: 2, classDayOfWeek: 'Monday', startDate: new Date('2026-06-15T00:00:00Z') }),
  { sessionsRemaining: 3, perSessionPence: 3000, uncappedPence: 9000, bridgePence: 6000, capApplied: true })

// ─── PHASE 3: Cap behavior across edge cases ─────────────────────
phase('PHASE 3 — cap behavior')
// £120/4 in a 5-Monday-month window → 4 × £30 = £120 (= cap, capApplied=false because uncapped == cap)
eq('£120/4 Mon, start 4 May 2026 → 4 sessions, £120',
  estimateBridgePence({ monthlyPence: 12000, sessionsPerMonth: 4, classDayOfWeek: 'Monday', startDate: new Date('2026-05-04T00:00:00Z') }),
  { sessionsRemaining: 4, perSessionPence: 3000, uncappedPence: 12000, bridgePence: 12000, capApplied: false })
// 5-Friday Jan 2026 window for £120/4 → 5 × £30 = £150 capped to £120
eq('£120/4 Fri, start 1 Jan 2026 (Thu, includes 5 Fridays) → cap to £120',
  estimateBridgePence({ monthlyPence: 12000, sessionsPerMonth: 4, classDayOfWeek: 'Friday', startDate: new Date('2026-01-01T00:00:00Z') }),
  { sessionsRemaining: 5, perSessionPence: 3000, uncappedPence: 15000, bridgePence: 12000, capApplied: true })

// ─── PHASE 4: Fallback contract ────────────────────────────────────
phase('PHASE 4 — fallback contract (callers must use calendar mode)')
eq('null sessions_per_month → null', estimateBridgePence({ monthlyPence: 12000, sessionsPerMonth: null, classDayOfWeek: 'Monday', startDate: new Date('2026-06-16T00:00:00Z') }), null)
eq('0 sessions_per_month → null', estimateBridgePence({ monthlyPence: 12000, sessionsPerMonth: 0, classDayOfWeek: 'Monday', startDate: new Date('2026-06-16T00:00:00Z') }), null)
eq('null classDayOfWeek → null', estimateBridgePence({ monthlyPence: 12000, sessionsPerMonth: 4, classDayOfWeek: null, startDate: new Date('2026-06-16T00:00:00Z') }), null)
eq('0 monthlyPence → null', estimateBridgePence({ monthlyPence: 0, sessionsPerMonth: 4, classDayOfWeek: 'Monday', startDate: new Date('2026-06-16T00:00:00Z') }), null)

// ─── PHASE 5: Zero-session windows (rare but valid) ───────────────
phase('PHASE 5 — zero-session windows')
// No Monday in this window → 0 sessions, £0 bridge (caller decides if this is acceptable)
eq('Tuesday-only window: Mon class, start Tue, anchor next Mon → 0 sessions, £0',
  estimateBridgePence({ monthlyPence: 12000, sessionsPerMonth: 4, classDayOfWeek: 'Monday', startDate: new Date('2026-06-30T00:00:00Z') }),
  { sessionsRemaining: 0, perSessionPence: 3000, uncappedPence: 0, bridgePence: 0, capApplied: false })

// ─── PHASE 6: generateSessionDates ─────────────────────────────────
phase('PHASE 6 — generateSessionDates (class-day enumeration)')
eq('Monday class, full June window (start Mon 1 Jun)',
  generateSessionDates('2026-06-01', '2026-07-01', 'Monday'),
  ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'])
eq('Monday class, today is Tue (not Mon)',
  generateSessionDates('2026-06-02', '2026-07-01', 'Monday'),
  ['2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'])
eq('Tuesday class, today is Tue (today included)',
  generateSessionDates('2026-06-02', '2026-07-01', 'Tuesday'),
  ['2026-06-02', '2026-06-09', '2026-06-16', '2026-06-23', '2026-06-30'])
eq('Monday class, late month start → 1 session',
  generateSessionDates('2026-06-29', '2026-07-01', 'Monday'),
  ['2026-06-29'])
eq('Monday class, start day after last Mon → 0 sessions',
  generateSessionDates('2026-06-30', '2026-07-01', 'Monday'),
  [])
eq('Wednesday class through July (5 Weds in window)',
  generateSessionDates('2026-07-01', '2026-08-01', 'Wednesday'),
  ['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22', '2026-07-29'])
eq('null day-of-week → empty', generateSessionDates('2026-06-01', '2026-07-01', null), [])
eq('Empty window → empty', generateSessionDates('2026-07-01', '2026-07-01', 'Monday'), [])

// ─── SUMMARY ──────────────────────────────────────────────────────
phase('SUMMARY')
const passed = results.filter((r) => r.pass).length
const failed = results.filter((r) => !r.pass).length
console.log(`  ${passed} pass / ${failed} fail / ${results.length} total`)
if (failed > 0) {
  console.log('\n  Failed:')
  for (const r of results.filter((x) => !x.pass)) {
    console.log(`   ✗ ${r.name}: got ${JSON.stringify(r.got)}, want ${JSON.stringify(r.want)}`)
  }
}
process.exit(failed > 0 ? 1 : 0)
