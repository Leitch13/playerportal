/**
 * Pure date-math helpers for start-date-driven billing.
 *
 * All functions are deterministic given (today, plan amount). No side effects.
 * Used by:
 *   - subscribe/route.ts to compute Stripe billing_cycle_anchor
 *   - QuickBookForm.tsx to render the "you'll pay today" preview
 *   - Email templates that show the prorated breakdown
 *
 * Times are computed in UTC. Academy timezone refinements can come later;
 * Stripe billing_cycle_anchor is a Unix timestamp regardless of timezone,
 * and "the 1st of next month at 00:00 UTC" is unambiguous as a billing
 * anchor for UK academies (a few-hour shift in display is acceptable;
 * an off-by-one-month error is not).
 */

/**
 * Unix timestamp for the 1st of the month AFTER the given date, midnight UTC.
 *
 * - given Jun 12 → returns Jul 1 00:00 UTC
 * - given Jun 1 → returns Jul 1 00:00 UTC (1st of THIS month still bumps forward)
 * - given Dec 28 → returns Jan 1 (next year) 00:00 UTC
 */
export function firstOfNextMonthUnix(date: Date = new Date()): number {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0))
  return Math.floor(next.getTime() / 1000)
}

/**
 * ISO date (YYYY-MM-DD) for the 1st of next month. Used in UI copy.
 */
export function firstOfNextMonthIso(date: Date = new Date()): string {
  return new Date(firstOfNextMonthUnix(date) * 1000).toISOString().split('T')[0]
}

/**
 * Human-readable date for the 1st of next month: "1 July 2026".
 */
export function firstOfNextMonthLabel(date: Date = new Date()): string {
  return new Date(firstOfNextMonthUnix(date) * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Days between `from` (inclusive) and `to` (exclusive). Both at UTC midnight.
 *
 * Used to estimate the prorated amount in the UI before the customer reaches
 * Stripe Checkout. Stripe's own calendar-day math is the source of truth for
 * the actual charge — but we want the UI preview to match within £0.05 so
 * customers don't see a surprise at Checkout.
 */
export function daysBetweenUtc(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.max(0, Math.round((b - a) / 86400000))
}


/**
 * True if the chosen start date falls in the current calendar month.
 *
 * - today = today (current month) → true
 * - today = 5 days from now (still this month) → true
 * - today = 25 days from now (rolls into next month) → false
 */
export function isStartInCurrentMonth(startDate: Date, today: Date = new Date()): boolean {
  return (
    startDate.getUTCFullYear() === today.getUTCFullYear() &&
    startDate.getUTCMonth() === today.getUTCMonth()
  )
}

/**
 * True if the chosen start date is in the past or today.
 *
 * Mid-month signup with start=today is the "immediate prorated" path —
 * Stage 2 dispatches on this.
 */
export function isStartTodayOrEarlier(startDate: Date, today: Date = new Date()): boolean {
  return Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
    <= Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
}

/**
 * Stripe CHECKOUT rejects a subscription trial_end less than 48 hours out
 * ("trial_end must be at least 2 days in the future"). Our anchor is the 1st
 * of next month, so a signup on the 29th/30th/31st would be refused. Clamp
 * to just over 48h; the webhook then moves trial_end back to the anchor
 * (the Subscriptions API has no such minimum) so the cycle stays on the 1st.
 */
export function clampTrialEndForCheckout(ts: number): number {
  const minAllowed = Math.floor(Date.now() / 1000) + 48 * 3600 + 15 * 60
  return Math.max(ts, minAllowed)
}
