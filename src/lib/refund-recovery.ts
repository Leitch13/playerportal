/**
 * Refunds when an academy's Stripe balance is empty (migration 121).
 *
 * Every academy's Stripe balance is paid out to their bank as soon as it is
 * available, so a refund that pulls the money back from the academy
 * (reverse_transfer) fails with insufficient funds. When that happens:
 *
 *   1. Player Portal refunds the parent from its own balance
 *      (refundCoveredByPlatform). A card refund never fails for lack of
 *      platform balance: Stripe holds it until the balance covers it.
 *   2. What the academy received for that payment is recorded as owed
 *      (refund_recoveries).
 *   3. It is taken back from the academy's next membership invoices: while
 *      a renewal invoice is still a draft, Player Portal raises its own fee
 *      on it by up to the amount owed (takeRepaymentFromDraftInvoice). The
 *      parent pays exactly the same; the academy receives less.
 *   4. When that invoice is paid the deduction counts as collected
 *      (settleRepayments). Anything unpaid after 30 days is flagged.
 *
 * The same for every academy. If Stripe refuses a fee change the invoice is
 * charged as normal and nothing is recorded.
 */

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

/** A reserved deduction on an invoice that was never paid stops counting after this. */
const RESERVED_STALE_DAYS = 35

/** The refund tried to take the money back from the academy and their Stripe balance was empty. */
export function isEmptyBalanceError(err: unknown): boolean {
  const e = err as { code?: string; raw?: { code?: string }; message?: string } | null
  const code = e?.code || e?.raw?.code
  return code === 'balance_insufficient' || code === 'insufficient_funds' || /insufficient (funds|balance)/i.test(e?.message || '')
}

/**
 * Refund the whole charge from Player Portal's balance, without reversing the
 * academy's transfer. Player Portal keeps its fee on this charge, so what the
 * academy owes back is exactly what was transferred to them: once repaid,
 * everyone is where a normal refund would have left them.
 */
export async function refundCoveredByPlatform(chargeId: string, reason: Stripe.RefundCreateParams.Reason = 'requested_by_customer'): Promise<{ refund: Stripe.Refund; owedPence: number }> {
  const charge = await stripe.charges.retrieve(chargeId, { expand: ['transfer'] })
  const transfer = charge.transfer && typeof charge.transfer === 'object' ? (charge.transfer as Stripe.Transfer) : null
  const owedPence = transfer ? Math.max(0, transfer.amount - (transfer.amount_reversed || 0)) : 0
  const refund = await stripe.refunds.create({
    charge: chargeId,
    reverse_transfer: false,
    refund_application_fee: false,
    reason,
    metadata: { pp_covered_by_platform: 'true', pp_owed_pence: String(owedPence) },
  })
  return { refund, owedPence }
}

export interface OpenRecovery { id: string; amountPence: number; remainingPence: number; createdAt: string; description: string | null }

/** What each open recovery still needs, oldest first. Reserved-but-stale deductions no longer count. */
export async function openRecoveries(admin: SupabaseClient, orgId: string): Promise<OpenRecovery[]> {
  const { data: recs } = await admin.from('refund_recoveries').select('id, amount_pence, created_at, description')
    .eq('organisation_id', orgId).eq('status', 'open').order('created_at')
  if (!recs?.length) return []
  const { data: deds } = await admin.from('refund_recovery_deductions').select('recovery_id, amount_pence, status, created_at')
    .in('recovery_id', recs.map((r) => r.id)).in('status', ['reserved', 'collected'])
  const staleBefore = Date.now() - RESERVED_STALE_DAYS * 86400_000
  return recs.map((r) => {
    const used = (deds ?? []).filter((d) => d.recovery_id === r.id && (d.status === 'collected' || new Date(d.created_at).getTime() > staleBefore))
      .reduce((a, d) => a + d.amount_pence, 0)
    return { id: r.id, amountPence: r.amount_pence, remainingPence: Math.max(0, r.amount_pence - used), createdAt: r.created_at, description: r.description }
  }).filter((r) => r.remainingPence > 0)
}

/** Split an amount across recoveries, oldest first. Pure: see refund-recovery.test.ts. */
export function allocate(open: { id: string; remainingPence: number }[], takePence: number): { recoveryId: string; amountPence: number }[] {
  const out: { recoveryId: string; amountPence: number }[] = []
  let left = takePence
  for (const r of open) {
    if (left <= 0) break
    const n = Math.min(left, r.remainingPence)
    if (n > 0) { out.push({ recoveryId: r.id, amountPence: n }); left -= n }
  }
  return out
}

