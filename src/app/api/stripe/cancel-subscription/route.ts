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

    const { subscriptionId, reason, reasonText } = await request.json()
    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 })
    }

    // Verify the subscription belongs to this user
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, organisation_id')
      .eq('id', subscriptionId)
      .eq('parent_id', user.id)
      .single()

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Cancel at end of period (not immediately)
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
      metadata: {
        cancel_reason: reason || '',
        cancel_reason_text: reasonText || '',
      },
    })

    // Update local record
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        cancel_reason: reason || null,
        cancel_reason_text: reasonText || null,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)

    // Create notification for the parent
    await supabase.from('notifications').insert({
      profile_id: user.id,
      organisation_id: subscription.organisation_id,
      type: 'subscription_cancelled',
      title: 'Subscription cancelled',
      body: 'Your subscription will end at the end of your current billing period. You can re-subscribe any time.',
      link: '/dashboard/payments',
    })

    // Notify admins
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('organisation_id', subscription.organisation_id)
      .eq('role', 'admin')

    for (const admin of admins || []) {
      await supabase.from('notifications').insert({
        profile_id: admin.id,
        organisation_id: subscription.organisation_id,
        type: 'churn_alert',
        title: 'A parent cancelled their subscription',
        body: `Reason: ${reasonText || reason || 'Not specified'}`,
        link: '/dashboard/payments',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Cancel subscription error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
