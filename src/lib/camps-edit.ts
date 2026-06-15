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
