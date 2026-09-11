// ============================================================================
// Quarterly billing — same for every academy.
//
// John's rule (10 Sep 2026): one billing behaviour, one code path, for every
// academy. Quarterly (pay every 3 months, academy-set discount) is available
// to EVERY academy. The only thing that governs it is the academy's own
// toggle in Settings (`organisations.quarterly_billing_enabled`, default on).
// Switch it off or leave it blank → parents see monthly only.
//
// There is deliberately NO global flag and NO per-academy allowlist any more.
// The previous allowlist quietly limited quarterly to one academy while every
// other academy's Settings showed the toggle ON — three owners believed they
// offered it and their parents never saw it. That is the seventh billing
// inconsistency this year; do not reintroduce one.
// ============================================================================

// Shown when a quarterly request is blocked at the API layer (academy has it off).
export const QUARTERLY_UNAVAILABLE_MESSAGE = 'Quarterly billing is not offered by this academy.'

/**
 * Quarterly is offered for an academy unless the academy has switched it off.
 * `orgFlag` is `organisations.quarterly_billing_enabled`: true/null/undefined
 * = on, false = off.
 */
export function isQuarterlyEnabledForOrg(orgId: string | null | undefined, orgFlag?: boolean | null): boolean {
  if (!orgId) return false
  return orgFlag !== false
}

/** Client-side equivalent — identical truth table (no env reads). */
export function isQuarterlyEnabledForOrgPublic(orgId: string | null | undefined, orgFlag?: boolean | null): boolean {
  return isQuarterlyEnabledForOrg(orgId, orgFlag)
}
