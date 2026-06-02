/**
 * Session-based bridge billing math.
 *
 * Companion to the calendar-day model in `anchor.ts`. Activated per-org via
 * organisations.bridge_billing_mode = 'session' AND per-plan via
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

export interface BridgeEstimate {
  /** Class-day occurrences in [start, anchor) */
  sessionsRemaining: number
  /** Per-session price in pence (monthlyPence / sessionsPerMonth, rounded) */
  perSessionPence: number
  /** Uncapped bridge = perSessionPence × sessionsRemaining */
  uncappedPence: number
  /** Capped at monthlyPence */
  bridgePence: number
  /** True iff the cap clipped the bridge */
  capApplied: boolean
}

/**
 * Pure computation of the session-bridge charge for a given plan + start.
 * Returns null when session-mode does not apply for this plan (no
 * sessions_per_month, no class day-of-week, or zero sessions in window) —
 * callers must fall back to calendar-day proration.
 *
 *   estimateBridgePence({
 *     monthlyPence:     12000,    // £120
 *     sessionsPerMonth: 4,        // → £30 / session
 *     classDayOfWeek:   'Monday',
 *     startDate:        new Date('2026-06-16T00:00:00Z'),
 *   })
 *   // { sessionsRemaining: 3, perSessionPence: 3000,
 *   //   uncappedPence: 9000, bridgePence: 9000, capApplied: false }
 */
export function estimateBridgePence(args: {
  monthlyPence: number
  sessionsPerMonth: number | null
  classDayOfWeek: string | null
  startDate: Date
}): BridgeEstimate | null {
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

  return {
    sessionsRemaining,
    perSessionPence,
    uncappedPence,
    bridgePence,
    capApplied: uncappedPence > monthlyPence,
  }
}
