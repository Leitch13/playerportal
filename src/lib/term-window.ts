/**
 * Does a class run on a given date, as far as its term (block) dates say?
 *
 * The next-day session reminder used to look only at the weekday, so every
 * child enrolled in a Thursday class was told "see you tomorrow" every
 * Wednesday, even between blocks. Gold & Gray's Intensity and Goalkeeper
 * blocks run 17 Aug–11 Oct and 26 Oct–19 Dec; through the October holidays
 * their parents were reminded about sessions that were not on (Emma Murray,
 * 14 Oct 2026).
 *
 * A class with no term runs every week, as before. A class with a term runs
 * only from its start date to its end date, inclusive. The term's is_active
 * flag is NOT used: academies leave it off on terms that are running (every
 * Gold & Gray term was is_active=false on 14 Oct), so the dates are the truth.
 */
export interface TermDates {
  start_date: string | null
  end_date: string | null
}

export function classRunsOn(dateIso: string, term: TermDates | null | undefined): boolean {
  if (!term) return true
  if (term.start_date && dateIso < term.start_date) return false
  if (term.end_date && dateIso > term.end_date) return false
  return true
}

/** The calendar date in the UK, as YYYY-MM-DD, `days` from now. */
export function ukDateFromNow(days: number, now: Date = new Date()): string {
  const d = new Date(now.getTime() + days * 24 * 3600 * 1000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
