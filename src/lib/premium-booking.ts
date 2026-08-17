// ─── Premium booking page — per-org rollout gate ────────────────────────────
//
// The public booking page (/book/[slug]) is the live money funnel for every
// academy. The premium re-skin (PremiumBookingView) therefore rolls out one
// org at a time: an academy gets the premium look ONLY if its org id is in
// this allowlist. Every other academy renders the existing page byte-for-byte
// — the gate is a single early-return branch in page.tsx, nothing else.
//
// ROLLOUT MECHANISM: to move an academy onto the premium page, add its
// organisation id to PREMIUM_BOOKING_ORG_IDS below (with a comment saying
// which academy it is), or — for a no-deploy toggle — add the id to the
// PREMIUM_BOOKING_ORGS env var (comma-separated, additive on top of this
// list). Removing the id rolls it back.
//
// NOTE: the premium view only applies on the FLAT (non-grouped) render path
// (≤12 published classes). If a premium org ever crosses the grouped-view
// threshold the gate simply won't fire and it falls back to the grouped view.

export const PREMIUM_BOOKING_ORG_IDS = new Set<string>([
  '1aa5e627-d8cb-45f3-b460-d155d4d3c12b', // Granite City FA — tester (John's pilot org)
])

/** Additive env override: PREMIUM_BOOKING_ORGS="id1,id2" */
function envPremiumOrgIds(): string[] {
  return (process.env.PREMIUM_BOOKING_ORGS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isPremiumBookingOrg(orgId: string | null | undefined): boolean {
  if (!orgId) return false
  return PREMIUM_BOOKING_ORG_IDS.has(orgId) || envPremiumOrgIds().includes(orgId)
}
