// Which /auth pages a signed-in user may stay on.
//
// The middleware sends a signed-in user who lands on an /auth page to their
// dashboard. Some /auth pages must NOT do that, because the user reaches them
// already signed in:
//
//   • /auth/confirm        — every emailed link lands here and signs the user in
//   • /auth/reset-password — where that link then sends them to choose a password
//
// Every emailed link (forgot password, a new coach's "set your password", camp
// parents) goes /auth/confirm → /auth/reset-password. When these were missing
// from this list, clicking a reset link signed people in and dropped them on
// the dashboard, so nobody could ever set a new password (Jay Rosa, 28 Sep 2026
// — and not the first time). scripts/check-auth-invariants.mjs fails the build
// if either path is removed, src/lib/auth-routes.test.ts covers the rule, and
// canary 13 tests a real reset link against the live site every morning.

export const PASSWORD_LINK_PATHS = ['/auth/confirm', '/auth/reset-password'] as const

export function signedInMayStayOnAuthRoute(pathname: string, searchParams: URLSearchParams): boolean {
  if ((PASSWORD_LINK_PATHS as readonly string[]).includes(pathname)) return true
  if (pathname === '/auth/signout') return true
  // Switching accounts.
  if (pathname === '/auth/signin' && searchParams.has('email')) return true
  // A signed-in parent subscribing to a new class: the signup page skips the
  // account step and goes straight to child/plan selection.
  if (pathname === '/auth/signup' && searchParams.has('org')) return true
  return false
}
