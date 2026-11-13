/**
 * The earliest date a parent can start a class.
 *
 * A class in a term (block) that hasn't started yet starts on the term's first
 * class day — never before. John, 17 Oct 2026, CFCoaching's CFC INTRO starting
 * Monday 2 November: the sign-up page offered (and pre-selected) Mondays in
 * October, so a parent tapping through would have paid for sessions that don't
 * exist. "needed please if they pick it on term". Same for every academy.
 *
 * Used by the start-date picker (what is offered) and the subscribe route
 * (what is accepted), so the page and the server always agree.
 */

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The first class day on or after `fromIso` (any day when the class has no set day). */
export function firstClassDayOnOrAfter(fromIso: string, classDayOfWeek: string | null | undefined): string {
  const target = classDayOfWeek ? DOW.indexOf(classDayOfWeek) : -1
  if (target < 0) return fromIso
  const d = new Date(fromIso + 'T00:00:00Z')
  while (d.getUTCDay() !== target) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** The earliest start: today, or the term's first class day if the term starts later. */
export function earliestStart(todayIso: string, termStartIso: string | null | undefined, classDayOfWeek: string | null | undefined): string {
  const from = termStartIso && termStartIso > todayIso ? termStartIso : todayIso
  return termStartIso && termStartIso > todayIso ? firstClassDayOnOrAfter(from, classDayOfWeek) : from
}

/** True when the class's term hasn't started yet. */
export function termNotStarted(todayIso: string, termStartIso: string | null | undefined): boolean {
  return !!termStartIso && termStartIso > todayIso
}

/**
 * How far ahead a parent can book. John, 13 Nov 2026 (Caolan's full classes, a
 * new group starting 3 January): "Can you move it to now?" — a term that hasn't
 * started yet can be booked up to 60 days before; a running class stays at 28.
 * Same for every academy. The parent still pays the sessions left in the start
 * month at checkout (BILLING_RULES.md rule 1) — only how far ahead changes.
 */
export const BOOK_AHEAD_DAYS = 28
export const NEW_TERM_BOOK_AHEAD_DAYS = 60

/** Days ahead a start can be booked for this class. */
export function bookAheadDays(todayIso: string, termStartIso: string | null | undefined): number {
  return termNotStarted(todayIso, termStartIso) ? NEW_TERM_BOOK_AHEAD_DAYS : BOOK_AHEAD_DAYS
}

/** The latest start date a parent can pick (YYYY-MM-DD). */
export function latestStartIso(todayIso: string, termStartIso: string | null | undefined): string {
  const d = new Date(todayIso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + bookAheadDays(todayIso, termStartIso))
  return d.toISOString().slice(0, 10)
}

/**
 * Where a trial date list starts counting from. The trial forms list the next
 * class days after this date, so a class in a term that hasn't started yet
 * offers trials from its first session, never before (13 Nov 2026: the forms
 * offered six weeks of dates before Caolan's 3 January group existed).
 * Local dates, to match how the forms build their lists.
 */
export function trialDatesFrom(now: Date, termStartIso: string | null | undefined): Date {
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (!termStartIso || !termNotStarted(todayIso, termStartIso)) return now
  const [y, m, d] = termStartIso.slice(0, 10).split('-').map(Number)
  // The day before the term starts: the forms skip their base day, so the
  // first date offered is the first class day on or after the term start.
  return new Date(y, m - 1, d - 1)
}
