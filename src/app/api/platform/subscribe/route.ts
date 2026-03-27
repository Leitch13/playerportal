import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planSlug } = await request.json()
    if (!planSlug) {
      return NextResponse.json({ error: 'Missing planSlug' }, { status: 400 })
    }

    // Get user's organisation
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.organisation_id || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can manage billing' }, { status: 403 })
    }

    // Get the platform plan
    const { data: plan, error: planError } = await supabase
      .from('platform_plans')
      .select('*')
      .eq('slug', planSlug)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Get the organisation
    const { data: org } = await supabase
      .from('organisations')
      .select('id, name, platform_stripe_subscription_id')
      .eq('id', profile.organisation_id)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
    }

    // If they already have an active subscription, create a Stripe billing portal
    // session so they can upgrade/downgrade
    if (org.platform_stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(
        org.platform_stripe_subscription_id
      )
      if (subscription && subscription.status !== 'canceled') {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: subscription.customer as string,
          return_url: `${request.headers.get('origin') || 'https://theplayerportal.net'}/dashboard/settings`,
        })
        return NextResponse.json({ url: portalSession.url, portal: true })
      }
    }

    // Create or get a Stripe product for this platform plan
    const productName = `Player Portal - ${plan.name} Plan`
    const products = await stripe.products.search({
      query: `metadata["platform_plan_slug"]:"${plan.slug}"`,
    })

    let productId: string
    if (products.data.length > 0) {
      productId = products.data[0].id
    } else {
      const product = await stripe.products.create({
        name: productName,
        metadata: { platform_plan_slug: plan.slug, platform_plan_id: plan.id },
      })
      productId = product.id
    }

    // Create a recurring price
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(Number(plan.monthly_price) * 100),
      currency: 'gbp',
      recurring: { interval: 'month' },
      metadata: { platform_plan_slug: plan.slug },
    })

    const origin = request.headers.get('origin') || 'https://theplayerportal.net'

    // Create a checkout session for the academy owner
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email || undefined,
      line_items: [{ price: price.id, quantity: 1 }],
      mode: 'subscription',
      payment_method_types: ['card'],
      success_url: `${origin}/dashboard/settings?platform_billing=success`,
      cancel_url: `${origin}/dashboard/settings?platform_billing=cancelled`,
      metadata: {
        platform_plan_id: plan.id,
        platform_plan_slug: plan.slug,
        organisation_id: org.id,
        type: 'platform_subscription',
      },
      subscription_data: {
        metadata: {
          platform_plan_id: plan.id,
          platform_plan_slug: plan.slug,
          organisation_id: org.id,
          type: 'platform_subscription',
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Platform subscribe error:', err)
    return NextResponse.json(
      { error: 'Failed to create platform subscription checkout' },
      { status: 500 }
    )
  }
}
