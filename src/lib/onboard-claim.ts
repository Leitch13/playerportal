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
