import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

/**
 * Parent cancellation endpoint.
 *
 * Body:
 *   subscriptionId  — Stripe sub id (e.g. sub_1...)
 *   reason          — one of the CHECK-constrained reason codes (see migration 017)
 *   reasonDetail    — optional free text when reason === 'other'
 *   offerWasShown   — true if the retention save-offer was shown but declined;
 *                     drives the offered_discount column + admin notify copy
 *
 * Behaviour:
 *   1. Honours the academy's cancellation_notice_days (migration 061).
 *   2. Mode-mismatch safe-fail: legacy parent subs whose stripe_subscription_id
 *      points at an unreachable Stripe object still get cancelled in our DB
 *      so the parent can leave cleanly. The orphan is logged for admin
 *      reconciliation. Phase 5 finding fix.
 *   3. Records a cancellations row with reason + offered_discount + final_status.
 *   4. Sends parent confirmation email + new admin notification email
 *      including the cancellation reason and whether the save-offer was
 *      declined (so the academy knows why the family left).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subscriptionId, reason, reasonDetail, offerWasShown } = await request.json()
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

    // ─── Stripe cancel with mode-mismatch safe-fail ───
    let endDate = 'the end of your current billing period'
    let orphaned = false
    try {
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
      endDate = new Date(cancelAtSec * 1000).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr)
      if (!/no such subscription/i.test(msg)) {
        throw stripeErr
      }
      // Phase 5 orphan: live key can't see a legacy test-mode sub. Cancel locally so the parent isn't trapped.
      orphaned = true
      endDate = 'immediately (your subscription was already inactive in our payment system)'
      console.warn(`[cancel] orphan: stripe sub ${subscriptionId} not found; cancelling DB row only`)
    }

    // Mirror state in our DB so the dashboard reflects reality.
    await supabase.from('subscriptions').update({
      cancel_at_period_end: true,
      ...(orphaned ? { status: 'canceled', canceled_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', subscriptionId)

    // Record cancellation
    await supabase.from('cancellations').insert({
      profile_id: user.id,
      organisation_id: orgId,
      subscription_id: subscriptionId,
      reason: reason || null,
      reason_detail: reasonDetail || null,
      offered_discount: !!offerWasShown,
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

    // ─── Resolve parent + org context for emails ───
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

    // ─── PARENT confirmation email (existing) ───
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

    // ─── ADMIN notification — new — with reason + offer outcome ───
    // "Notify academy/admin of cancellation reason and whether the offer
    // was accepted or declined." The retention path uses /api/stripe/retain
    // which sends its own admin notify; here we fire when the parent
    // CANCELLED (offer was declined or not shown).
    try {
      const { sendEmail } = await import('@/lib/email')
      const { cancellationAdminNotifyEmail } = await import('@/lib/email-templates')
      const { data: admins } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('organisation_id', orgId)
        .eq('role', 'admin')
      const reasonLabel = labelForReason(reason as string | null | undefined)
      const tpl = cancellationAdminNotifyEmail({
        academyName: org?.name || 'Your academy',
        parentName: profile?.full_name || 'A parent',
        parentEmail: profile?.email || null,
        reasonLabel,
        reasonDetail: reasonDetail || null,
        offerOutcome: offerWasShown ? 'declined' : 'not_shown',
        endDate,
        orphaned,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'}/dashboard/payments`,
      })
      for (const a of admins || []) {
        if (a.email) await sendEmail({ to: a.email as string, ...tpl })
      }
    } catch (err) {
      console.error('admin cancellation notify failed (non-fatal):', err)
    }

    return NextResponse.json({
      success: true,
      endDate,
      orphaned,
      message: `Your subscription will remain active until ${endDate}`,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}

function labelForReason(code: string | null | undefined): string {
  switch (code) {
    case 'too_expensive': return 'Too expensive'
    case 'not_using': return 'Not using it enough'
    case 'switching': return 'Switching to another academy'
    case 'child_stopped': return 'Child has stopped playing'
    case 'unhappy': return 'Not happy with the service'
    case 'other': return 'Other'
    default: return 'No reason provided'
  }
}
