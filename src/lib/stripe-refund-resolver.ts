import { stripe } from '@/lib/stripe'

/**
 * Resolve the underlying Stripe charge_id from a checkout_session_id.
 *
 * We use destination charges (on_behalf_of + transfer_data.destination)
 * for every payment in this app — verified empirically against live
 * production charges before Phase 1A was built. Destination charges
 * live on the PLATFORM account, so the resolver here never needs a
 * stripeAccount header.
 *
 * Resolution path:
 *   session.id  ──retrieve──▶  session.payment_intent
 *                              .latest_charge.id   ← what we want
 *
 * Returns null if any step fails (missing PI, charge not yet generated,
 * Stripe API error). The caller MUST treat null as a hard refund-failure
 * and surface "Could not resolve the charge" to the admin.
 */
export async function getChargeIdFromSession(sessionId: string): Promise<string | null> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge'],
    })

    if (session.payment_intent && typeof session.payment_intent === 'object') {
      const charge = session.payment_intent.latest_charge
      if (typeof charge === 'string') return charge
      if (charge && typeof charge === 'object' && charge.id) return charge.id
    }

    if (typeof session.payment_intent === 'string') {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
        expand: ['latest_charge'],
      })
      const charge = pi.latest_charge
      if (typeof charge === 'string') return charge
      if (charge && typeof charge === 'object' && charge.id) return charge.id
    }

    return null
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe-refund-resolver] failed to resolve charge from session:', message)
    return null
  }
}
