import { createHmac, timingSafeEqual } from 'crypto'

// Onboarding claim guard.
//
// The unauthenticated /api/onboard/signup route writes the caller in as an
// academy ADMIN, resolving the academy from a slug. Academy slugs are public
// (they appear in booking URLs like /book/<slug>), so without a guard anyone
// could POST an existing academy's slug and seize an admin seat on a live
// tenant — exposing children's personal and medical data.
//
// The invariant that makes the route safe: onboarding only ever creates the
// FIRST admin of a brand-new academy. /api/onboard creates the org with zero
// admins, then /api/onboard/signup claims that first seat. Once ANY admin
// exists, the academy is "claimed" and further staff must be added through the
// authenticated admin path (/api/staff/create). This function is that boundary.
export function orgIsClaimableByFirstAdmin(existingAdminCount: number): boolean {
  return existingAdminCount === 0
}

// Security audit 6 Nov 2026: "no admin yet" alone wasn't enough. An academy whose
// admin was removed, or a brand-new one whose slug someone saw, could be claimed
// by anyone. /api/onboard now hands back a claim token tied to the org it just
// made, and only that token can claim the first admin seat.
function claimSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}
export function claimTokenFor(orgId: string): string {
  return createHmac('sha256', claimSecret()).update(`onboard-claim:${orgId}`).digest('hex').slice(0, 40)
}
export function claimTokenOk(orgId: string, token: unknown): boolean {
  if (!claimSecret() || typeof token !== 'string' || token.length !== 40) return false
  const want = claimTokenFor(orgId)
  return timingSafeEqual(Buffer.from(token), Buffer.from(want))
}
