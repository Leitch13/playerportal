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

    // Find the org behind this subscription to load its retention settings
    const { data: orgId } = await supabase.rpc('get_my_org')
    const { data: org } = await supabase
      .from('organisations')
      .select('id, name, retention_offer_enabled, retention_offer_percent, retention_offer_months, stripe_retention_coupon_id')
      .eq('id', orgId)
      .single()

    if (!org?.retention_offer_enabled) {
      return NextResponse.json({ error: 'Retention offer is not enabled for this academy.' }, { status: 400 })
    }

    const percent = Math.max(1, Math.min(90, Number(org.retention_offer_percent ?? 25)))
    const months = org.retention_offer_months != null ? Number(org.retention_offer_months) : null

    // Get or create the Stripe coupon for this org's retention offer.
    // Cached on the org row so we don't create duplicates.
    let couponId = org.stripe_retention_coupon_id as string | null

    if (!couponId) {
      const couponName = months
        ? `${percent}% off for ${months} month${months !== 1 ? 's' : ''} — Retention`
        : `${percent}% off forever — Retention`

      const couponParams: Record<string, unknown> = {
        name: couponName,
        percent_off: percent,
        metadata: { organisation_id: org.id, type: 'retention' },
      }

      if (months) {
        couponParams.duration = 'repeating'
        couponParams.duration_in_months = months
      } else {
        couponParams.duration = 'forever'
      }

      const coupon = await stripe.coupons.create(couponParams as unknown as import('stripe').Stripe.CouponCreateParams)
      couponId = coupon.id

      await supabase
        .from('organisations')
        .update({ stripe_retention_coupon_id: couponId })
        .eq('id', org.id)
    }

    // Apply the discount to the subscription + undo any pending cancellation
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
      coupon: couponId,
    })

    // Mark the cancellation record as retained
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

    // Friendly notification copy that reflects the actual offer
    const durationText = months ? `for ${months} month${months !== 1 ? 's' : ''}` : 'forever'
    await supabase.from('notifications').insert({
      profile_id: user.id,
      organisation_id: orgId,
      type: 'subscription',
      title: `${percent}% discount applied!`,
      body: `Your subscription continues with ${percent}% off ${durationText}. Thanks for staying!`,
      link: '/dashboard/payments',
    })

    // Calculate new price for response
    const originalAmount = (currentItem.price?.unit_amount || 0) / 100
    const discountedAmount = originalAmount * (1 - percent / 100)

    return NextResponse.json({
      success: true,
      originalAmount: originalAmount.toFixed(2),
      discountedAmount: discountedAmount.toFixed(2),
      saving: (originalAmount - discountedAmount).toFixed(2),
      percentOff: percent,
      durationMonths: months,
      message: months
        ? `${percent}% off for ${months} month${months !== 1 ? 's' : ''}. You now pay £${discountedAmount.toFixed(2)}/month.`
        : `${percent}% off forever! You now pay £${discountedAmount.toFixed(2)}/month.`,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to apply discount' }, { status: 500 })
  }
}
