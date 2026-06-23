/**
 * Refunds Phase 1A — admin POST endpoint for camp booking refunds.
 *
 * Scope (enforced server-side):
 *   • Admin role on the payment's organisation only
 *   • payments.status='paid' (no double-refund, no refunding unpaid)
 *   • stripe_session_id IS NOT NULL (no manual entries — they have no
 *     charge to refund)
 *   • description starts with 'Camp:' (Phase 1A is camps only)
 *
 * Connect routing — verified empirically before this file was written:
 *   Every charge in production lives on the PLATFORM Stripe account via
 *   destination-charge routing (on_behalf_of + transfer_data.destination).
 *   The refund therefore goes via the platform Stripe instance with NO
 *   stripeAccount header, plus:
 *     • reverse_transfer:        true   (claws back the academy's payout)
 *     • refund_application_fee:  true   (claws back the platform fee)
 *
 * Side effects on success:
 *   • payments → status='refunded', amount_refunded, refunded_at,
 *                stripe_refund_id, refund_reason, refunded_by,
 *                stripe_charge_id (cached for future ops)
 *   • camp_bookings → payment_status='refunded' (frees the seat via the
 *     existing capacity query at camp-checkout/route.ts which filters
 *     status IN ('pending','paid'))
 *   • audit_log → action='payment.refunded' (best-effort, non-blocking)
 *
 * Failure semantics:
 *   • Stripe failure → 502 with message, NO DB write
 *   • Stripe success + DB update failure → return ok:true with
 *     warning:'sync_pending'; the charge.refunded webhook will reconcile.
 *     We never tell admin "refund failed" when Stripe says it succeeded.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { getChargeIdFromSession } from '@/lib/stripe-refund-resolver'

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paymentId } = await params

  const body = (await req.json().catch(() => null)) as { reason?: unknown } | null
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

  // ─── Auth gate ───
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  // ─── Fetch payment via service-role (bypasses RLS for trusted server check) ───
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: payment } = await service
    .from('payments')
    .select(
      'id, organisation_id, status, amount, amount_paid, amount_refunded, stripe_session_id, stripe_charge_id, description'
    )
    .eq('id', paymentId)
    .maybeSingle()

  // Use 404 for both "not found" AND "wrong org" — avoid leaking existence.
  if (!payment || payment.organisation_id !== myOrgId) {
    return NextResponse.json({ ok: false, error: 'Payment not found' }, { status: 404 })
  }

  // ─── Phase 1A scope checks ───
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
          'This payment was not collected through Stripe and cannot be refunded automatically. Refund manually if needed.',
      },
      { status: 422 }
    )
  }
  const description = (payment.description as string | null) || ''
  if (!description.startsWith('Camp:')) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Phase 1 refunds only support camp bookings. Subscription refunds are coming soon.',
      },
      { status: 422 }
    )
  }

  // ─── Resolve charge id (use cached value if available, else fetch + cache) ───
  let chargeId = (payment.stripe_charge_id as string | null) || null
  if (!chargeId) {
    chargeId = await getChargeIdFromSession(payment.stripe_session_id as string)
    if (!chargeId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not resolve the underlying Stripe charge. Try refunding via Stripe Dashboard — the webhook will sync the local state back.",
        },
        { status: 502 }
      )
    }
    // Cache it on the row so future ops skip the extra API call.
    await service.from('payments').update({ stripe_charge_id: chargeId }).eq('id', paymentId)
  }

  // ─── Issue the Stripe refund (platform instance, destination-charge model) ───
  // No stripeAccount header — the charge lives on the platform per the
  // pre-flight verification.
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
    console.error('[refund] Stripe API failure', { paymentId, chargeId, message })
    return NextResponse.json(
      { ok: false, error: `Refund failed at Stripe: ${message}` },
      { status: 502 }
    )
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
    // Stripe SUCCEEDED but our DB UPDATE failed. Critical to surface this
    // honestly: the money is refunded; the charge.refunded webhook will
    // sync the row when it fires. Return ok:true so the UI doesn't show
    // "refund failed" when the customer is genuinely about to be refunded.
    console.error('[refund:db_post_stripe_failed]', {
      paymentId,
      refundId,
      error: payUpdErr.message,
    })
    return NextResponse.json({
      ok: true,
      warning: 'sync_pending',
      stripe_refund_id: refundId,
      message:
        'Refund issued in Stripe; local sync pending — the webhook will reconcile.',
    })
  }

  // ─── Update camp_bookings (frees the seat via the existing capacity query) ───
  // Best-effort: the payment row is the source of truth for the refund.
  // The camp_bookings update is for capacity + roster display.
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

  // ─── Audit log (best-effort, non-blocking) ───
  try {
    await service.from('audit_log').insert({
      organisation_id: myOrgId,
      user_id: user.id,
      action: 'payment.refunded',
      entity_type: 'payment',
      entity_id: paymentId,
      details: {
        amount: refundedAmount,
        stripe_refund_amount: refundAmount,
        reason,
        stripe_refund_id: refundId,
        stripe_charge_id: chargeId,
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
  })
}
