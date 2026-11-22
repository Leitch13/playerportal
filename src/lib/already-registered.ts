/**
 * A parent who started booking before (so has an account) and comes back to book again
 * used to hit the raw "User already registered" error with no way forward (Ollie, 22 Nov 2026).
 * The booking and sign-up forms now spot this and offer a login link instead.
 */

type AuthErr = { message?: string; code?: string; status?: number } | null | undefined

export function isAlreadyRegistered(err: AuthErr, user?: { identities?: unknown[] | null } | null): boolean {
  // With email confirmation on, the login system may return a user with no identities instead of an error.
  if (!err && user && Array.isArray(user.identities) && user.identities.length === 0) return true
  if (!err) return false
  if (err.code === 'user_already_exists' || err.code === 'email_exists') return true
  return /already (been )?registered|already exists/i.test(err.message || '')
}

/** Where an emailed login link may send someone back to: a booking page on this site only. */
export function safeBookingReturn(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 300) return null
  return /^\/book\/[a-z0-9-]+(\/[A-Za-z0-9_-]+)*$/.test(raw) ? raw : null
}
