import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

/**
 * Coupon id derived from (percent, months). Stable + reusable across academies
 * with identical config. When an academy changes their retention config, the
 * NEW coupon (with the new derived id) is created on demand — the old one is
 * left alone so it stays valid for parents who accepted it under the old
 * config. Replaces the previous "cache one id per org" model which went stale
 * the moment the academy adjusted their offer.
 *
 * Mapping for the `duration` field:
 *   months === 1    → 'once'         (next month only — Phase 5 brief: "apply to next month only")
 *   months === null → 'forever'
 *   otherwise       → 'repeating' for N months
 */
function couponIdFor(percent: number, months: number | null): string {
  const dur = months === null
    ? 'forever'
    : months === 1
      ? 'once'
      : `${months}mo`
  return `pp-retention-${Math.round(percent)}pct-${dur}`
}

async function getOrCreateCoupon(percent: number, months: number | null, orgId: string): Promise<string> {
  const id = couponIdFor(percent, months)
  try {
    const existing = await stripe.coupons.retrieve(id)
    if (existing && !existing.deleted) return existing.id
  } catch (e) {
    if (e instanceof Stripe.errors.StripeError && e.code !== 'resource_missing') throw e
    // resource_missing → fall through and create
  }
  const durationParams: Partial<Stripe.CouponCreateParams> =
    months === null
      ? { duration: 'forever' }
      : months === 1
        ? { duration: 'once' }
        : { duration: 'repeating', duration_in_months: months }
  const coupon = await stripe.coupons.create({
    id,
    name: id,
    percent_off: percent,
    metadata: { organisation_id: orgId, type: 'retention' },
    ...durationParams,
  })
  return coupon.id
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subscriptionId } = await request.json()
    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 })
    }

    // ─── Stripe lookup with mode-mismatch safe-fail (Phase 5 finding) ───
    let subscription: Stripe.Subscription
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId)
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr)
      if (/no such subscription/i.test(msg)) {
        return NextResponse.json({
          error: 'Your subscription has fallen out of sync with our payment system. Please contact your academy.',
        }, { status: 409 })
      }
      throw stripeErr
    }
    const currentItem = subscription.items.data[0]
    if (!currentItem) {
      return NextResponse.json({ error: 'No subscription items found' }, { status: 400 })
    }

    // Find the org behind this subscription to load its retention settings
    const { data: orgId } = await supabase.rpc('get_my_org')
    const { data: org } = await supabase
      .from('organisations')
      .select('id, name, retention_offer_enabled, retention_offer_percent, retention_offer_months')
      .eq('id', orgId)
      .single()

    if (!org?.retention_offer_enabled) {
      return NextResponse.json({ error: 'Retention offer is not enabled for this academy.' }, { status: 400 })
    }

    const percent = Math.max(1, Math.min(90, Number(org.retention_offer_percent ?? 50)))
    const months = org.retention_offer_months != null
      ? Math.max(1, Math.min(12, Number(org.retention_offer_months)))
      : null

    // Reject if a discount is already applied (avoid stacking)
    if (subscription.discount) {
      return NextResponse.json({ error: 'A discount is already applied to this subscription' }, { status: 400 })
    }

    const couponId = await getOrCreateCoupon(percent, months, org.id as string)

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
    const durationText = months === null
      ? 'forever'
      : months === 1
        ? 'one month'
        : `for ${months} months`
    await supabase.from('notifications').insert({
      user_id: user.id,
      organisation_id: orgId,
      type: 'subscription',
      title: `${percent}% discount applied!`,
      body: `Your subscription continues with ${percent}% off ${durationText}. Thanks for staying!`,
      link: '/dashboard/payments',
    })

    // ─── ADMIN notification — new — "a family stayed" with discount details ───
    try {
      const { sendEmail } = await import('@/lib/email')
      const { retentionAcceptedAdminNotifyEmail } = await import('@/lib/email-templates')
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single()
      const { data: admins } = await supabase
        .from('profiles')
        .select('email')
        .eq('organisation_id', orgId)
        .eq('role', 'admin')
      const tpl = retentionAcceptedAdminNotifyEmail({
        academyName: (org as { name?: string }).name || 'Your academy',
        parentName: profile?.full_name || 'A parent',
        parentEmail: profile?.email || null,
        discountPercent: Math.round(percent),
        durationLabel: durationText,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'}/dashboard/payments`,
      })
      for (const a of admins || []) {
        if (a.email) await sendEmail({ to: a.email as string, ...tpl })
      }
    } catch (err) {
      console.error('admin retention notify failed (non-fatal):', err)
    }

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
