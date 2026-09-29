/**
 * Pausing a membership, the same for every academy.
 *
 * A pause lives in Stripe as `pause_collection: { behavior: 'void' }`: the
 * subscription stays, each bill while paused is voided (no charge, nothing to
 * refund), and Resume clears it so charging carries on from the next bill.
 * Our `subscriptions.status` says 'paused' whenever Stripe has a pause on,
 * whatever Stripe's own status is. Until 29 Sep 2026 Pause only wrote
 * 'paused' to our database: Stripe kept charging and the next Stripe update
 * flipped the row back to active (Gold & Gray).
 */

export type StripeSubLike = { status: string; pause_collection?: { behavior?: string } | null }

/** The status to store for a Stripe subscription. */
export function effectiveStatus(sub: StripeSubLike): string {
  return sub.pause_collection ? 'paused' : sub.status
}

/** Which of our statuses can be paused. Past-due is left alone: its failed bill is still being retried. */
export function canPause(status: string): boolean {
  return status === 'active' || status === 'trialing'
}
