/**
 * The class register: small rules shared by the page and its tests.
 *
 * Until Oct 2026 running a session meant four pages: the class (names only),
 * Attendance (ticks, nothing else), Print register, and Players (who has paid).
 * None showed a child's age or flagged a medical note. The class page is now the
 * register, in the pattern the camp day register set: one list, a tick, an age,
 * flags you can see before you tap, and everything about the child one tap away.
 */
export type Mark = 'present' | 'absent' | 'unmarked'

/** Tapping the circle goes round: not marked → here → away → not marked. */
export function nextMark(m: Mark): Mark {
  return m === 'unmarked' ? 'present' : m === 'present' ? 'absent' : 'unmarked'
}

/** Age in whole years on a given day (YYYY-MM-DD). Null when there is no usable date of birth. */
export function ageOn(dob: string | null | undefined, on: string): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return null
  const [y, m, d] = dob.slice(0, 10).split('-').map(Number), [Y, M, D] = on.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d || !Y) return null
  const age = Y - y - (M < m || (M === m && D < d) ? 1 : 0)
  return age >= 0 && age < 120 ? age : null
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** "Saturday" for 2026-10-17. */
export function weekdayOf(iso: string): string {
  return DAYS[new Date(iso.slice(0, 10) + 'T00:00:00Z').getUTCDay()] || ''
}

/** The most recent date on or before `today` that falls on the class's day; `today` if the class has no set day. */
export function latestClassDate(today: string, classDay: string | null | undefined): string {
  const want = DAYS.indexOf(classDay || '')
  if (want < 0) return today
  const d = new Date(today + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - want + 7) % 7))
  return d.toISOString().slice(0, 10)
}

export function countMarks(ids: string[], marks: Record<string, Mark | undefined>): { present: number; absent: number; unmarked: number } {
  let present = 0, absent = 0
  for (const id of ids) { if (marks[id] === 'present') present++; else if (marks[id] === 'absent') absent++ }
  return { present, absent, unmarked: ids.length - present - absent }
}

const csvCell = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
/** A register as CSV text: one header row, one row per child. */
export function registerCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}
