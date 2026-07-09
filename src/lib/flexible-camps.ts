// Flexible Camp Booking Mode — Phase 0 (Foundation).
// Build trigger: 2026-07-07 evening
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

// ─── Pilot publish allowlist (Phase 3E follow-up) ───
//
// Comma-separated list of organisation ids permitted to publish
// flexible-days camps. Empty/missing = nobody allowed (fail-safe
// default). Whitespace-trimmed; empty entries filtered so a stray
// comma or space cannot accidentally allow "" through as a wildcard.
//
// This is SEPARATE from FLEXIBLE_CAMPS_ENABLED:
//   FLEXIBLE_CAMPS_ENABLED=true                    ⇒ feature UI +
//     checkout route become available (staging QA + admins can
//     create + parents can round-trip).
//   FLEXIBLE_CAMPS_PUBLISH_ALLOWLIST=<org1>,<org2> ⇒ ONLY those orgs
//     can flip `is_published=true` on a flexible camp in production.
//
// A staging environment typically sets ENABLED=true with no allowlist
// so QA can run end-to-end without the "publish → parents can book"
// step being available. The pilot org gets added to the allowlist to
// go live for real bookings.
function parsePublishAllowlist(raw: string | undefined): ReadonlySet<string> {
  if (!raw) return new Set<string>()
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )
}

export const FLEXIBLE_CAMPS_PUBLISH_ALLOWLIST: ReadonlySet<string> =
  parsePublishAllowlist(process.env.FLEXIBLE_CAMPS_PUBLISH_ALLOWLIST)

// ─── Global publish bypass ───
//
// Setting FLEXIBLE_CAMPS_ALLOW_ALL=true opens flexible-days publishing
// to EVERY academy — no allowlist consulted. Intended as the graduation
// switch once the pilot has validated the flow end-to-end and we're
// ready for broad rollout.
//
// Default false. When false, the pilot allowlist gate below is the
// authoritative check (preserves Phase 3E behaviour byte-for-byte).
export const FLEXIBLE_CAMPS_ALLOW_ALL_PUBLISH =
  process.env.FLEXIBLE_CAMPS_ALLOW_ALL === 'true'

// Publish-lock guard used by every camp publish surface (CampForm,
// CampActions row menu, CampEditForm).
//
//   Whole-camp:                  always allowed to publish → false
//   ALLOW_ALL=true + flexible:   allowed → false (global bypass)
//   Flexible + allowlisted org:  allowed → false
//   Flexible + everyone else:    blocked → true
//   Flexible + no org id passed: blocked → true (fail-safe: if a
//                                caller forgets the arg, we stay
//                                locked rather than silently allow)
//
// The organisationId argument is optional so pre-allowlist callers
// keep returning `true` (blocked) for flexible camps — matches the
// Phase 1 default of "flexible = locked" until a caller opts in by
// passing an id we can check.
export function isFlexibleModePublishBlocked(
  mode: BookingMode | string | null | undefined,
  organisationId?: string | null,
): boolean {
  if (mode !== BOOKING_MODE_FLEXIBLE_DAYS) return false
  if (FLEXIBLE_CAMPS_ALLOW_ALL_PUBLISH) return false
  if (!organisationId) return true
  return !FLEXIBLE_CAMPS_PUBLISH_ALLOWLIST.has(organisationId)
}

export const FLEXIBLE_CAMPS_PUBLISH_BLOCKED_MESSAGE =
  'Flexible Day camps aren’t publish-enabled for this academy yet. Please save as a draft.'

// ─── Client-safe publish lock (Global Rollout hotfix) ───
//
// isFlexibleModePublishBlocked() reads FLEXIBLE_CAMPS_ALLOW_ALL and the
// allowlist from process.env — SERVER-ONLY values. In a 'use client'
// bundle Next.js only inlines NEXT_PUBLIC_* vars, so both read as
// undefined and the guard evaluates to "blocked for everyone" no matter
// what is set in Vercel. That silently defeated the ALLOW_ALL rollout
// switch in every dashboard publish surface (CampForm, CampEditForm,
// CampActions row menu).
//
// Fix pattern (mirrors flexibleCampsEnabled): the SERVER component
// (dashboard/camps/page.tsx) evaluates the env-based decision once and
// passes `flexiblePublishAllowed` down as a prop. Client components call
// this PURE helper — a function of its arguments only, no env reads —
// so the browser bundle can never disagree with the server's decision.
//
//   Whole-camp mode:        never blocked → false
//   Flexible + allowed:     not blocked  → false
//   Flexible + not allowed: blocked      → true
//   publishAllowed omitted: blocked      → true (fail-safe, same
//                           default as the original allowlist guard)
export function isFlexiblePublishLocked(
  mode: BookingMode | string | null | undefined,
  publishAllowed: boolean | undefined,
): boolean {
  if (mode !== BOOKING_MODE_FLEXIBLE_DAYS) return false
  return !publishAllowed
}

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
