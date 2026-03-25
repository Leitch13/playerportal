import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subscriptionId } = await request.json()
    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 })
    }

    // Get the subscription to find the current price
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const currentItem = subscription.items.data[0]

    if (!currentItem) {
      return NextResponse.json({ error: 'No subscription items found' }, { status: 400 })
    }

    // Create a 25% off forever coupon (or retrieve existing)
    let coupon
    try {
      coupon = await stripe.coupons.retrieve('RETENTION_25_OFF')
    } catch {
      // Coupon doesn't exist yet — create it
      coupon = await stripe.coupons.create({
        id: 'RETENTION_25_OFF',
        percent_off: 25,
        duration: 'forever',
        name: '25% Off - Retention Offer',
      })
    }

    // Apply the discount to the subscription
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false, // Undo cancellation
      coupon: coupon.id,
    })

    // Update cancellation record
    const { data: orgId } = await supabase.rpc('get_my_org')

    await supabase
      .from('cancellations')
      .update({
        accepted_discount: true,
        final_status: 'retained',
      })
      .eq('profile_id', user.id)
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(1)

    // Notification
    await supabase.from('notifications').insert({
      profile_id: user.id,
      organisation_id: orgId,
      type: 'subscription',
      title: '25% discount applied!',
      body: 'Your subscription continues with 25% off. Thanks for staying!',
      link: '/dashboard/payments',
    })

    // Calculate new price for response
    const originalAmount = (currentItem.price?.unit_amount || 0) / 100
    const discountedAmount = originalAmount * 0.75

    return NextResponse.json({
      success: true,
      originalAmount: originalAmount.toFixed(2),
      discountedAmount: discountedAmount.toFixed(2),
      saving: (originalAmount - discountedAmount).toFixed(2),
      message: `25% discount applied! You now pay £${discountedAmount.toFixed(2)}/month`,
    })
  } catch (err) {
    console.error('Retain error:', err)
    return NextResponse.json({ error: 'Failed to apply discount' }, { status: 500 })
  }
}
