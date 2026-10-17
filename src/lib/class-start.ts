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