function invoiceSubscription(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription
  if (legacy) return typeof legacy === 'string' ? legacy : legacy.id
  // Newer API versions moved it under parent.subscription_details.
  const sub = (invoice as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } }).parent?.subscription_details?.subscription
  return sub ? (typeof sub === 'string' ? sub : sub.id) : null
}

function invoiceDestination(invoice: Stripe.Invoice): string | null {
  const d = invoice.transfer_data?.destination
  return d ? (typeof d === 'string' ? d : d.id) : null
}

/** Player Portal's normal fee on this invoice: the one already on it, or the subscription's percent. */
async function normalFee(invoice: Stripe.Invoice): Promise<number> {
  if (typeof invoice.application_fee_amount === 'number') return invoice.application_fee_amount
  const subId = invoiceSubscription(invoice)
  if (!subId) return 0
  const sub = await stripe.subscriptions.retrieve(subId)
  const pct = sub.application_fee_percent ?? 0
  return Math.round(((invoice.total ?? invoice.amount_due ?? 0) * pct) / 100)
}

/**
 * Webhook `invoice.created`: a membership renewal is still a draft. If its academy
 * owes Player Portal for a covered refund, raise Player Portal's fee on this invoice
 * by up to what is owed. Reserved in the database first (one row per invoice, so a
 * repeated event does nothing), then the draft is changed; if Stripe refuses, the
 * reservation is removed and the invoice is charged exactly as normal.
 */
export async function takeRepaymentFromDraftInvoice(admin: SupabaseClient, invoice: Stripe.Invoice): Promise<{ orgId: string; takenPence: number } | null> {
  if (invoice.status !== 'draft' || invoice.billing_reason !== 'subscription_cycle') return null
  const dest = invoiceDestination(invoice)
  const due = invoice.amount_due ?? 0
  if (!dest || due <= 0) return null
  const { data: org } = await admin.from('organisations').select('id').eq('stripe_account_id', dest).maybeSingle()
  if (!org) return null
  const { data: already } = await admin.from('refund_recovery_deductions').select('id').eq('stripe_invoice_id', invoice.id).limit(1)
  if (already?.length) return null
  const open = await openRecoveries(admin, org.id)
  const owed = open.reduce((a, r) => a + r.remainingPence, 0)
  if (owed <= 0) return null

  const fee = await normalFee(invoice)
  const take = Math.min(owed, due - fee)
  if (take <= 0) return null
  const rows = allocate(open, take).map((a) => ({ recovery_id: a.recoveryId, organisation_id: org.id, stripe_invoice_id: invoice.id, amount_pence: a.amountPence }))
  const { error } = await admin.from('refund_recovery_deductions').insert(rows)
  if (error) return null // a concurrent delivery already reserved this invoice
  try {
    await stripe.invoices.update(invoice.id, { application_fee_amount: fee + take })
  } catch (e) {
    await admin.from('refund_recovery_deductions').delete().eq('stripe_invoice_id', invoice.id).eq('status', 'reserved')
    console.error('[refund-recovery] could not change draft invoice fee', { invoice: invoice.id, error: e instanceof Error ? e.message : String(e) })
    return null
  }
  return { orgId: org.id, takenPence: take }
}

/** Webhook `invoice.payment_succeeded`: deductions on this invoice are now real money back. */
export async function settleRepayments(admin: SupabaseClient, invoiceId: string): Promise<void> {
  const now = new Date().toISOString()
  const { data: rows } = await admin.from('refund_recovery_deductions').update({ status: 'collected', settled_at: now })
    .eq('stripe_invoice_id', invoiceId).eq('status', 'reserved').select('recovery_id')
  for (const id of [...new Set((rows ?? []).map((r) => r.recovery_id as string))]) {
    const { data: rec } = await admin.from('refund_recoveries').select('amount_pence').eq('id', id).single()
    const { data: got } = await admin.from('refund_recovery_deductions').select('amount_pence').eq('recovery_id', id).eq('status', 'collected')
    const collected = (got ?? []).reduce((a, d) => a + d.amount_pence, 0)
    if (rec && collected >= rec.amount_pence) {
      await admin.from('refund_recoveries').update({ status: 'repaid', repaid_at: now }).eq('id', id).eq('status', 'open')
    }
  }
}

/** For the academy's Payments page: what is still owed, and what has been taken back. */
export async function recoverySummary(admin: SupabaseClient, orgId: string): Promise<{ owedPence: number; repaidPence: number; open: OpenRecovery[] }> {
  const open = await openRecoveries(admin, orgId)
  const { data: got } = await admin.from('refund_recovery_deductions').select('amount_pence').eq('organisation_id', orgId).eq('status', 'collected')
  return { owedPence: open.reduce((a, r) => a + r.remainingPence, 0), repaidPence: (got ?? []).reduce((a, d) => a + d.amount_pence, 0), open }
}
