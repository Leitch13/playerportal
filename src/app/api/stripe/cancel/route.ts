import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subscriptionId, reason, reasonDetail } = await request.json()
    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 })
    }

    const { data: orgId } = await supabase.rpc('get_my_org')

    // Honour the academy's cancellation notice policy. If notice_days > 0,
    // schedule cancellation for (today + notice_days). Otherwise fall back to
    // "end of current billing period" (Stripe default).
    const { data: orgPolicy } = await supabase
      .from('organisations')
      .select('cancellation_notice_days')
      .eq('id', orgId)
      .single()
    const noticeDays = Number(orgPolicy?.cancellation_notice_days || 0)

    let subscription
    if (noticeDays > 0) {
      const cancelAtSec = Math.floor(Date.now() / 1000) + noticeDays * 86400
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at: cancelAtSec,
      })
    } else {
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })
    }

    const cancelAtSec = (subscription.cancel_at as number | null) ?? subscription.current_period_end
    const endDate = new Date(cancelAtSec * 1000).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    // Record cancellation
    await supabase.from('cancellations').insert({
      profile_id: user.id,
      organisation_id: orgId,
      subscription_id: subscriptionId,
      reason: reason || null,
      reason_detail: reasonDetail || null,
      offered_discount: true,
      accepted_discount: false,
      final_status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })

    // Create notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      organisation_id: orgId,
      type: 'subscription',
      title: 'Subscription cancelled',
      body: `Your subscription will end on ${endDate}. You can re-subscribe any time.`,
      link: '/dashboard/payments',
    })

    // Send cancellation confirmation email
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const { data: org } = await supabase
      .from('organisations')
      .select('name')
      .eq('id', orgId)
      .single()

    if (profile?.email) {
      try {
        const { sendEmail } = await import('@/lib/email')
        const { cancellationConfirmEmail } = await import('@/lib/email-templates')
        const template = cancellationConfirmEmail({
          parentName: profile.full_name?.split(' ')[0] || 'there',
          planName: 'Subscription',
          endDate,
          academyName: org?.name || 'Your Academy',
        })
        await sendEmail({ to: profile.email, ...template })
      } catch { /* email optional */ }
    }

    return NextResponse.json({
      success: true,
      endDate,
      message: `Your subscription will remain active until ${endDate}`,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}
