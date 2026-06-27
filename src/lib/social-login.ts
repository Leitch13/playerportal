/**
 * Google Sign-In — Phase 1.
 *
 * Shared client-side helper for Google OAuth via Supabase. Used by:
 *   - /auth/signup        (only when academy slug has resolved)
 *   - QuickBookForm step 1 (slug always in scope)
 *
 * The generic /auth/signin page deliberately does NOT offer Google Sign-In
 * in Phase 1 — without a reliable org_slug we can't anchor new Google
 * users to an academy via migration 094's trigger. Academy-specific signup
 * and Quick Book are the only Phase 1 OAuth entry points. A no-context
 * signin Google option is Phase 2 work.
 *
 * Two feature flags gate visibility:
 *   NEXT_PUBLIC_SOCIAL_LOGIN_ENABLED
 *     off (default) or false → no Google buttons render anywhere
 *     true → buttons render per slug-allowlist below
 *
 *   NEXT_PUBLIC_SOCIAL_LOGIN_ORGS
 *     comma-separated slugs that are allowed to show the button
 *     empty/missing → all academies
 *     populated     → only listed academies (case-insensitive)
 *
 * The org_slug + role: 'parent' pair is passed via options.data to
 * Supabase OAuth. Supabase propagates these to raw_user_meta_data on
 * first-creation only; subsequent signins don't re-set. This is exactly
 * what migration 094's hardened handle_new_user trigger needs — new
 * Google signups land in the correct organisation; returning users
 * skip the trigger entirely.
 *
 * Security:
 *   - role is HARDCODED 'parent'. Even if a caller passed role='admin',
 *     this helper ignores it (the trigger also forces 'parent' as a
 *     belt-and-braces layer).
 *   - next param is sanitised to relative paths only — no open-redirect.
 */

import { createClient } from '@/lib/supabase/client'

const SOCIAL_LOGIN_ENABLED =
  (process.env.NEXT_PUBLIC_SOCIAL_LOGIN_ENABLED || '').trim().toLowerCase() === 'true'

const ORG_ALLOWLIST: string[] = (() => {
  const raw = process.env.NEXT_PUBLIC_SOCIAL_LOGIN_ORGS || ''
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
})()

/**
 * Returns true when the Google button should render on the current page.
 *
 *   isSocialLoginEnabled()              → signin page (no slug context)
 *   isSocialLoginEnabled('jamie-allan') → slug-aware page
 */
export function isSocialLoginEnabled(orgSlug?: string | null): boolean {
  if (!SOCIAL_LOGIN_ENABLED) return false
  if (!orgSlug) return true // signin page — global flag is sufficient
  if (ORG_ALLOWLIST.length === 0) return true // empty allowlist = all academies
  return ORG_ALLOWLIST.includes(orgSlug.toLowerCase())
}

/**
 * Sanitise a `next` redirect path to prevent open-redirect attacks.
 *
 * Allows ONLY relative paths starting with a single `/`. Anything else
 * (absolute URLs, protocol-relative, javascript: etc.) falls back to
 * /dashboard.
 */
export function sanitiseNext(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '/dashboard'
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/')) return '/dashboard'
  if (trimmed.startsWith('//')) return '/dashboard'
  if (trimmed.includes('://')) return '/dashboard'
  if (trimmed.toLowerCase().startsWith('/auth/callback')) return '/dashboard' // no callback loops
  return trimmed
}

/**
 * Start a Google OAuth sign-in. Returns immediately with `{ ok: true }` —
 * Supabase will redirect the browser to Google, then back to /auth/callback.
 *
 * Caller is responsible for the feature-flag check (so the button can be
 * hidden cleanly when disabled). This function re-checks for defence in
 * depth.
 */
export async function signInWithGoogle(params: {
  orgSlug?: string | null
  next?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgSlug, next } = params

  if (!isSocialLoginEnabled(orgSlug ?? null)) {
    return { ok: false, error: 'Google sign-in is not available here.' }
  }

  if (typeof window === 'undefined') {
    return { ok: false, error: 'Google sign-in must be triggered from the browser.' }
  }

  const safeNext = sanitiseNext(next)
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`

  // role is HARDCODED 'parent'. Trigger ignores metadata role anyway (091
  // hardening) but we don't even send anything else.
  const data: Record<string, string> = {}
  if (orgSlug) {
    data.org_slug = orgSlug.toLowerCase().trim()
    data.role = 'parent'
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      ...(Object.keys(data).length > 0 ? { data } : {}),
    },
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
