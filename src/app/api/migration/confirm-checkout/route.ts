import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { QUARTERLY_BILLING_ENABLED, QUARTERLY_UNAVAILABLE_MESSAGE } from '@/lib/quarterly-billing'

export const dynamic = 'force-dynamic'

function getFirstOfNextMonth(): number {
  const now = new Date()
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return Math.floor(nextMonth.getTime() / 1000)
}

/**
 * Confirm-and-pay endpoint for migration invitations. Called by the parent's
 * confirmation page. Validates the token and returns a Stripe Checkout URL
 * pre-filled with the correct plan.
 *
 * No auth required — the token itself is the proof of invitation.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const token = body.token as string | undefined
  const billingOption = (body.billingOption as string) || 'monthly'
  const isQuarterly = billingOption === 'quarterly'

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  // GLOBAL SAFETY GATE — quarterly hard-disabled until rebuilt as recurring.
  // Fires before any Stripe object is created.
  if (isQuarterly && !QUARTERLY_BILLING_ENABLED) {
    return NextResponse.json({ error: QUARTERLY_UNAVAILABLE_MESSAGE }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: sub } = await admin
    .from('subscriptions')
    .select(`
      id, parent_id, player_id, status, invite_token, invite_confirmed_at, migration_billing_starts_at,
      plan:subscription_plans(id, name, amount, stripe_product_id, stripe_price_id, interval),
      org:organisations(id, name, stripe_account_id, platform_plan_id, quarterly_billing_enabled, quarterly_discount_percent)
    `)
    .eq('invite_token', token)
    .maybeSingle()

  if (!sub) {
    return NextResponse.json({ error: 'Invalid or expired invitation.' }, { status: 404 })
  }
  if (sub.invite_confirmed_at) {
    return NextResponse.json({ error: 'This invitation has already been used.' }, { status: 400 })
  }
  if (sub.status !== 'pending_migration') {
    return NextResponse.json({ error: 'This subscription has already been activated.' }, { status: 400 })
  }

  const plan = sub.plan as unknown as { id: string; name: string; amount: number; stripe_product_id: string | null; stripe_price_id: string | null; interval: string }
  const org = sub.org as unknown as { id: string; name: string; stripe_account_id: string | null; platform_plan_id: string | null; quarterly_billing_enabled: boolean | null; quarterly_discount_percent: number | null }

  // Deferred first-charge date (member prepaid elsewhere). Use as Stripe
  // trial_end if it's still in the future; otherwise ignore (prorate as normal).
  let migrationBillingStart: number | null = null
  if (sub.migration_billing_starts_at) {
    const ts = Math.floor(new Date(sub.migration_billing_starts_at as string).getTime() / 1000)
    if (ts > Math.floor(Date.now() / 1000) + 3600) migrationBillingStart = ts
  }

  // Fetch parent profile for customer info
  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name, stripe_customer_id')
    .eq('id', sub.parent_id)
    .single()

  if (!profile?.email) {
    return NextResponse.json({ error: 'No email on file for this parent.' }, { status: 400 })
  }

  // Platform fee rate
  let PLATFORM_FEE_RATE = 0.035
  if (org.platform_plan_id) {
    const { data: platformPlan } = await admin
      .from('platform_plans')
      .select('transaction_fee_percent')
      .eq('id', org.platform_plan_id)
      .single()
    if (platformPlan) {
      PLATFORM_FEE_RATE = Number(platformPlan.transaction_fee_percent) / 100
    }
  }

  // Get/create Stripe customer
  let customerId = profile.stripe_customer_id as string | null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      name: profile.full_name || undefined,
      metadata: { supabase_profile_id: sub.parent_id as string },
    })
    customerId = customer.id
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', sub.parent_id)
  }

  // Get or create Stripe product
  let stripeProductId = plan.stripe_product_id
  if (!stripeProductId) {
    const product = await stripe.products.create({
      name: plan.name,
      metadata: { supabase_plan_id: plan.id },
    })
    stripeProductId = product.id
    await admin.from('subscription_plans').update({ stripe_product_id: stripeProductId }).eq('id', plan.id)
  }

  const origin = request.headers.get('origin') || 'https://theplayerportal.net'
  const connectedAccountId = org.stripe_account_id

  // ── Quarterly path ──
  if (isQuarterly) {
    const qEnabled = org.quarterly_billing_enabled !== false
    const qRate = Math.max(0, Math.min(50, Number(org.quarterly_discount_percent ?? 10))) / 100
    if (!qEnabled) {
      return NextResponse.json({ error: 'Quarterly billing is not offered by this academy.' }, { status: 400 })
    }
    const quarterlyTotal = Number(plan.amount) * 3
    const discountedTotal = Math.round(quarterlyTotal * (1 - qRate) * 100)

    const quarterlyPrice = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: discountedTotal,
      currency: 'gbp',
      metadata: { supabase_plan_id: plan.id, billing_option: 'quarterly', months_covered: '3' },
    })

    const params: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [{ price: quarterlyPrice.id, quantity: 1 }],
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: `${origin}/confirm-subscription/${token}/success`,
      cancel_url: `${origin}/confirm-subscription/${token}`,
      metadata: {
        supabase_subscription_id: sub.id as string,
        supabase_plan_id: plan.id,
        supabase_player_id: (sub.player_id as string) || '',
        supabase_parent_id: sub.parent_id as string,
        billing_option: 'quarterly',
        migration: 'true',
      },
    }

    if (connectedAccountId) {
      const feeAmount = PLATFORM_FEE_RATE > 0 ? Math.round(discountedTotal * PLATFORM_FEE_RATE) : 0
      // on_behalf_of brands the migration Checkout with the academy's Stripe
      // account name instead of the platform's.
      params.payment_intent_data = {
        on_behalf_of: connectedAccountId,
        ...(feeAmount > 0 ? { application_fee_amount: feeAmount } : {}),
        transfer_data: { destination: connectedAccountId },
      }
    }

    const session = await stripe.checkout.sessions.create(params)
    return NextResponse.json({ url: session.url })
  }

  // ── Monthly path ──
  let stripePriceId = plan.stripe_price_id
  if (!stripePriceId) {
    const price = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: Math.round(Number(plan.amount) * 100),
      currency: 'gbp',
      recurring: { interval: plan.interval === 'year' ? 'year' : 'month' },
      metadata: { supabase_plan_id: plan.id, billing_option: 'monthly' },
    })
    stripePriceId = price.id
    await admin.from('subscription_plans').update({ stripe_price_id: stripePriceId }).eq('id', plan.id)
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    mode: 'subscription',
    payment_method_types: ['card'],
    success_url: `${origin}/confirm-subscription/${token}/success`,
    cancel_url: `${origin}/confirm-subscription/${token}`,
    metadata: {
      supabase_subscription_id: sub.id as string,
      supabase_plan_id: plan.id,
      supabase_player_id: (sub.player_id as string) || '',
      supabase_parent_id: sub.parent_id as string,
      billing_option: 'monthly',
      migration: 'true',
    },
    subscription_data: {
      metadata: {
        supabase_subscription_id: sub.id as string,
        supabase_plan_id: plan.id,
        supabase_player_id: (sub.player_id as string) || '',
        supabase_parent_id: sub.parent_id as string,
        migration: 'true',
      },
      // If the admin set a deferred first-charge date (member already prepaid
      // elsewhere), use trial_end so we DON'T charge on confirm — £0 today,
      // first charge on that date. trial_end ⊥ billing_cycle_anchor, so it's
      // one or the other. Otherwise fall back to prorating from the 1st.
      ...(migrationBillingStart
        ? { trial_end: migrationBillingStart }
        : { billing_cycle_anchor: getFirstOfNextMonth() }),
      // on_behalf_of brands the migration subscription with the academy's
      // Stripe account name so renewals stay academy-branded too.
      ...(connectedAccountId
        ? {
            on_behalf_of: connectedAccountId,
            ...(PLATFORM_FEE_RATE > 0 ? { application_fee_percent: PLATFORM_FEE_RATE * 100 } : {}),
            transfer_data: { destination: connectedAccountId },
          }
        : {}),
    },
  }

  const session = await stripe.checkout.sessions.create(params)
  return NextResponse.json({ url: session.url })
}
