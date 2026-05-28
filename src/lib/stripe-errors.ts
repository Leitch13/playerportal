/**
 * Map raw Stripe errors to parent-friendly messages for public checkout routes.
 *
 * The most common one at launch: an academy that hasn't finished Stripe Connect
 * onboarding (transfers capability not yet enabled) produces a scary message
 * like "Your destination account needs to have ... transfers ... enabled". A
 * parent should never see that — they should see something human, and the
 * academy gets nudged to finish setup.
 *
 * Non-capability errors pass through unchanged so launch debugging still works.
 */
export function mapStripeCheckoutError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/capabilit|transfers|crypto_transfers|legacy_payments|destination account/i.test(msg)) {
    return 'This academy is still finishing their payment setup, so bookings can’t be taken just yet. Please check back soon — or get in touch with the academy directly.'
  }
  return msg
}
