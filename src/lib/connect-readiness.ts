import { stripe } from '@/lib/stripe'

// Stripe Connect readiness pre-flight — single source of truth.
//
// Presence of `stripe_account_id` is NOT enough to take money: an academy can
// have a connected account that can't yet take charges (onboarding incomplete →
// charges_enabled=false, or the transfers capability not yet active). Taking a
// payment in that state fails mid-checkout with a raw Stripe error and the money
// never reaches the academy. This mirrors the live pre-flight already proven in
// /api/migration/confirm-checkout, factored out so subscription + camp checkout
// enforce it identically.
//
// Fail-CLOSED: any Stripe error (network, bad id, etc.) returns NOT ready, so we
// never open a Checkout session we can't fulfil.

/** Parent-facing copy for a blocked checkout. Keep generic + reassuring. */
export const CONNECT_NOT_READY_MESSAGE =
  'This academy is still finishing their payment setup. Payments are not available yet — please check back soon.'

/**
 * True only when the connected account can actually take a Connect-routed
 * charge: charges_enabled === true AND the transfers capability is active (or
 * absent, matching confirm-checkout's existing tolerance). Live Stripe read;
 * call on a deliberate checkout action, not on page render.
 */
export async function isConnectChargeReady(accountId: string | null | undefined): Promise<boolean> {
  if (!accountId) return false
  try {
    const acct = await stripe.accounts.retrieve(accountId)
    const transfersCap = acct.capabilities?.transfers
    const chargesOk = acct.charges_enabled === true
    // Block if charges are off, or if the transfers capability exists but isn't active.
    const transfersOk = transfersCap === undefined || transfersCap === 'active'
    return chargesOk && transfersOk
  } catch {
    return false
  }
}
