import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

const RETENTION_COUPON_NAME = 'retention-25-percent-off'

async function getOrCreateCoupon(): Promise<string> {
  // Try to find existing coupon
  const coupons = await stripe.coupons.list({ limit: 100 })
  const existing = coupons.data.find(
    (c) => c.name === RETENTION_COUPON_NAME || c.id === RETENTION_COUPON_NAME
  )

  if (existing) return existing.id

  // Create the 25% off forever coupon
  const coupon = await stripe.coupons.create({
    id: RETENTION_COUPON_NAME,
    name: RETENTION_COUPON_NAME,
    percent_off: 25,
    duration: 'forever',
  })

  return coupon.id
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

    const { subscriptionId } = await request.json()
    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 })
    }

    // Verify the subscription belongs to this user
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('id', subscriptionId)
      .eq('parent_id', user.id)
      .single()

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Check if already has a discount
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
    if (stripeSub.discount) {
      return NextResponse.json({ error: 'A discount is already applied to this subscription' }, { status: 400 })
    }

    // Get or create the retention coupon
    const couponId = await getOrCreateCoupon()

    // Apply the coupon to the subscription
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      coupon: couponId,
      // If they were cancelling, un-cancel
      cancel_at_period_end: false,
    })

    // Update local record — un-cancel if it was pending
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)

    return NextResponse.json({ success: true, discount: '25%' })
  } catch (err) {
    console.error('Apply discount error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
