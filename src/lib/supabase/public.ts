/**
 * Pure-anonymous Supabase client for PUBLIC BOOKING surfaces.
 *
 * Public booking pages (`/book/[slug]/*`) display the same academy,
 * classes, camps, and plans regardless of who is viewing. They MUST
 * NOT carry the viewer's session, because the RLS policies governing
 * the public-read tables (`organisations`, `training_groups`,
 * `subscription_plans`, `camps`) are split into two branches:
 *
 *   • `*_select_own_org`         (auth.role() = 'authenticated' AND
 *                                 organisation_id = get_my_org())
 *   • `*_select_published_anon`  (auth.role() = 'anon' AND
 *                                 is_published = true)
 *
 * The server cookie-aware client (`@/lib/supabase/server`) forwards
 * the viewer's session JWT, which makes `auth.role()` resolve to
 * 'authenticated' for any logged-in viewer. For cross-org viewers
 * neither branch satisfies their request — the own_org branch matches
 * the *viewer's* org (not the academy being booked), so both branches
 * return zero rows. Booking page goes blank.
 *
 * This helper builds a NON-cookie-aware client that talks to PostgREST
 * with the public anon key only. `auth.role()` is always 'anon' for
 * its requests, so the `*_select_published_anon` policies fire as
 * designed and academy/class/plan/camp data renders correctly for
 * every viewer auth state (logged-out, same-org, cross-org).
 *
 *   • DOES NOT read or write cookies.
 *   • DOES NOT persist sessions.
 *   • DOES NOT have elevated permissions — service-role is NEVER used
 *     here. RLS's `is_published` / `active` gating still applies, so
 *     unpublished academies and inactive plans remain hidden.
 *   • SHOULD ONLY be used for the public booking-page reads listed
 *     in the call sites. Authenticated user data (parent's children,
 *     parent's profile, parent's bookings) must still go through the
 *     cookie-aware client at `@/lib/supabase/server`.
 *
 * Memoised at module level so we don't re-instantiate per request.
 */

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function createPublicClient(): SupabaseClient {
  if (cached) return cached
  cached = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // No persistence, no auto-refresh — every request goes out
        // with the anon key only. `auth.role()` resolves to 'anon'
        // server-side.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          // Mark every outgoing request so it's distinguishable from
          // anon traffic in PostgREST logs. Defensive against future
          // observability regressions; PostgREST ignores unknown
          // headers so this is harmless.
          'x-pp-public-read': '1',
        },
      },
    },
  )
  return cached
}
