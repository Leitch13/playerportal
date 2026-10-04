// ─── Tidy booking page — per-academy rollout gate ───────────────────────────
//
// The public booking page (/book/[slug]) is where every academy's parents
// sign up, so the tidy layout (TidyClassList: the academy's intro, then every
// class in one consistent shape) rolls out one academy at a time. An academy
// gets it only if its organisation id is in this list. Everyone else renders
// the existing page unchanged.
//
// This is LOOK ONLY. It changes no price, plan, link or charge: every "Book"
// goes to the same /book/[slug]/class/[id] page as before. It is not a billing
// switch, so the "no per-academy flags on money" rule does not apply to it.
//
// To move an academy onto it: add its id below with a comment naming it, or
// set TIDY_BOOKING_ORGS="id1,id2" (no deploy needed). Removing the id rolls
// it back. Any academy's page can also be previewed with ?look=tidy on the
// end of its booking link, without switching it on for parents.

export const TIDY_BOOKING_ORG_IDS = new Set<string>([
  '1aa5e627-d8cb-45f3-b460-d155d4d3c12b', // Granite City FA — John's own demo academy
])

export function isTidyBookingOrg(orgId: string | null | undefined): boolean {
  if (!orgId) return false
  const env = (process.env.TIDY_BOOKING_ORGS || '').split(',').map((s) => s.trim()).filter(Boolean)
  return TIDY_BOOKING_ORG_IDS.has(orgId) || env.includes(orgId)
}
