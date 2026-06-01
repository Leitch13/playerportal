/**
 * Compute the next upcoming session for a class.
 *
 * Used by the subscribe flow to default the start-date picker to the
 * "next session" of the class the parent is signing up for.
 *
 * Inputs are deliberately small: a class's day_of_week + time_slot, and a
 * "today" anchor. No DB queries from here — caller passes data in.
 *
 * Pure function, easy to unit-test.
 */

const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

type DayName = (typeof DAYS_OF_WEEK)[number]

export interface ClassScheduleHint {
  /** "Monday", "tuesday", etc. Case-insensitive. */
  day_of_week: string | null
  /** "17:30", "17:30-18:30", or null. We only need the start. */
  time_slot: string | null
}

/**
 * Returns the Date of the next session, in UTC.
 *
 * Logic:
 *  - if day_of_week is null/invalid → return null (caller falls back to "today")
 *  - if today matches day_of_week AND the start time hasn't passed → return today
 *  - if today matches day_of_week AND the start time has passed → return next week
 *  - otherwise → return the next occurrence of that day-of-week
 *
 * Returned date is at 00:00:00 UTC on the target day. (We don't care about
 * the hour for booking/billing purposes — the start_date for Stripe is
 * day-granular.)
 */
export function nextSessionDate(
  schedule: ClassScheduleHint | null | undefined,
  today: Date = new Date(),
): Date | null {
  if (!schedule?.day_of_week) return null

  const targetIdx = DAYS_OF_WEEK.indexOf(schedule.day_of_week.toLowerCase() as DayName)
  if (targetIdx === -1) return null

  const todayIdx = today.getUTCDay()
  let daysAhead = (targetIdx - todayIdx + 7) % 7

  if (daysAhead === 0) {
    // Today matches the target day. Check if the start time has already passed.
    const startTimePassed = hasStartTimePassed(schedule.time_slot, today)
    if (startTimePassed) daysAhead = 7
    // else: keep daysAhead = 0 (today is the next session)
  }

  return new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + daysAhead,
      0,
      0,
      0,
      0,
    ),
  )
}

/**
 * Parse a time_slot string like "17:30" or "17:30-18:30" and compare to today's UTC time.
 * Returns true if "now" is already past that start time today.
 *
 * Note: we treat the stored time_slot as a wall-clock time in academy local
 * timezone (typically UK = Europe/London). For the "should we suggest today
 * or next week" decision, treating it as UTC-equivalent is a few-hours-off
 * approximation; good enough to avoid suggesting "this evening at 17:30"
 * after 17:30 has already passed. Edge cases at the timezone boundary will
 * fall back gracefully to "next week".
 */
function hasStartTimePassed(timeSlot: string | null | undefined, today: Date): boolean {
  if (!timeSlot) return false
  const match = String(timeSlot).match(/^(\d{1,2}):(\d{2})/)
  if (!match) return false
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (Number.isNaN(hh) || Number.isNaN(mm)) return false

  const slotMinutes = hh * 60 + mm
  const nowMinutes = today.getUTCHours() * 60 + today.getUTCMinutes()
  return nowMinutes >= slotMinutes
}

/**
 * Latest allowed start date — 28 days from today. Caps how far parents can
 * defer enrolment so we don't accumulate stale pending enrolments.
 */
export function latestAllowedStartDate(today: Date = new Date()): Date {
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 28, 0, 0, 0, 0),
  )
}

/**
 * ISO date (YYYY-MM-DD) for a Date. Used in form values and Stripe metadata.
 */
export function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}
