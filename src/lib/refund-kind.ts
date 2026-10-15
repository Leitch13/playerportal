/**
 * Which payments the academy can refund from the app, and what kind they are.
 *
 * Every payment taken by card through Stripe can be refunded: it has a Checkout
 * session (cs_) or a membership invoice (in_) that leads to the card charge.
 * The kind only decides the side effects:
 *   camp         → a full refund frees the place
 *   subscription → the academy can also cancel the membership
 *   bridge       → the first part-month payment of a membership ("First session",
 *                  "Sessions this month"): refund only
 *   one_off      → anything else paid by card (a payment link, a requested payment)
 *
 * Before 15 Oct 2026 only the first three descriptions showed a Refund button, so
 * "Sessions this month" and payment-link payments could only be refunded in Stripe
 * (John: "is it easier to send a refund?").
 */
export type RefundKind = 'camp' | 'subscription' | 'bridge' | 'one_off'

export function refundKind(description: string | null | undefined): RefundKind {
  const d = (description || '').trim()
  if (d.startsWith('Camp:')) return 'camp'
  if (d.startsWith('First session ') || d.startsWith('Sessions this month')) return 'bridge'
  if (d.includes('— subscription') || d.startsWith('Subscription payment')) return 'subscription'
  return 'one_off'
}

/** A Stripe id the refund can follow to the card charge. */
export function hasRefundableStripeId(stripeSessionId: string | null | undefined): boolean {
  return !!stripeSessionId && (stripeSessionId.startsWith('cs_') || stripeSessionId.startsWith('in_'))
}

/** Show the Refund button: paid by card, not already refunded. */
export function canRefund(p: { status?: string | null; stripe_session_id?: string | null }): boolean {
  return p.status === 'paid' && hasRefundableStripeId(p.stripe_session_id)
}
