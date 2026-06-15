// Camps Safe Edit — Phase 1A.
//
// Lets an academy admin edit an EXISTING camp's *safe* fields after creation.
// The whole feature is gated by CAMP_EDIT_ENABLED: OFF ⇒ no Edit entry point at
// all, the camps page is byte-identical to the create-only original.
//
// "Safe" means: display / logistics / additive-capacity fields that never change
// the paid value of a booking, the dates, or the day structure. The dangerous,
// money-moving fields — price, start_date, end_date, schedule add/remove day,
// early-bird / sibling pricing, cancel — are deliberately NOT in the allowlist
// and are shown read-only in the UI. They belong to Phase 2 (refund/top-up).
//
// This module touches NO Stripe / Connect / refund / booking path. The only DB
// write it enables is `camps.update(<allowlist>).eq('id', campId)`, which admin
// RLS already permits (the existing is_published publish toggle proves it).

export const CAMP_EDIT_ENABLED = process.env.CAMP_EDIT_ENABLED === 'true'

// The ONLY columns this feature is ever permitted to UPDATE.
// Anything not listed here — price, start_date, end_date, schedule,
// early_bird_*, sibling_discount_*, collect_medical_info, require_consent —
// is excluded by design so a safe edit can never touch paid value, dates, or
// booking-affecting structure.
export type SafeCampFields = {
  name: string
  description: string | null
  location: string | null
  age_group: string | null
  daily_start_time: string | null
  daily_end_time: string | null
  training_group_id: string | null
  image_url: string | null
  what_to_bring: string | null
  max_capacity: number
  is_published: boolean
}

export const SAFE_CAMP_FIELDS: readonly (keyof SafeCampFields)[] = [
  'name',
  'description',
  'location',
  'age_group',
  'daily_start_time',
  'daily_end_time',
  'training_group_id',
  'image_url',
  'what_to_bring',
  'max_capacity',
  'is_published',
] as const

// Hard-filter an update payload down to the allowlist. Even if the caller hands
// over extra keys, only SAFE_CAMP_FIELDS survive — defence-in-depth so a
// dangerous column (price, dates, schedule …) can never be written from here.
export function pickSafeCampFields(input: Record<string, unknown>): Partial<SafeCampFields> {
  const out: Record<string, unknown> = {}
  for (const k of SAFE_CAMP_FIELDS) {
    if (k in input) out[k] = input[k]
  }
  return out as Partial<SafeCampFields>
}

