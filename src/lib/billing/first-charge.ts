import type Stripe from 'stripe'
import { firstChargeFor, firstChargeLabel, type FirstCharge } from './sessions'
import { firstOfNextMonthUnix } from './anchor'
import { feePercentFromRate } from '@/lib/stripe-fee'

/**
 * The one Stripe shape for a monthly membership that starts now.
 *
 *   line 1  recurring plan price — first bills on the anchor (1st of next month)
 *   line 2  one-off "Sessions this month — {plan}" for firstChargeFor().pence
 *           (omitted when £0 is due today)
 *   subscription_data.billing_cycle_anchor = anchor
 *   subscription_data.proration_behavior   = 'none'   ← never Stripe day-proration
 *
 * Today's invoice is therefore exactly the bridge; the 1st's invoice is exactly
 * the plan. Preview, charge and receipt all come from the same FirstCharge.
 * Connect routing (on_behalf_of / transfer_data / application_fee_percent) is
 * identical to every other Checkout in the app.
 */
export interface SessionsBridgeInput {
  customerId: string
  planName: string
  monthlyPounds: number
  stripePriceId: string
  startIso: string
  classDayOfWeek: string | null
  connectedAccountId: string | null
  platformFeeRate: number
  successUrl: string
  cancelUrl: string
  /** Written to BOTH session.metadata and subscription_data.metadata. */
  metadata: Record<string, string>
  siblingCouponId?: string | null
}

export interface SessionsBridgeCheckout {
  params: Stripe.Checkout.SessionCreateParams
  firstCharge: FirstCharge
  anchorUnix: number
}

export function sessionsBridgeCheckout(input: SessionsBridgeInput): SessionsBridgeCheckout {
  const startDate = new Date(input.startIso + 'T00:00:00Z')
  const anchorUnix = firstOfNextMonthUnix(startDate)
  const anchorIso = new Date(anchorUnix * 1000).toISOString().slice(0, 10)
  const fc = firstChargeFor(input.monthlyPounds, input.startIso, anchorIso, input.classDayOfWeek)
  const anchorLabel = new Date(anchorUnix * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: input.stripePriceId, quantity: 1 }]
  if (fc.pence > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        unit_amount: fc.pence,
        product_data: {
          name: `Sessions this month — ${input.planName}`,
          description: `${firstChargeLabel(fc)}. Your £${input.monthlyPounds.toFixed(2)}/month membership starts ${anchorLabel}.`,
        },
      },
      quantity: 1,
    })
  }

  const metadata = {
    ...input.metadata,
    billing_model: 'sessions_bridge',
    pp_flow: 'sessions_bridge',
    activates_on: input.startIso,
    bridge_pence: String(fc.pence),
    bridge_sessions_remaining: String(fc.sessions),
    bridge_basis: fc.basis,
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    customer: input.customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: lineItems,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    ...(input.siblingCouponId ? { discounts: [{ coupon: input.siblingCouponId }] } : {}),
    metadata,
    subscription_data: {
      metadata,
      billing_cycle_anchor: anchorUnix,
      proration_behavior: 'none',
      ...(input.connectedAccountId
        ? {
            on_behalf_of: input.connectedAccountId,
            ...(input.platformFeeRate > 0 ? { application_fee_percent: feePercentFromRate(input.platformFeeRate) } : {}),
            transfer_data: { destination: input.connectedAccountId },
          }
        : {}),
    },
  }
  return { params, firstCharge: fc, anchorUnix }
}
