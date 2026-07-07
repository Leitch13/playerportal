// Flexible Camp Booking Mode — Phase 0 (Foundation).
//
// This module introduces the *types* and *feature flag* needed to later
// support per-day camp bookings alongside the existing whole-camp booking
// model. Phase 0 deliberately introduces NO runtime behaviour: nothing in
// the app reads FLEXIBLE_CAMPS_ENABLED yet, no code path branches on
// BookingMode, no UI renders anything from these types.
//
// Pairs with `supabase/095_flexible_camps_phase_0.sql`.
//
// ─── Safety story ───
// The whole-camp booking implementation is production-proven and MUST
// remain byte-identical after Phase 0. This file is a scaffold — future
// phases will import from here to gate their new code paths. Removing
// this file today would be zero-impact on production.

// ─── Feature flag ───
// Global gate for anything Flexible-Camps-related. Mirrors the existing
// CAMP_EDIT_ENABLED / CAMP_STRUCTURAL_EDIT_ENABLED pattern from
// `src/lib/camps-edit.ts`. Default OFF: unset env var ⇒ false ⇒ no
// flexible-camp code path in future phases will render or execute.
//
// Phase 0 does NOT ship any code that reads this constant. Later phases
// (admin create form, parent day picker, checkout branch, etc.) will
// gate themselves behind it.
export const FLEXIBLE_CAMPS_ENABLED = process.env.FLEXIBLE_CAMPS_ENABLED === 'true'

// ─── Booking mode ───
// Snapshotted at booking time on `camp_bookings.booking_mode` — must
// NEVER be re-derived from the parent camp's current mode, so paid
// families are protected against retroactive admin edits.

export const BOOKING_MODE_WHOLE_CAMP = 'whole_camp' as const
export const BOOKING_MODE_FLEXIBLE_DAYS = 'flexible_days' as const

export type BookingMode =
  | typeof BOOKING_MODE_WHOLE_CAMP
  | typeof BOOKING_MODE_FLEXIBLE_DAYS

export const ALL_BOOKING_MODES: readonly BookingMode[] = [
  BOOKING_MODE_WHOLE_CAMP,
  BOOKING_MODE_FLEXIBLE_DAYS,
] as const

// Narrows an untrusted value (webhook payload, form input, DB row from
// a `.select()` typed as string) into a strict BookingMode. Returns
// false for anything else — callers should default to whole_camp when
// this returns false, mirroring the DB default and preserving the
// existing whole-camp semantics.
export function isValidBookingMode(v: unknown): v is BookingMode {
  return v === BOOKING_MODE_WHOLE_CAMP || v === BOOKING_MODE_FLEXIBLE_DAYS
}

// Parses an untrusted value into a BookingMode, defaulting to
// whole_camp on any invalid or missing input. This is the safe path for
// any Phase 1+ code that needs to read `camps.booking_mode` or
// `camp_bookings.booking_mode` from an untyped query result.
export function parseBookingMode(v: unknown): BookingMode {
  return isValidBookingMode(v) ? v : BOOKING_MODE_WHOLE_CAMP
}

// Production-safety guard for Phase 1. The parent booking flow does not yet
// support flexible-days camps, so publishing one before Phase 2 lands would
// expose parents to a booking page they can't correctly check out against.
// Every publish surface (CampForm, CampActions, CampEditForm) reads this
// helper and blocks the publish when true. When Phase 2 ships the parent
// flow, flip this to `return false` (or remove the callers).
export function isFlexibleModePublishBlocked(mode: BookingMode | string | null | undefined): boolean {
  return mode === BOOKING_MODE_FLEXIBLE_DAYS
}

export const FLEXIBLE_CAMPS_PUBLISH_BLOCKED_MESSAGE =
  'Flexible Day camps cannot be published yet because the parent booking flow has not been completed. Save this camp as a draft until Flexible Booking is released.'

// ─── Row shapes ───
// Mirror the schema in `supabase/095_flexible_camps_phase_0.sql`. Named
// `Row` because these represent Supabase `.select('*')` result shapes,
// matching the convention used elsewhere in the codebase for DB row
// types.

export type CampDayRow = {
  id: string
  camp_id: string
  date: string           // ISO date (YYYY-MM-DD)
  price: number | null   // null ⇒ use camps.flex_price_per_day
  max_capacity: number | null  // null ⇒ uncapped for this day
  is_available: boolean
  sort_order: number | null
  created_at: string     // ISO timestamptz
  updated_at: string
}

export type CampBookingDayRow = {
  id: string
  camp_booking_id: string
  camp_day_id: string
  amount_paid: number    // snapshotted at booking time; never re-derived
  created_at: string
}

// Additional fields introduced on `camps`. These sit alongside the
// existing camps columns and are only meaningful when
// `booking_mode = 'flexible_days'`. Deliberately declared as a
// standalone type (not spread into the existing camps row type) so
// nothing that already selects `camps.*` gains an implicit dependency
// on this file.
export type CampFlexibleFields = {
  booking_mode: BookingMode
  flex_price_per_day: number | null
  flex_min_days: number | null
}

// Additional field introduced on `camp_bookings`. Same pattern —
// standalone type; nothing existing needs to know it exists.
export type CampBookingFlexibleFields = {
  booking_mode: BookingMode
}
