// ─────────────────────────────────────────────────────────────────────────────
// /wardrop — ASCEND webinar page constants.
//
// EDIT THESE. Everything the page shows about when the webinar runs, and which
// Meta Pixel it reports to, lives here and nowhere else.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Date and time, taken from Sam's promo graphic ("Wednesday 9th September 7pm").
 * Change both if the session moves.
 */
export const WEBINAR_DATE = 'Wednesday 9 September'
export const WEBINAR_TIME = '7:00pm'

/** Ticket price, shown on the page. The actual charge is set on the Stripe link. */
export const WEBINAR_PRICE = '£5'

/**
 * >>> NOT SUPPLIED YET — replace with the ASCEND Meta Pixel ID. <<<
 *
 * The page fires `Lead` on the site's existing pixel (NEXT_PUBLIC_META_PIXEL_ID)
 * via fbTrack, which is already consent-gated. Set this only if the webinar
 * needs to report to a SEPARATE ASCEND pixel — say the word and I'll wire it.
 */
export const WEBINAR_PIXEL_ID = '[[PIXEL_ID]]'
