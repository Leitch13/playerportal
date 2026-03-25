import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

// Returns Unix timestamp for the 1st of next month at midnight UTC
function getFirstOfNextMonth(): number {
  const now = new Date()
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return Math.floor(nextMonth.getTime() / 1000)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // billingOption: 'monthly' (default) or 'quarterly' (3 months, 10% off)
    const { planId, playerId, billingOption } = await request.json()
    if (!planId) {
      return NextResponse.json({ error: 'Missing planId' }, { status: 400 })
    }

    const isQuarterly = billingOption === 'quarterly'

    // Fetch the plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Look up the organisation's Stripe Connect account (if any).
    // When the org has completed Connect onboarding the payment flows
    // through their connected account and the platform takes a 5% fee.
    const { data: planOrg } = await supabase
      .from('organisations')
      .select('stripe_account_id')
      .eq('id', plan.organisation_id)
      .single()

    const connectedAccountId = planOrg?.stripe_account_id as string | null

    /** Platform fee rate applied to connected-account payments */
    const PLATFORM_FEE_RATE = 0.05

    // Fetch parent profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, stripe_customer_id')
      .eq('id', user.id)
      .single()

    // Get or create Stripe customer
    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email || '',
        name: profile?.full_name || '',
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Get or create the Stripe Product
    let stripeProductId = plan.stripe_product_id

    if (!stripeProductId) {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description || `${plan.name} - ${plan.sessions_per_week} session(s)/week`,
        metadata: { supabase_plan_id: plan.id },
      })
      stripeProductId = product.id

      await supabase
        .from('subscription_plans')
        .update({ stripe_product_id: stripeProductId })
        .eq('id', plan.id)
    }

    const origin = request.headers.get('origin') || 'http://localhost:3000'

    if (isQuarterly) {
      // ═══ QUARTERLY: Pay 3 months upfront with 10% discount ═══
      // One-time payment (not recurring subscription) — covers 3 full months
      const monthlyAmount = Number(plan.amount)
      const quarterlyTotal = monthlyAmount * 3
      const discountedTotal = Math.round(quarterlyTotal * 0.9 * 100) // 10% off, in pence

      // Create a one-time price for the quarterly payment
      const quarterlyPrice = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: discountedTotal,
        currency: 'gbp',
        metadata: {
          supabase_plan_id: plan.id,
          billing_option: 'quarterly',
          months_covered: '3',
          discount_percent: '10',
        },
      })

      const quarterlySessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        line_items: [
          {
            price: quarterlyPrice.id,
            quantity: 1,
          },
        ],
        mode: 'payment',
        payment_method_types: ['card'],
        success_url: `${origin}/dashboard/payments?sub_success=1&billing=quarterly`,
        cancel_url: `${origin}/dashboard/payments?sub_cancelled=1`,
        metadata: {
          supabase_plan_id: planId,
          supabase_user_id: user.id,
          supabase_player_id: playerId || '',
          billing_option: 'quarterly',
          months_covered: '3',
        },
      }

      // Route payment through the connected account with a 5% platform fee
      if (connectedAccountId) {
        quarterlySessionParams.payment_intent_data = {
          application_fee_amount: Math.round(discountedTotal * PLATFORM_FEE_RATE),
          transfer_data: {
            destination: connectedAccountId,
          },
        }
      }

      const session = await stripe.checkout.sessions.create(quarterlySessionParams)

      return NextResponse.json({
        url: session.url,
        billing: 'quarterly',
        total: (discountedTotal / 100).toFixed(2),
        saving: ((quarterlyTotal * 0.1)).toFixed(2),
      })
    }

    // ═══ MONTHLY: Standard recurring subscription ═══
    // Get or create the Stripe recurring Price for this plan
    let stripePriceId = plan.stripe_price_id

    if (!stripePriceId) {
      const price = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: Math.round(Number(plan.amount) * 100), // pence
        currency: 'gbp',
        recurring: {
          interval: plan.interval === 'year' ? 'year' : 'month',
        },
        metadata: { supabase_plan_id: plan.id, billing_option: 'monthly' },
      })
      stripePriceId = price.id

      await supabase
        .from('subscription_plans')
        .update({ stripe_price_id: stripePriceId })
        .eq('id', plan.id)
    }

    // Create Checkout Session in subscription mode
    // Stripe handles proration automatically for mid-month signups
    const monthlySessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      payment_method_types: ['card'],
      success_url: `${origin}/dashboard/payments?sub_success=1&billing=monthly`,
      cancel_url: `${origin}/dashboard/payments?sub_cancelled=1`,
      metadata: {
        supabase_plan_id: planId,
        supabase_user_id: user.id,
        supabase_player_id: playerId || '',
        billing_option: 'monthly',
      },
      subscription_data: {
        metadata: {
          supabase_plan_id: planId,
          supabase_user_id: user.id,
          supabase_player_id: playerId || '',
        },
        // Anchor billing to the 1st of next month so all parents
        // are charged on the same date — Stripe automatically prorates
        // the first invoice from signup to anchor date
        billing_cycle_anchor: getFirstOfNextMonth(),
        // For connected accounts, apply 5% platform fee on every invoice
        ...(connectedAccountId
          ? {
              application_fee_percent: PLATFORM_FEE_RATE * 100,
              transfer_data: {
                destination: connectedAccountId,
              },
            }
          : {}),
      },
    }

    const session = await stripe.checkout.sessions.create(monthlySessionParams)

    return NextResponse.json({ url: session.url, billing: 'monthly' })
  } catch (err) {
    console.error('Stripe subscribe error:', err)
    return NextResponse.json(
      { error: 'Failed to create subscription checkout' },
      { status: 500 }
    )
  }
}