// Capacity guard. Increases are always allowed (strictly additive — opens more
// spaces, booked families unaffected). A reduction is only allowed down to the
// current booked count; below that would orphan families who have already paid,
// so it is blocked. Returns an error string when blocked, or null when allowed.
export function capacityError(newCapacity: number, bookedCount: number): string | null {
  if (!Number.isFinite(newCapacity) || newCapacity < 1) {
    return 'Capacity must be at least 1.'
  }
  if (newCapacity < bookedCount) {
    return `Capacity can't be below ${bookedCount} — that's how many families have already booked.`
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────
// Camps Phase 2A — Additive structural editing.
//
// Gated by its OWN flag, independent of CAMP_EDIT_ENABLED. OFF ⇒ dates +
// schedule stay locked exactly as in Phase 1A. ON ⇒ the edit modal unlocks
// ONLY value-adding structural changes: extend the end date, add day(s), and
// append schedule activities. Reductive changes (shorten, remove day, remove
// activity, move start) are impossible — `additiveEditError` rejects them and
// `pickAdditiveCampFields` only ever emits `end_date`/`schedule`. The write is
// still a single `camps.update(...)`; NO Stripe / refund / camp_bookings path.
//
// Why additive is safe without refunds: a booking is whole-camp with a frozen
// amount_paid; growing the camp gives existing bookings MORE for the same price,
// so no parent ever receives less than they paid for → no refund can be owed.
// ───────────────────────────────────────────────────────────────────────────

export const CAMP_STRUCTURAL_EDIT_ENABLED = process.env.CAMP_STRUCTURAL_EDIT_ENABLED === 'true'

// A single day in the camp's display-only schedule jsonb.
export type ScheduleDay = {
  day: string
  date: string
  activities: string[]
}

// The ONLY columns additive structural editing may UPDATE. Deliberately excludes
// start_date, price, early-bird/sibling — so a structural edit can never move the
// start, change paid value, or shrink anything.
export type AdditiveCampFields = {
  end_date: string
  schedule: ScheduleDay[]
}

export const ADDITIVE_CAMP_FIELDS: readonly (keyof AdditiveCampFields)[] = [
  'end_date',
  'schedule',
] as const

// Hard-filter to the additive allowlist (defence-in-depth, mirrors
// pickSafeCampFields): only end_date/schedule survive — start_date/price/etc.
// can never be written from the structural path.
export function pickAdditiveCampFields(input: Record<string, unknown>): Partial<AdditiveCampFields> {
  const out: Record<string, unknown> = {}
  for (const k of ADDITIVE_CAMP_FIELDS) {
    if (k in input) out[k] = input[k]
  }
  return out as Partial<AdditiveCampFields>
}

// Parse a 'YYYY-MM-DD' date as UTC midnight. Returns NaN on a bad value.
// UTC-only to avoid the local-timezone off-by-one footgun.
function parseISODate(d: string): number {
  return Date.parse(String(d) + 'T00:00:00Z')
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Inclusive day count between two ISO dates (start..end). 0 if invalid/inverted.
export function campDayCount(startDate: string, endDate: string): number {
  const s = parseISODate(startDate)
  const e = parseISODate(endDate)
  if (isNaN(s) || isNaN(e) || e < s) return 0
  return Math.floor((e - s) / 86_400_000) + 1
}

// Build empty schedule-day stubs for every date in start..end (inclusive),
// UTC-safe. Pure — copied here so CampForm stays byte-untouched.
export function generateScheduleDays(startDate: string, endDate: string): ScheduleDay[] {
  const s = parseISODate(startDate)
  const e = parseISODate(endDate)
  if (isNaN(s) || isNaN(e) || e < s) return []
  const days: ScheduleDay[] = []
  for (let t = s; t <= e; t += 86_400_000) {
    const d = new Date(t)
    days.push({ day: DAYS_OF_WEEK[d.getUTCDay()], date: d.toISOString().split('T')[0], activities: [] })
  }
  return days
}

// Append-only check: every original day (matched by date) must still be present,
// and every original activity occurrence must still be present in that day
// (multiset, so a removed/edited duplicate is caught). Additions are allowed.
export function scheduleIsSuperset(oldSchedule: ScheduleDay[], newSchedule: ScheduleDay[]): boolean {
  const byDate = new Map<string, ScheduleDay>()
  for (const d of newSchedule || []) byDate.set(d.date, d)
  for (const od of oldSchedule || []) {
    const nd = byDate.get(od.date)
    if (!nd) return false
    const counts = new Map<string, number>()
    for (const a of nd.activities || []) counts.set(a, (counts.get(a) || 0) + 1)
    for (const a of od.activities || []) {
      const c = counts.get(a) || 0
      if (c <= 0) return false
      counts.set(a, c - 1)
    }
  }
  return true
}

const MAX_EXTRA_DAYS = 180

export type AdditiveSnapshot = {
  start_date: string
  end_date: string
  schedule: ScheduleDay[]
}

// The structural guard. Returns the first failing message, or null when the
// edit is purely additive and safe. `todayISO` is 'YYYY-MM-DD' (caller supplies;
// compared in UTC). Enforces: camp not ended · start unchanged · end only
// grows · day-count non-decreasing · schedule append-only · sane bounds.
export function additiveEditError(orig: AdditiveSnapshot, next: AdditiveSnapshot, todayISO: string): string | null {
  const today = parseISODate(todayISO)
  const os = parseISODate(orig.start_date)
  const oe = parseISODate(orig.end_date)
  const ns = parseISODate(next.start_date)
  const ne = parseISODate(next.end_date)
  if ([today, os, oe, ns, ne].some((n) => isNaN(n))) return 'Invalid camp dates.'

  // Block only once the camp has FULLY ENDED (end date strictly in the past).
  // Additive edits never touch bookings/payments, so a camp can still be
  // extended/enhanced right up to and during its run — through its final day
  // (end_date === today is still editable). The start can't move and the end
  // can't shrink, so this never enables a reductive or past-shifting edit.
  if (oe < today) return "Structural edits aren't allowed once a camp has ended."

  // Start date is immutable in additive editing.
  if (ns !== os) return "The start date can't be changed."

  // End date can only be extended, never brought forward.
  if (ne < oe) return 'The end date can only be extended, not brought forward.'

  // Basic date sanity.
  if (ne < ns) return 'End date must be on or after the start date.'

  // Day count can only grow (subsumed by the above; asserted explicitly).
  const origDays = campDayCount(orig.start_date, orig.end_date)
  const nextDays = campDayCount(next.start_date, next.end_date)
  if (nextDays < origDays) return 'The camp length can only grow.'

  // Fat-finger guard on enormous extensions.
  if (nextDays - origDays > MAX_EXTRA_DAYS) {
    return `That extends the camp by more than ${MAX_EXTRA_DAYS} days — please check the end date.`
  }

  // Schedule may only be added to, never have days/activities removed or edited.
  if (!scheduleIsSuperset(orig.schedule || [], next.schedule || [])) {
    return 'Existing schedule days and activities can only be added to — not removed or changed.'
  }

  return null
}
