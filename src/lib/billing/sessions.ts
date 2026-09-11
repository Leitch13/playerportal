/**
 * Session-based bridge billing math.
 *
 * Companion to the calendar-day model in `anchor.ts`. Activated per-org via
 * (one rule for every academy — see BILLING_RULES.md)
 * subscription_plans.sessions_per_month > 0. Falls back to calendar-day
 * when either condition isn't met.
 *
 * Counting rule (confirmed business rule):
 *   remaining_sessions = count of class-day occurrences D
 *                        where start_date ≤ D < billing_anchor_date
 *   bridge_pence       = min(remaining_sessions × per_session_pence,
 *                            monthly_pence)
 *
 * The cap is the safety rail: a 5-class-day month never charges more for
 * the bridge than the parent would pay for a full month.
 *
 * All math is timezone-stable: dates are treated as UTC midnight to avoid
 * off-by-one errors at DST boundaries.
 */

import { firstOfNextMonthUnix } from './anchor'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const DOW: readonly string[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

/**
 * Counts class-day occurrences in the half-open window [startISO, anchorISO).
 *   - Inclusive of startISO (if it's a class day, it counts)
 *   - Exclusive of anchorISO (the anchor day itself never counts)
 * Returns 0 for empty/inverted windows or invalid day-of-week.
 *
 * @example
 *   countSessionsBetween('2026-06-22', '2026-07-01', 'Monday')   // 2 (22, 29)
 *   countSessionsBetween('2026-06-16', '2026-07-01', 'Monday')   // 3 (16, 23, 30)
 *   countSessionsBetween('2026-06-17', '2026-07-01', 'Tuesday')  // 2 (17, 24)
 *   countSessionsBetween('2026-07-01', '2026-07-01', 'Tuesday')  // 0 (empty)
 */
export function countSessionsBetween(
  startISO: string,
  anchorISO: string,
  classDayOfWeek: string | null,
): number {
  if (!classDayOfWeek) return 0
  const targetDow = DOW.indexOf(classDayOfWeek)
  if (targetDow < 0) return 0

  const cur = new Date(startISO + 'T00:00:00Z')
  const anchor = new Date(anchorISO + 'T00:00:00Z')

  if (!(cur < anchor)) return 0
  if (isNaN(cur.getTime()) || isNaN(anchor.getTime())) return 0

  let count = 0
  // Safety cap — a month can't have more than 31 day-of-week matches
  for (let i = 0; i < 40 && cur < anchor; i++) {
    if (cur.getUTCDay() === targetDow) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

/**
 * Returns ISO-date strings (YYYY-MM-DD) for every class-day occurrence in
 * the half-open window [todayISO, anchorISO), inclusive of todayISO and
 * exclusive of anchorISO. Used by the session-mode picker to constrain
 * parents to dates they can actually attend.
 *
 *   generateSessionDates('2026-06-02', '2026-07-01', 'Monday')
 *     → ['2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29']
 *
 *   generateSessionDates('2026-06-08', '2026-07-01', 'Monday')
 *     → ['2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29']
 *
 *   generateSessionDates('2026-06-30', '2026-07-01', 'Monday')
 *     → []     (no Monday in this 1-day window)
 */
export function generateSessionDates(
  todayISO: string,
  anchorISO: string,
  classDayOfWeek: string | null,
): string[] {
  if (!classDayOfWeek) return []
  const targetDow = DOW.indexOf(classDayOfWeek)
  if (targetDow < 0) return []

  const cur = new Date(todayISO + 'T00:00:00Z')
  const anchor = new Date(anchorISO + 'T00:00:00Z')

  if (!(cur < anchor)) return []
  if (isNaN(cur.getTime()) || isNaN(anchor.getTime())) return []

  const dates: string[] = []
  // Same safety cap as countSessionsBetween.
  for (let i = 0; i < 40 && cur < anchor; i++) {
    if (cur.getUTCDay() === targetDow) {
      dates.push(cur.toISOString().slice(0, 10))
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

/**
 * Returns true iff the given ISO date (YYYY-MM-DD) falls on the class's
 * day-of-week. Used by the subscribe route to reject tampered client
 * submissions that pick a non-class-day date.
 *
 * Returns true for any of these defensive cases (so unrelated paths don't
 * accidentally reject):
 *   - classDayOfWeek is null/empty  (unknown-schedule plans — fallback path)
 *   - classDayOfWeek is unrecognised (e.g. typo'd "Funday" in DB)
 *   - iso is not a parseable date    (let other validation reject it)
 *
 *   isClassDay('2026-06-01', 'Monday')  // true  (Jun 1 2026 is a Monday)
 *   isClassDay('2026-06-02', 'Monday')  // false (Jun 2 2026 is a Tuesday)
 *   isClassDay('2026-06-02', null)      // true  (unknown class day → accept)
 */
export function isClassDay(iso: string, classDayOfWeek: string | null): boolean {
  if (!classDayOfWeek) return true
  const targetDow = DOW.indexOf(classDayOfWeek)
  if (targetDow < 0) return true
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return true
  return d.getUTCDay() === targetDow
}

/**
 * Format a Stripe Checkout line-item description for the bridge charge.
 * "Remaining {Month} sessions" — used both server-side (Checkout line item)
 * and client-side (picker preview text).
 *
 *   bridgeDescriptionFor(new Date('2026-06-17T00:00:00Z'))  // "Remaining June sessions"
 *   bridgeDescriptionFor(new Date('2026-12-31T00:00:00Z'))  // "Remaining December sessions"
 */
export function bridgeDescriptionFor(startDate: Date): string {
  const month = startDate.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })
  return `Remaining ${month} sessions`
}

/**
 * THE ONE RULE for what a parent pays at signup. Every route that takes a
 * first payment — direct signup, invite/import confirm, future-start
 * activation — and every preview a parent sees, calls this. Nothing else
 * decides the number.
 *
 *   • Class day known:  sessions left in [start, anchor) × (monthly ÷ 4),
 *                       capped at one month. 0 sessions left → £0 today.
 *   • Class day unknown: weeks left until the anchor × (monthly ÷ 4),
 *                       capped at one month. (A 1-2-1 plan with no fixed
 *                       day joining on the 2nd pays the month, not £30.)
 *
 * Then the full monthly amount on the anchor (1st of next month) and every
 * 1st after that. Stripe's own calendar-day proration is never used.
 *
 * Re-broken six times before this existed (last: 10 Sep 2026). If you are
 * about to add a branch that charges something else, don't.
 */
export interface FirstCharge {
  /** Pence due today. */
  pence: number
  /** Class-day sessions counted in [start, anchor). 0 when the day is unknown. */
  sessions: number
  /** Weeks counted when the day is unknown; 0 otherwise. */
  weeks: number
  perSessionPence: number
  monthlyPence: number
  capApplied: boolean
  basis: 'sessions' | 'weeks' | 'none'
  anchorIso: string
}

export function firstChargeFor(
  monthlyPounds: number,
  startISO: string,
  anchorISO: string,
  classDayOfWeek: string | null,
): FirstCharge {
  const perSessionPence = Math.max(0, Math.round((monthlyPounds / 4) * 100))
  const monthlyPence = Math.max(0, Math.round(monthlyPounds * 100))
  const start = new Date(startISO + 'T00:00:00Z')
  const anchor = new Date(anchorISO + 'T00:00:00Z')
  const daysLeft = Math.max(0, Math.round((anchor.getTime() - start.getTime()) / 86400000))
  if (monthlyPence === 0 || daysLeft === 0) {
    return { pence: 0, sessions: 0, weeks: 0, perSessionPence, monthlyPence, capApplied: false, basis: 'none', anchorIso: anchorISO }
  }
  const validDay = !!classDayOfWeek && DAY_NAMES.includes(classDayOfWeek)
  if (validDay) {
    const sessions = countSessionsBetween(startISO, anchorISO, classDayOfWeek)
    const uncapped = sessions * perSessionPence
    return {
      pence: Math.min(uncapped, monthlyPence), sessions, weeks: 0, perSessionPence, monthlyPence,
      capApplied: uncapped > monthlyPence, basis: sessions > 0 ? 'sessions' : 'none', anchorIso: anchorISO,
    }
  }
  const weeks = Math.min(4, Math.ceil(daysLeft / 7))
  const uncapped = weeks * perSessionPence
  return {
    pence: Math.min(uncapped, monthlyPence), sessions: 0, weeks, perSessionPence, monthlyPence,
    capApplied: uncapped > monthlyPence, basis: 'weeks', anchorIso: anchorISO,
  }
}

/** Plain-English line for receipts and previews, e.g. "3 sessions this month". */
export function firstChargeLabel(fc: FirstCharge): string {
  if (fc.basis === 'sessions') return `${fc.sessions} ${fc.sessions === 1 ? 'session' : 'sessions'} this month`
  if (fc.basis === 'weeks') return `${fc.weeks} ${fc.weeks === 1 ? 'week' : 'weeks'} this month`
  return 'Nothing to pay this month'
}

/**
 * Kept for the existing call sites and tests. Same rule as firstChargeFor —
 * this is now a thin wrapper, not a second formula.
 */
export function tonightBridge(
  monthlyPounds: number,
  startISO: string,
  anchorISO: string,
  classDayOfWeek: string | null,
): { pence: number; sessions: number; perSessionPence: number } {
  const fc = firstChargeFor(monthlyPounds, startISO, anchorISO, classDayOfWeek)
  return { pence: fc.pence, sessions: fc.sessions, perSessionPence: fc.perSessionPence }
}
