/**
 * 1-2-1 Slots · ad hoc Checkout (phase 3).
 *
 * ONE-OFF payment for one held session, in Stripe Checkout payment mode,
 * routed to the academy's connected account exactly the way camps are:
 * on_behalf_of + transfer_data + the platform's application fee.
 *
 * There is no subscription here. There will never be one in this module.
 * The card is saved off-session so a parent who becomes a regular later
 * can be charged on the 1st without typing it again (phase 4).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { isConnectChargeReady, CONNECT_NOT_READY_MESSAGE } from '@/lib/connect-readiness'
import { hhmm, fmtDate } from './db'

export const ONE_TO_ONE_MODULE = 'one_to_one'

export class CheckoutBlocked extends Error {
  status: number
  constructor(message: string, status = 503) { super(message); this.status = status }
}

/** The academy's platform fee rate, default 3.5%, same lookup camps use. */
export async function platformFeeRate(admin: SupabaseClient, orgId: string): Promise<{ rate: number; stripeAccountId: string }> {
  const { data: org } = await admin.from('organisations').select('stripe_account_id, platform_plan_id').eq('id', orgId).single()
  if (!org?.stripe_account_id) throw new CheckoutBlocked('This academy is still finishing their payment setup. Sessions can\'t be paid for just yet.')
  if (!(await isConnectChargeReady(org.stripe_account_id))) throw new CheckoutBlocked(CONNECT_NOT_READY_MESSAGE)
  let rate = 0.035
  if (org.platform_plan_id) {
    const { data: plan } = await admin.from('platform_plans').select('transaction_fee_percent').eq('id', org.platform_plan_id).single()
    if (plan && plan.transaction_fee_percent != null) rate = Number(plan.transaction_fee_percent) / 100
  }
  return { rate, stripeAccountId: org.stripe_account_id as string }
}

export interface AdhocCheckoutInput {
  admin: SupabaseClient
  orgId: string
  orgName: string
  slug: string
  origin: string
  session: {
    id: string; session_date: string; start_minutes: number; duration_minutes: number
    price_pence: number; session_type: string; hold_token: string | null
    guest_name: string | null; guest_email: string | null; guest_child_name: string | null
  }
  coachName: string
  venueName: string
}

export async function createAdhocCheckout(input: AdhocCheckoutInput): Promise<{ url: string; checkoutId: string }> {
  const { admin, orgId, orgName, slug, origin, session: s } = input
  if (!s.guest_email) throw new CheckoutBlocked('An email address is needed for the receipt', 400)
  if (s.price_pence <= 0) throw new CheckoutBlocked('This session has no price', 400)
  const { rate, stripeAccountId } = await platformFeeRate(admin, orgId)
  const feeAmount = rate > 0 ? Math.round(s.price_pence * rate) : 0
  const when = `${fmtDate(s.session_date)} ${hhmm(s.start_minutes)}`
  const label = `${s.session_type === 'two_to_one' ? '2-to-1' : '1-to-1'} session · ${when}`

  const checkout = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: s.guest_email,
    customer_creation: 'always',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'gbp',
        unit_amount: s.price_pence,
        product_data: {
          name: label,
          description: `${s.guest_child_name || 'Session'} with ${input.coachName} at ${input.venueName} · ${orgName}`,
        },
      },
    }],
    payment_intent_data: {
      on_behalf_of: stripeAccountId,
      transfer_data: { destination: stripeAccountId },
      ...(feeAmount > 0 ? { application_fee_amount: feeAmount } : {}),
      setup_future_usage: 'off_session',
      description: `${orgName} · ${label}`,
      metadata: { pp_module: ONE_TO_ONE_MODULE, coaching_session_id: s.id, organisation_id: orgId },
    },
    // A hold lasts 12 minutes; the Checkout expires with it (Stripe minimum is 30 min, so
    // the hold-expiry cron is the real guard, and the webhook re-checks the row).
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${origin}/book/${slug}/sessions?booked=1&session=${s.id}`,
    cancel_url: `${origin}/book/${slug}/sessions?cancelled=1`,
    metadata: {
      pp_module: ONE_TO_ONE_MODULE,
      coaching_session_id: s.id,
      hold_token: s.hold_token || '',
      organisation_id: orgId,
      guest_child_name: s.guest_child_name || '',
    },
  })
  if (!checkout.url) throw new CheckoutBlocked('Stripe did not return a payment page', 502)
  return { url: checkout.url, checkoutId: checkout.id }
}
