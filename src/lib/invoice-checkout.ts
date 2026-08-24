import { stripe } from '@/lib/stripe'
import { isConnectChargeReady, CONNECT_NOT_READY_MESSAGE } from '@/lib/connect-readiness'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────
// One-off invoice checkout — shared Connect routing.
//
// An ad-hoc `payments` row (raised by an admin via "+ Add Payment", or
// auto-created alongside an assigned subscription) is money owed to the
// ACADEMY, not the platform. Every other parent-paying route in this codebase
// routes such a charge through Connect; the two invoice-paying surfaces did
// not, which is the same defect that took the payment-link generator offline
// on 2026-07-17 (see src/app/api/stripe/payment-link/route.ts).
//
// This module is the single source of truth for that routing so both surfaces
// (the logged-in dashboard "Pay now" and the emailed /pay/[id] link) build an
// identical, correctly-routed Checkout Session.
//
// The resulting session carries `metadata.payment_id`, which the EXISTING
// webhook branch in /api/stripe/webhooks already consumes to mark the row
// paid idempotently. No webhook change is required or made.
// ─────────────────────────────────────────────────────────────────────────

/** Default platform take when an org has no explicit platform plan. */
const DEFAULT_PLATFORM_FEE_RATE = 0.035

export interface InvoiceCheckoutResult {
  ok: boolean
  url?: string
  error?: string
  status?: number
}

/**
 * Resolve the academy's Connect payout details and the platform fee rate.
 * Fails CLOSED — any missing/unready account returns a blocking error rather
 * than silently falling back to a platform-account charge.
 */
async function resolvePayout(
  db: SupabaseClient,
  organisationId: string | null | undefined
): Promise<{ accountId: string; feeRate: number } | { error: string; status: number }> {
  if (!organisationId) {
    return { error: 'This invoice is not linked to an academy.', status: 400 }
  }

  const { data: org } = await db
    .from('organisations')
    .select('stripe_account_id, platform_plan_id')
    .eq('id', organisationId)
    .single()

  if (!org?.stripe_account_id) {
    return {
      error: 'This academy is still finishing their payment setup. Payment isn’t available yet.',
      status: 503,
    }
  }

  // CONNECT READINESS PRE-FLIGHT — a connected account that can't take charges
  // yet would fail mid-checkout and strand the parent. Block before creating
  // any Stripe object. Mirrors camp-checkout / confirm-checkout exactly.
  if (!(await isConnectChargeReady(org.stripe_account_id))) {
    return { error: CONNECT_NOT_READY_MESSAGE, status: 503 }
  }

  let feeRate = DEFAULT_PLATFORM_FEE_RATE
  if (org.platform_plan_id) {
    const { data: platformPlan } = await db
      .from('platform_plans')
      .select('transaction_fee_percent')
      .eq('id', org.platform_plan_id)
      .single()
    if (platformPlan) {
      feeRate = Number(platformPlan.transaction_fee_percent) / 100
    }
  }

  return { accountId: org.stripe_account_id, feeRate }
}

export interface PaymentRowLite {
  id: string
  amount: number | string
  amount_paid: number | string | null
  status: string
  description: string | null
  organisation_id: string | null
}

/**
 * Build a Connect-routed Stripe Checkout Session for the outstanding balance
 * on a single `payments` row.
 *
 * Caller is responsible for authorisation — this function performs no access
 * control of its own.
 */
export async function createInvoiceCheckoutSession(opts: {
  db: SupabaseClient
  payment: PaymentRowLite
  parentEmail: string | null
  /** Existing Stripe customer to attach, when the parent already has one. */
  customerId?: string | null
  successUrl: string
  cancelUrl: string
  /** Extra metadata merged into the session (payment_id is always set). */
  metadata?: Record<string, string>
}): Promise<InvoiceCheckoutResult> {
  const { db, payment, parentEmail, customerId, successUrl, cancelUrl, metadata } = opts

  if (payment.status === 'paid' || payment.status === 'refunded' || payment.status === 'waived') {
    // 'waived' = written off by the academy — nothing is owed, so it must be
    // just as unpayable as paid/refunded, or a stale emailed link could
    // charge a family for a debt that was cancelled.
    return { ok: false, error: 'This invoice has already been settled.', status: 400 }
  }

  const amountDue = Number(payment.amount)
  const amountPaid = Number(payment.amount_paid || 0)
  const remaining = Math.round((amountDue - amountPaid) * 100) / 100

  if (!(remaining > 0)) {
    return { ok: false, error: 'There is nothing left to pay on this invoice.', status: 400 }
  }

  const payout = await resolvePayout(db, payment.organisation_id)
  if ('error' in payout) {
    return { ok: false, error: payout.error, status: payout.status }
  }

  const amountPence = Math.round(remaining * 100)
  const feeAmount = payout.feeRate > 0 ? Math.round(amountPence * payout.feeRate) : 0

  const session = await stripe.checkout.sessions.create({
    ...(customerId ? { customer: customerId } : {}),
    ...(!customerId && parentEmail ? { customer_email: parentEmail } : {}),
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          product_data: { name: payment.description || 'Payment' },
          unit_amount: amountPence,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    payment_intent_data: {
      // Brand the Checkout with the academy's Stripe account and route the
      // funds to them, taking only the platform fee. Identical shape to
      // camp-checkout.
      on_behalf_of: payout.accountId,
      ...(feeAmount > 0 ? { application_fee_amount: feeAmount } : {}),
      transfer_data: { destination: payout.accountId },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ...(metadata || {}),
      // Consumed by the existing webhook branch to mark the row paid.
      payment_id: payment.id,
    },
  })

  // Store the session id for webhook reconciliation / dedup.
  await db.from('payments').update({ stripe_session_id: session.id }).eq('id', payment.id)

  return { ok: true, url: session.url || undefined }
}
