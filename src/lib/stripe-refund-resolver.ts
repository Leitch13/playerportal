import { stripe } from '@/lib/stripe'

/**
 * Resolve the underlying Stripe charge from a payments.stripe_session_id.
 *
 * Phase 1B dispatch — three paths verified empirically against production
 * via scripts/_verify_subscription_refund_ownership.mjs:
 *
 *   id.startsWith('in_')                        → invoice → invoice.charge
 *   id.startsWith('cs_') + mode='subscription'  → session → invoice → invoice.charge
 *   id.startsWith('cs_') + mode='payment'       → session → payment_intent.latest_charge
 *
 * All three resolve to a destination-charge living on the platform Stripe
 * account (verified: on_behalf_of + transfer_data.destination set on every
 * sample). The refund call is therefore the same for all three:
 *
 *   stripe.refunds.create({ charge, reverse_transfer:true, refund_application_fee:true })
 *   // NO stripeAccount header
 *
 * Returns charge_id + subscription_id (when the payment is a sub) so the
 * caller can run stripe.subscriptions.cancel() as part of refund+cancel.
 *
 * Returns null for both fields if anything fails — the caller MUST treat
 * a null charge_id as a hard refund-failure and surface "Could not resolve".
 */
export interface ResolveResult {
  charge_id: string | null
  subscription_id: string | null
  kind: 'invoice' | 'session_subscription' | 'session_payment' | 'unknown'
}

export async function resolveChargeAndSubscription(
  stripeSessionId: string
): Promise<ResolveResult> {
  const empty: ResolveResult = { charge_id: null, subscription_id: null, kind: 'unknown' }

  if (!stripeSessionId) return empty

  // ─── Renewal-shape: invoice id stored as session_id ───
  if (stripeSessionId.startsWith('in_')) {
    try {
      const inv = await stripe.invoices.retrieve(stripeSessionId, {
        expand: ['charge', 'subscription'],
      })
      const charge_id =
        typeof inv.charge === 'string'
          ? inv.charge
          : (inv.charge as { id?: string } | null)?.id ?? null
      const subscription_id =
        typeof inv.subscription === 'string'
          ? inv.subscription
          : (inv.subscription as { id?: string } | null)?.id ?? null
      return { charge_id, subscription_id, kind: 'invoice' }
    } catch (err) {
      console.error('[stripe-refund-resolver] invoice retrieve failed', {
        id: stripeSessionId,
        error: err instanceof Error ? err.message : String(err),
      })
      return empty
    }
  }

  // ─── Checkout-session-shape ───
  if (stripeSessionId.startsWith('cs_')) {
    try {
      const session = await stripe.checkout.sessions.retrieve(stripeSessionId, {
        expand: [
          'payment_intent.latest_charge',
          'invoice',
          'invoice.charge',
          'subscription',
        ],
      })

      // (a) Subscription-mode session — charge lives behind invoice
      if (session.mode === 'subscription') {
        const invObj =
          session.invoice && typeof session.invoice === 'object' ? session.invoice : null
        let charge_id: string | null = null
        if (invObj && typeof invObj.charge === 'string') charge_id = invObj.charge
        else if (invObj && invObj.charge && typeof invObj.charge === 'object')
          charge_id = (invObj.charge as { id?: string }).id ?? null

        const subscription_id =
          typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as { id?: string } | null)?.id ?? null

        return { charge_id, subscription_id, kind: 'session_subscription' }
      }

      // (b) Payment-mode session — charge behind payment_intent
      //     (camp bookings, tonight_then_sub bridge payments)
      if (session.mode === 'payment') {
        const piObj =
          session.payment_intent && typeof session.payment_intent === 'object'
            ? session.payment_intent
            : null
        let charge_id: string | null = null
        if (piObj && typeof piObj.latest_charge === 'string')
          charge_id = piObj.latest_charge
        else if (piObj && piObj.latest_charge && typeof piObj.latest_charge === 'object')
          charge_id = (piObj.latest_charge as { id?: string }).id ?? null

        return { charge_id, subscription_id: null, kind: 'session_payment' }
      }

      console.warn('[stripe-refund-resolver] unexpected session mode', {
        id: stripeSessionId,
        mode: session.mode,
      })
      return empty
    } catch (err) {
      console.error('[stripe-refund-resolver] session retrieve failed', {
        id: stripeSessionId,
        error: err instanceof Error ? err.message : String(err),
      })
      return empty
    }
  }

  console.warn('[stripe-refund-resolver] unknown id prefix', {
    prefix: stripeSessionId.slice(0, 4),
  })
  return empty
}

/**
 * Phase 1A back-compat wrapper. New code should call
 * `resolveChargeAndSubscription` directly to also get the subscription_id.
 */
export async function getChargeIdFromSession(sessionId: string): Promise<string | null> {
  const r = await resolveChargeAndSubscription(sessionId)
  return r.charge_id
}
