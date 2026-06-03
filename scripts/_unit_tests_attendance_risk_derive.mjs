/**
 * Phase 2.8 derive layer unit tests — Attendance Risk.
 *
 *   node scripts/_unit_tests_attendance_risk_derive.mjs
 *
 * Covers:
 *   • Boundary day handling (13 / 14 / 29 / 30)
 *   • never_attended vs drifted distinction kept intact
 *   • new_player gate (<14d enrolled, no records)
 *   • not_applicable when enrolment status ≠ active
 *   • Reason-first label strings (exact match)
 *   • Filter routing for the 3 chip keys
 *   • Same-day attendance ('Today') / yesterday / N days ago labels
 *   • Bad inputs degrade gracefully (null history, bad ISO)
 */

const NOW = Date.UTC(2026, 5, 15)  // 2026-06-15 UTC

const NEW_PLAYER_DAYS = 14
const MEDIUM_THRESHOLD_DAYS = 14
const HIGH_THRESHOLD_DAYS = 30

const startOfUtcDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const parseDateUtcStart = (s) => {
  const hasTime = /[T ]/.test(s)
  const raw = hasTime ? s : s + 'T00:00:00Z'
  const ms = Date.parse(raw)
  if (isNaN(ms)) return null
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function deriveAttendanceRisk(inputs) {
  const nowMs = inputs.nowMs ?? NOW
  const today = startOfUtcDay(nowMs)

  let lastAttendanceAt = null
  for (const r of (inputs.attendanceHistory || [])) {
    if (!r.present) continue
    if (!lastAttendanceAt || r.session_date > lastAttendanceAt) lastAttendanceAt = r.session_date
  }
  const attendedEver = lastAttendanceAt !== null
  let daysSinceAttendance = null
  if (lastAttendanceAt) {
    const ms = parseDateUtcStart(lastAttendanceAt)
    if (ms !== null) daysSinceAttendance = Math.max(0, Math.floor((today - ms) / 86_400_000))
  }
  let tenureDays = null
  if (inputs.enrolledAt) {
    const ms = parseDateUtcStart(inputs.enrolledAt)
    if (ms !== null) tenureDays = Math.max(0, Math.floor((today - ms) / 86_400_000))
  }
  const base = { lastAttendanceAt, attendedEver, daysSinceAttendance, tenureDays }

  const status = (inputs.enrolmentStatus || '').toLowerCase()
  if (status !== 'active') return { riskLevel: 'not_applicable', riskReason: { kind: 'not_applicable', label: '' }, ...base }

  if (attendedEver && daysSinceAttendance !== null) {
    if (daysSinceAttendance < MEDIUM_THRESHOLD_DAYS) {
      return { riskLevel: 'healthy', riskReason: { kind: 'recently_attended', daysSinceAttendance, label: '' }, ...base }
    }
    const isHigh = daysSinceAttendance >= HIGH_THRESHOLD_DAYS
    return { riskLevel: isHigh ? 'high' : 'medium', riskReason: { kind: 'drifted', daysSinceAttendance, ...(tenureDays !== null ? { tenureDays } : {}), label: `Drifted away (${daysSinceAttendance} days since attendance)` }, ...base }
  }

  if (tenureDays === null) return { riskLevel: 'not_applicable', riskReason: { kind: 'not_applicable', label: '' }, ...base }
  if (tenureDays < NEW_PLAYER_DAYS) return { riskLevel: 'new_player', riskReason: { kind: 'new_player', tenureDays, label: '' }, ...base }
  const isHigh = tenureDays >= HIGH_THRESHOLD_DAYS
  return { riskLevel: isHigh ? 'high' : 'medium', riskReason: { kind: 'never_attended', tenureDays, label: `Never attended (${tenureDays} days enrolled)` }, ...base }
}

function matchesAttendanceFilter(a, filter) {
  function atLeastN(n) {
    if (a.riskLevel === 'not_applicable') return false
    if (a.attendedEver && a.daysSinceAttendance !== null) return a.daysSinceAttendance >= n
    if (!a.attendedEver && a.tenureDays !== null) return a.tenureDays >= n
    return false
  }
  switch (filter) {
    case 'attendance_risk':   return a.riskLevel === 'high' || a.riskLevel === 'medium'
    case 'no_attendance_14d': return atLeastN(14)
    case 'no_attendance_30d': return atLeastN(30)
    default:                  return false
  }
}

function formatLastAttended(a) {
  if (!a.attendedEver) return 'Never'
  const d = a.daysSinceAttendance ?? 0
  if (d <= 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d} days ago`
}

// ─── Runner ───────────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}
const enrolDaysAgo = (n) => new Date(NOW - n * 86_400_000).toISOString()
const attendNDaysAgo = (n) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10)

console.log('\n──── PHASE 1 — Never-attended path (tenure-gated) ────')

eq('Active + no records + enrolled 5d → new_player',
  deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(5) }).riskLevel, 'new_player')
eq('Active + no records + enrolled 13d → new_player (boundary)',
  deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(13) }).riskLevel, 'new_player')
eq('Active + no records + enrolled 14d → medium (boundary just past new gate)',
  deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(14) }).riskLevel, 'medium')
eq('Active + no records + enrolled 20d → medium',
  deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(20) }).riskLevel, 'medium')
eq('Active + no records + enrolled 29d → medium',
  deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(29) }).riskLevel, 'medium')
eq('Active + no records + enrolled 30d → high (boundary)',
  deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(30) }).riskLevel, 'high')
eq('Active + no records + enrolled 90d → high',
  deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(90) }).riskLevel, 'high')

console.log('\n──── PHASE 2 — Drifted path ────')

const drift5 = deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(5), present: true }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(100) })
const drift14 = deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(14), present: true }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(100) })
const drift29 = deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(29), present: true }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(100) })
const drift30 = deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(30), present: true }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(100) })
const drift60 = deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(60), present: true }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(100) })

eq('Attended 5d ago → healthy', drift5.riskLevel, 'healthy')
eq('Attended 14d ago → medium drifted',           drift14.riskLevel, 'medium')
eq('Attended 14d ago → kind=drifted',             drift14.riskReason.kind, 'drifted')
eq('Attended 29d ago → medium (boundary)',         drift29.riskLevel, 'medium')
eq('Attended 30d ago → high (boundary)',           drift30.riskLevel, 'high')
eq('Attended 60d ago → high',                      drift60.riskLevel, 'high')

console.log('\n──── PHASE 3 — Reason-first label strings ────')

const labelNever32 = deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(32) }).riskReason.label
eq('Never label exact', labelNever32, 'Never attended (32 days enrolled)')

const labelDrift41 = deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(41), present: true }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(200) }).riskReason.label
eq('Drifted label exact', labelDrift41, 'Drifted away (41 days since attendance)')

eq('Healthy label is empty string',
  drift5.riskReason.label, '')
eq('new_player label is empty string',
  deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(5) }).riskReason.label, '')

console.log('\n──── PHASE 4 — Not applicable / edge inputs ────')

eq('Paused enrolment → not_applicable',
  deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'paused', enrolledAt: enrolDaysAgo(60) }).riskLevel, 'not_applicable')
eq('Cancelled enrolment → not_applicable',
  deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(60), present: true }], enrolmentStatus: 'cancelled', enrolledAt: enrolDaysAgo(60) }).riskLevel, 'not_applicable')
eq('Pending enrolment → not_applicable',
  deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'pending', enrolledAt: enrolDaysAgo(20) }).riskLevel, 'not_applicable')
eq('Missing enrolment date + no records → not_applicable',
  deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: null }).riskLevel, 'not_applicable')

eq('present=false rows are NOT counted as attendance',
  deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(2), present: false }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(30) }).riskLevel, 'high')
eq('present=false rows → attendedEver remains false',
  deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(2), present: false }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(30) }).attendedEver, false)

eq('Multiple rows → picks MOST RECENT present=true',
  deriveAttendanceRisk({
    attendanceHistory: [
      { session_date: attendNDaysAgo(60), present: true },
      { session_date: attendNDaysAgo(10), present: true },
      { session_date: attendNDaysAgo(30), present: true },
    ],
    enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(100),
  }).daysSinceAttendance, 10)

eq('Bad ISO string → degrades safely',
  deriveAttendanceRisk({ attendanceHistory: [{ session_date: 'not-a-date', present: true }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(60) }).riskLevel, 'high')
// Above: 'not-a-date' string-compares as the newest entry so attendedEver becomes true,
// but parseDateUtcStart returns null → daysSinceAttendance stays null → falls through
// the attendedEver-but-no-days branch and lands in the never-attended/tenure logic.

console.log('\n──── PHASE 5 — Filter routing ────')

const aHigh = deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(60) })
const aMed = deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(20) })
const aNew = deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(5) })
const aHealthy = drift5
const aNotApp = deriveAttendanceRisk({ attendanceHistory: [], enrolmentStatus: 'paused', enrolledAt: enrolDaysAgo(60) })

eq('high → attendance_risk match',     matchesAttendanceFilter(aHigh, 'attendance_risk'), true)
eq('medium → attendance_risk match',    matchesAttendanceFilter(aMed, 'attendance_risk'), true)
eq('new_player → NO attendance_risk',   matchesAttendanceFilter(aNew, 'attendance_risk'), false)
eq('healthy → NO attendance_risk',      matchesAttendanceFilter(aHealthy, 'attendance_risk'), false)
eq('not_applicable → NO attendance_risk', matchesAttendanceFilter(aNotApp, 'attendance_risk'), false)
eq('high (never 60d) → no_attendance_30d',  matchesAttendanceFilter(aHigh, 'no_attendance_30d'), true)
eq('medium (never 20d) → no_attendance_14d', matchesAttendanceFilter(aMed, 'no_attendance_14d'), true)
eq('medium (never 20d) → NOT no_attendance_30d', matchesAttendanceFilter(aMed, 'no_attendance_30d'), false)
eq('new_player → NOT no_attendance_14d',     matchesAttendanceFilter(aNew, 'no_attendance_14d'), false)
eq('not_applicable → NOT no_attendance_30d', matchesAttendanceFilter(aNotApp, 'no_attendance_30d'), false)
eq('drifted 30d → no_attendance_30d',       matchesAttendanceFilter(drift30, 'no_attendance_30d'), true)
eq('Unknown filter key → false',            matchesAttendanceFilter(aHigh, 'bogus'), false)

console.log('\n──── PHASE 6 — formatLastAttended ────')

eq('Never attended → Never',  formatLastAttended(aHigh), 'Never')
eq('Same-day attendance → Today',
  formatLastAttended(deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(0), present: true }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(100) })), 'Today')
eq('1 day ago → Yesterday',
  formatLastAttended(deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(1), present: true }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(100) })), 'Yesterday')
eq('7 days ago → "7 days ago"', formatLastAttended(deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(7), present: true }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(100) })), '7 days ago')
eq('24 days ago → "24 days ago"', formatLastAttended(deriveAttendanceRisk({ attendanceHistory: [{ session_date: attendNDaysAgo(24), present: true }], enrolmentStatus: 'active', enrolledAt: enrolDaysAgo(100) })), '24 days ago')

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
