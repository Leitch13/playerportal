/**
 * Admin refund endpoint.
 *
 * Phase 1A: camp refunds (single charge, no subscription side effects)
 * Phase 1B: subscription refunds (first / renewal / quarterly / migration)
 *           + optional cancel-subscription side effect (immediate)
 *
 * The scope is widened from Phase 1A's `description.startsWith('Camp:')`
 * to include any payment with a resolvable Stripe charge:
 *   • camp bookings              (cs_*, mode='payment')
 *   • subscription first payments (cs_*, mode='subscription')
 *   • subscription renewals       (in_*)
 *   • tonight_then_sub bridges    (cs_*, mode='payment') — refund-only
 *
 * SAFETY GATES (all server-derived, never trust the client):
 *   - Auth: admin role on the payment's organisation only
 *   - State: payment.status='paid', not already 'refunded'
 *   - Stripe ID: payment.stripe_session_id must exist (no manual entries)
 *   - Charge: resolveChargeAndSubscription must return a non-null charge_id
 *   - Subscription cancel: ONLY runs if (a) caller asked for it AND
 *     (b) resolver returned a non-null subscription_id. If the caller
 *     asked for cancel but we couldn't resolve a sub_id, we BLOCK the
 *     whole operation — refusing the half-state where we'd refund but
 *     fail to cancel and leave them subscribed.
 *
 * CONNECT ROUTING (verified empirically for ALL types in production):
 *   Every charge in this system uses destination-charge routing
 *   (on_behalf_of + transfer_data.destination on the platform). Refund
 *   issued via platform Stripe client with NO stripeAccount, plus
 *   reverse_transfer + refund_application_fee.
 *
 * Subscription cancel:
 *   stripe.subscriptions.cancel(sub_id) — immediate. The existing
 *   `customer.subscription.deleted` webhook handler does the local DB
 *   sync + enrolment teardown (unchanged from before Phase 1B).
 *
 * SIDE EFFECTS ON SUCCESS:
 *   - payments  → status='refunded', amount_refunded, refunded_at,
 *                 stripe_refund_id, refund_reason, refunded_by,
 *                 stripe_charge_id (cached)
 *   - camp_bookings → payment_status='refunded' IF this payment links
 *     (matched via stripe_session_id) to a camp_bookings row
 *   - subscription cancel side effects are driven by the webhook, not
 *     written here
 *   - audit_log → action='payment.refunded', details include cancel
 *     decision + sub_id + refund_id
 *
 * FAILURE SEMANTICS:
 *   - Stripe refund failure  → 502, NO DB write
 *   - Stripe refund success, sub cancel failure → return ok:true with
 *     warning:'sub_cancel_failed'. Refund landed; admin can cancel via
 *     existing CancelFlow.
 *   - Stripe refund success, DB update failure → return ok:true with
 *     warning:'sync_pending'. The charge.refunded webhook reconciles.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { resolveChargeAndSubscription } from '@/lib/stripe-refund-resolver'

const ALLOWED_REASONS = [
  'customer_request',
  'duplicate_booking',
  'event_cancelled',
  'booking_error',
  'other',
] as const

type RefundReason = (typeof ALLOWED_REASONS)[number]

function isRefundReason(v: unknown): v is RefundReason {
  return typeof v === 'string' && (ALLOWED_REASONS as readonly string[]).includes(v)
}

function classifyPayment(description: string | null | undefined): 'camp' | 'subscription' | 'bridge' | 'unknown' {
  const d = (description || '').trim()
  if (d.startsWith('Camp:')) return 'camp'
  if (d.startsWith('First session ')) return 'bridge'
  // matches "Plan Name — subscription" (first payment) AND
  // "Subscription payment" (some renewals)
  if (d.includes('— subscription') || d.startsWith('Subscription payment')) return 'subscription'
  return 'unknown'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paymentId } = await params

  const body = (await req.json().catch(() => null)) as {
    reason?: unknown
    cancel_subscription?: unknown
  } | null

  const reason = body?.reason
  if (!isRefundReason(reason)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Invalid reason. Must be one of: customer_request, duplicate_booking, event_cancelled, booking_error, other',
      },
      { status: 400 }
    )
  }

  // Client may send true/false/undefined. Default to TRUE per the
  // approved Phase 1B design (refund + cancel as default behaviour).
  const cancelRequested =
    body?.cancel_subscription === undefined
      ? true
      : body.cancel_subscription === true

  // ─── Auth gate ───
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: me } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }
  const myOrgId = me.organisation_id as string

  // ─── Fetch payment via service role ───
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: payment } = await service
    .from('payments')
    .select(
      'id, organisation_id, status, amount, amount_paid, amount_refunded, stripe_session_id, stripe_charge_id, description, created_at'
    )
    .eq('id', paymentId)
    .maybeSingle()

  if (!payment || payment.organisation_id !== myOrgId) {
    // 404 for both cases — avoid existence leak
    return NextResponse.json({ ok: false, error: 'Payment not found' }, { status: 404 })
  }

  // ─── State gates ───
  if (payment.status === 'refunded') {
    return NextResponse.json(
      { ok: false, error: 'This payment has already been refunded.' },
      { status: 409 }
    )
  }
  if (payment.status !== 'paid') {
    return NextResponse.json(
      {
        ok: false,
        error: `Cannot refund — payment status is "${payment.status}". Only paid payments are refundable.`,
      },
      { status: 409 }
    )
  }
  if (!payment.stripe_session_id) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'This payment was not collected through Stripe and cannot be refunded automatically.',
      },
      { status: 422 }
    )
  }

  const kind = classifyPayment(payment.description as string | null)
  if (kind === 'unknown') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Payment type could not be classified. Please refund via Stripe Dashboard — the webhook will sync.',
      },
      { status: 422 }
    )
  }

  // ─── Resolve charge id + (when applicable) subscription id ───
  const resolved = await resolveChargeAndSubscription(payment.stripe_session_id as string)
  if (!resolved.charge_id) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not resolve the underlying Stripe charge. Try refunding via Stripe Dashboard — the webhook will sync the local state back.",
      },
      { status: 502 }
    )
  }
  const chargeId = resolved.charge_id
  const subscriptionId = resolved.subscription_id  // may be null for bridge / camp

  // ─── Cancel-subscription safety: block if user asked but we can't fulfil ───
  // Only enforce for kinds where a subscription is expected. Camp + bridge
  // intentionally have no subscription_id; we silently downgrade those to
  // refund-only regardless of cancelRequested (the UI doesn't even show the
  // checkbox for those kinds, but the server defends in depth).
  const shouldAttemptCancel =
    cancelRequested && kind === 'subscription' && subscriptionId !== null
  if (cancelRequested && kind === 'subscription' && !subscriptionId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Could not resolve the linked subscription on Stripe. Refusing to refund without cancel (avoids leaving the parent subscribed). Refund + cancel via Stripe Dashboard instead.',
      },
      { status: 502 }
    )
  }

  // ─── Issue the Stripe refund ───
  let refundId: string
  let refundAmount: number
  try {
    const refund = await stripe.refunds.create({
      charge: chargeId,
      reverse_transfer: true,
      refund_application_fee: true,
      reason: 'requested_by_customer',
    })
    refundId = refund.id
    refundAmount = refund.amount
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe error'
    console.error('[refund] Stripe API failure', { paymentId, chargeId, kind, message })
    return NextResponse.json(
      { ok: false, error: `Refund failed at Stripe: ${message}` },
      { status: 502 }
    )
  }

  // ─── Cancel the subscription (best-effort — refund already landed) ───
  let cancelWarning: string | null = null
  if (shouldAttemptCancel && subscriptionId) {
    try {
      await stripe.subscriptions.cancel(subscriptionId)
      // The customer.subscription.deleted webhook will sync our subscriptions
      // table + enrolments. We do NOT write to those tables here.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stripe error'
      console.error('[refund:sub_cancel_failed]', { paymentId, subscriptionId, message })
      cancelWarning = `Refund succeeded but cancellation failed: ${message}. Cancel manually via the parent's hub.`
    }
  }

  // ─── Update payments row ───
  const refundedAmount = Number(payment.amount_paid ?? payment.amount ?? 0)
  const now = new Date().toISOString()
  const { error: payUpdErr } = await service
    .from('payments')
    .update({
      status: 'refunded',
      amount_refunded: refundedAmount,
      refunded_at: now,
      stripe_refund_id: refundId,
      refund_reason: reason,
      refunded_by: user.id,
      stripe_charge_id: chargeId,
      updated_at: now,
    })
    .eq('id', paymentId)

  if (payUpdErr) {
    console.error('[refund:db_post_stripe_failed]', {
      paymentId,
      refundId,
      error: payUpdErr.message,
    })
    return NextResponse.json({
      ok: true,
      warning: 'sync_pending',
      stripe_refund_id: refundId,
      cancel_warning: cancelWarning,
      message:
        'Refund issued in Stripe; local sync pending — the webhook will reconcile.',
    })
  }

  // ─── Update camp_bookings if linked (camp refunds only — frees the seat) ───
  if (kind === 'camp') {
    try {
      await service
        .from('camp_bookings')
        .update({ payment_status: 'refunded' })
        .eq('stripe_session_id', payment.stripe_session_id)
    } catch (err) {
      console.error('[refund:camp_booking_update_failed]', {
        paymentId,
        stripe_session_id: payment.stripe_session_id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // ─── Audit log (best-effort) ───
  try {
    await service.from('audit_log').insert({
      organisation_id: myOrgId,
      user_id: user.id,
      action: 'payment.refunded',
      entity_type: 'payment',
      entity_id: paymentId,
      details: {
        kind,
        amount: refundedAmount,
        stripe_refund_amount: refundAmount,
        reason,
        stripe_refund_id: refundId,
        stripe_charge_id: chargeId,
        stripe_subscription_id: subscriptionId,
        cancelled_subscription: shouldAttemptCancel && !cancelWarning,
      },
    })
  } catch {
    // Swallow audit failures — primary state change already succeeded.
  }

  return NextResponse.json({
    ok: true,
    stripe_refund_id: refundId,
    amount_refunded: refundedAmount,
    status: 'refunded',
    kind,
    cancelled_subscription: shouldAttemptCancel && !cancelWarning,
    ...(cancelWarning ? { cancel_warning: cancelWarning } : {}),
  })
}
