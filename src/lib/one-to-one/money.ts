/**
 * 1-2-1 Slots · regulars' money (phase 4). Server only.
 *
 * Every movement of money in this file is a ONE-OFF:
 *   • set-up:   one Checkout in payment mode for the rest of this month, card saved
 *   • monthly:  one off-session PaymentIntent on the 1st for the sessions in the month
 *   • pay-now:  one Checkout in payment mode when the card failed
 *   • refund:   one refund, admin only, transfer reversed, fee returned
 * There is no Stripe subscription here. The guard refuses one.
 *
 * Credits are rows in coaching_credits. The balance is their sum.
 */

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { ONE_TO_ONE_MODULE, platformFeeRate, CheckoutBlocked } from './checkout'
import { chargeBreakdown, declineEffect, nextAttemptOn, type ChargeableSession } from './ledger'
import { declineOutcome } from './policy'
import { getCoaches, getSettings, getVenues, hhmm, fmtDate, DAY } from './db'
import { monthEnd, monthStart, todayLondon } from './time'
import { sendSetupLink, sendMonthNotice, sendMonthReceipt, sendPaymentFailed, sendDeclined, sendAcademyCancelled } from './emails'

// ─── helpers ────────────────────────────────────────────────────────────

export async function creditBalance(admin: SupabaseClient, orgId: string, parentId: string): Promise<number> {
  const { data } = await admin.from('coaching_credits').select('amount_pence').eq('organisation_id', orgId).eq('parent_id', parentId)
  return (data ?? []).reduce((a, r) => a + (r.amount_pence as number), 0)
}

async function orgBits(admin: SupabaseClient, orgId: string) {
  const [org, coaches, venues, settings] = await Promise.all([
    admin.from('organisations').select('name, slug').eq('id', orgId).single(), getCoaches(admin, orgId), getVenues(admin, orgId), getSettings(admin, orgId),
  ])
  return {
    name: (org.data?.name as string) || 'Your academy', slug: (org.data?.slug as string) || '',
    coach: (id: string) => coaches.find((c) => c.id === id)?.full_name?.split(' ')[0] || 'your coach',
    venue: (id: string) => venues.find((v) => v.id === id)?.name || 'the venue',
    settings,
  }
}

async function parentBits(admin: SupabaseClient, parentId: string) {
  const { data } = await admin.from('profiles').select('email, full_name').eq('id', parentId).single()
  return { email: (data?.email as string | null) || null, name: (data?.full_name as string | null) || null }
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'

// ─── 1. set-up: the parent claims the slot ───────────────────────────────

/**
 * Creates (or refreshes) the first-month charge row for a slot and a one-off
 * Checkout for it, then emails the parent the link. If nothing is left in the
 * starting month, the Checkout is in setup mode (card only, £0).
 */
export async function sendSetupCheckout(admin: SupabaseClient, orgId: string, slotId: string): Promise<{ url: string; amountPence: number }> {
  const { data: slot } = await admin.from('regular_slots').select('*, player:players(first_name, last_name)').eq('id', slotId).eq('organisation_id', orgId).single()
  if (!slot) throw new CheckoutBlocked('Slot not found', 404)
  const parent = await parentBits(admin, slot.parent_id)
  if (!parent.email) throw new CheckoutBlocked('This parent has no email on their account', 400)
  const bits = await orgBits(admin, orgId)
  const { rate, stripeAccountId } = await platformFeeRate(admin, orgId)

  const from = slot.starts_on as string, to = monthEnd(from), month = monthStart(from)
  const { data: rows } = await admin.from('coaching_sessions').select('id, price_pence, status, decline_tier, session_date')
    .eq('regular_slot_id', slot.id).gte('session_date', from).lte('session_date', to)
  const sessions: ChargeableSession[] = (rows ?? []).map((r) => ({ id: r.id, pricePence: r.price_pence, status: r.status, declineTier: r.decline_tier }))
  const credit = await creditBalance(admin, orgId, slot.parent_id)
  const b = chargeBreakdown(sessions, credit)

  // One charge row per parent per month. Set-up lives on that row.
  const { data: charge, error } = await admin.from('coaching_charges').upsert({
    organisation_id: orgId, parent_id: slot.parent_id, billing_month: month,
    sessions_pence: b.sessionsPence, credit_applied_pence: Math.max(0, b.creditAppliedPence), amount_pence: b.amountPence,
    status: 'pending', breakdown: b.sessionIds.map((id) => ({ session_id: id })),
  }, { onConflict: 'parent_id,billing_month' }).select('id, status').single()
  if (error) throw new Error(error.message)
  if (charge.status === 'paid_online' || charge.status === 'paid_cash') throw new CheckoutBlocked('This month is already paid', 409)

  const child = slot.player ? `${slot.player.first_name}` : 'Your child'
  const label = `${child} · ${DAY[slot.weekday]}s ${hhmm(slot.start_minutes)} with ${bits.coach(slot.coach_id)}`
  const metadata = { pp_module: ONE_TO_ONE_MODULE, kind: 'setup', regular_slot_id: slot.id, charge_id: charge.id, organisation_id: orgId, parent_id: slot.parent_id }
  const success = `${appUrl()}/dashboard/sessions?setup=done`
  const cancel = `${appUrl()}/dashboard/sessions?setup=cancelled`

  let cs: Stripe.Checkout.Session
  if (b.amountPence > 0) {
    cs = await stripe.checkout.sessions.create({
      mode: 'payment', customer_email: parent.email, customer_creation: 'always',
      line_items: [{ quantity: 1, price_data: { currency: 'gbp', unit_amount: b.amountPence, product_data: {
        name: `${label} · ${fmtDate(from).split(' ').slice(2).join(' ')} onwards`,
        description: `${b.sessionIds.length} session${b.sessionIds.length === 1 ? '' : 's'} this month${b.creditAppliedPence > 0 ? `, £${(b.creditAppliedPence / 100).toFixed(2)} credit applied` : ''} · then charged on the 1st · ${bits.name}`,
      } } }],
      payment_intent_data: {
        on_behalf_of: stripeAccountId, transfer_data: { destination: stripeAccountId },
        ...(rate > 0 ? { application_fee_amount: Math.round(b.amountPence * rate) } : {}),
        setup_future_usage: 'off_session', description: `${bits.name} · ${label}`, metadata,
      },
      expires_at: Math.floor(Date.now() / 1000) + 24 * 3600, success_url: success, cancel_url: cancel, metadata,
    })
  } else {
    const customer = await stripe.customers.create({ email: parent.email, name: parent.name || undefined, metadata: { pp_module: ONE_TO_ONE_MODULE, parent_id: slot.parent_id } })
    cs = await stripe.checkout.sessions.create({
      mode: 'setup', customer: customer.id, currency: 'gbp', payment_method_types: ['card'],
      expires_at: Math.floor(Date.now() / 1000) + 24 * 3600, success_url: success, cancel_url: cancel, metadata,
    })
  }
  await admin.from('coaching_charges').update({ stripe_checkout_session_id: cs.id }).eq('id', charge.id)

  await sendSetupLink({
    academy: bits.name, to: parent.email, parentName: parent.name, childName: child,
    slotLabel: `${DAY[slot.weekday]}s ${hhmm(slot.start_minutes)} at ${bits.venue(slot.venue_id)} with ${bits.coach(slot.coach_id)}`,
    pricePence: slot.price_pence, sessionsThisMonth: b.sessionIds.length, amountPence: b.amountPence, creditPence: Math.max(0, b.creditAppliedPence), url: cs.url!,
  }).catch((e) => console.error('setup email failed', e))
  return { url: cs.url!, amountPence: b.amountPence }
}

/** Webhook: the set-up Checkout completed. Slot goes active, card is remembered, month is paid. */
export async function completeSetup(admin: SupabaseClient, cs: Stripe.Checkout.Session) {
  const slotId = cs.metadata?.regular_slot_id, chargeId = cs.metadata?.charge_id
  if (!slotId || !chargeId) return
  const customer = typeof cs.customer === 'string' ? cs.customer : cs.customer?.id
  let paymentMethod: string | null = null, paymentIntent: string | null = null
  if (cs.mode === 'payment' && cs.payment_intent) {
    const pi = await stripe.paymentIntents.retrieve(typeof cs.payment_intent === 'string' ? cs.payment_intent : cs.payment_intent.id)
    paymentIntent = pi.id
    paymentMethod = typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id || null
  } else if (cs.mode === 'setup' && cs.setup_intent) {
    const si = await stripe.setupIntents.retrieve(typeof cs.setup_intent === 'string' ? cs.setup_intent : cs.setup_intent.id)
    paymentMethod = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id || null
  }
  const { data: slot } = await admin.from('regular_slots').select('*').eq('id', slotId).single()
  if (!slot) return
  // The card belongs to the parent: every slot of theirs at this academy can use it.
  await admin.from('regular_slots').update({ stripe_customer_id: customer || null, stripe_payment_method_id: paymentMethod })
    .eq('organisation_id', slot.organisation_id).eq('parent_id', slot.parent_id)
  await admin.from('regular_slots').update({ status: 'active' }).eq('id', slotId).eq('status', 'pending')
  const { data: charge } = await admin.from('coaching_charges').select('*').eq('id', chargeId).single()
  if (charge && charge.status === 'pending') {
    await settleCharge(admin, charge, { how: charge.amount_pence > 0 ? 'paid_online' : 'waived', paymentIntent })
    const parent = await parentBits(admin, slot.parent_id)
    const bits = await orgBits(admin, slot.organisation_id)
    if (parent.email && charge.amount_pence > 0) {
      await sendMonthReceipt({ academy: bits.name, to: parent.email, parentName: parent.name, monthLabel: monthLabel(charge.billing_month), sessionsPence: charge.sessions_pence, creditPence: charge.credit_applied_pence, amountPence: charge.amount_pence, count: (charge.breakdown as unknown[]).length }).catch(() => {})
    }
  }
}

// ─── 2. the month: roll + notice (20th), charge (1st, 4th, 8th) ──────────

/** Breakdown for one parent for one month, from live session rows. */
export interface MonthSessionRow {
  id: string; price_pence: number; status: string; decline_tier: string | null
  session_date: string; start_minutes: number; coach_id: string; venue_id: string; regular_slot_id: string | null; charge_state: string
}
export async function monthForParent(admin: SupabaseClient, orgId: string, parentId: string, billingMonth: string) {
  const from = monthStart(billingMonth), to = monthEnd(billingMonth)
  const { data: rows } = await admin.from('coaching_sessions')
    .select('id, price_pence, status, decline_tier, session_date, start_minutes, coach_id, venue_id, regular_slot_id, charge_state')
    .eq('organisation_id', orgId).eq('parent_id', parentId).eq('source', 'regular').eq('charge_state', 'unpaid')
    .gte('session_date', from).lte('session_date', to).order('session_date')
  // A slot the parent hasn't set up yet is not theirs to be charged for.
  const { data: pendingSlots } = await admin.from('regular_slots').select('id').eq('organisation_id', orgId).eq('parent_id', parentId).eq('status', 'pending')
  const pendingIds = new Set((pendingSlots ?? []).map((r) => r.id as string))
  const sessions = ((rows ?? []) as MonthSessionRow[]).filter((r) => !r.regular_slot_id || !pendingIds.has(r.regular_slot_id))
  const credit = await creditBalance(admin, orgId, parentId)
  const chargeable: ChargeableSession[] = sessions.map((s) => ({ id: s.id, pricePence: s.price_pence, status: s.status, declineTier: s.decline_tier }))
  return { sessions, breakdown: chargeBreakdown(chargeable, credit) }
}

/** The 20th: tell every regular's parent what next month looks like. No reply needed. */
export async function sendMonthNotices(admin: SupabaseClient, billingMonth: string): Promise<{ sent: number; skipped: number }> {
  const from = monthStart(billingMonth), to = monthEnd(billingMonth)
  const { data: rows } = await admin.from('coaching_sessions').select('organisation_id, parent_id')
    .eq('source', 'regular').eq('status', 'scheduled').eq('charge_state', 'unpaid').gte('session_date', from).lte('session_date', to)
  const pairs = [...new Set((rows ?? []).map((r) => `${r.organisation_id}|${r.parent_id}`))]
  let sent = 0, skipped = 0
  const bitsCache = new Map<string, Awaited<ReturnType<typeof orgBits>>>()
  for (const key of pairs) {
    const [orgId, parentId] = key.split('|')
    if (!parentId) { skipped++; continue }
    const parent = await parentBits(admin, parentId)
    if (!parent.email) { skipped++; continue }
    if (!bitsCache.has(orgId)) bitsCache.set(orgId, await orgBits(admin, orgId))
    const bits = bitsCache.get(orgId)!
    const m = await monthForParent(admin, orgId, parentId, billingMonth)
    const r = await sendMonthNotice({
      academy: bits.name, to: parent.email, parentName: parent.name, monthLabel: monthLabel(billingMonth),
      lines: m.sessions.filter((s) => s.status === 'scheduled').map((s) => ({ date: s.session_date, time: hhmm(s.start_minutes), coach: bits.coach(s.coach_id), venue: bits.venue(s.venue_id), pricePence: s.price_pence })),
      creditPence: m.breakdown.creditAppliedPence, amountPence: m.breakdown.amountPence, chargeDate: `1 ${monthLabel(billingMonth)}`,
      url: `${appUrl()}/dashboard/sessions`,
    }).catch(() => ({ success: false }))
    if ((r as { success?: boolean }).success) sent++; else skipped++
  }
  return { sent, skipped }
}

/** The 1st (and 4th, 8th): charge every parent whose month is pending or due a retry. */
export async function runMonthlyCharges(admin: SupabaseClient, billingMonth: string, today = todayLondon()): Promise<{ charged: number; waived: number; failed: number; skipped: number }> {
  const month = monthStart(billingMonth)
  const out = { charged: 0, waived: 0, failed: 0, skipped: 0 }
  // Everyone with unpaid regular sessions this month.
  const { data: rows } = await admin.from('coaching_sessions').select('organisation_id, parent_id')
    .eq('source', 'regular').eq('charge_state', 'unpaid').gte('session_date', month).lte('session_date', monthEnd(month)).not('parent_id', 'is', null)
  const pairs = [...new Set((rows ?? []).map((r) => `${r.organisation_id}|${r.parent_id}`))]
  for (const key of pairs) {
    const [orgId, parentId] = key.split('|')
    try {
      const r = await chargeParentMonth(admin, orgId, parentId, month, today)
      out[r]++
    } catch (e) {
      console.error('monthly charge failed', key, e)
      out.failed++
    }
  }
  return out
}

export async function chargeParentMonth(admin: SupabaseClient, orgId: string, parentId: string, month: string, today = todayLondon()): Promise<'charged' | 'waived' | 'failed' | 'skipped'> {
  const { data: existing } = await admin.from('coaching_charges').select('*').eq('parent_id', parentId).eq('billing_month', month).maybeSingle()
  if (existing && ['paid_online', 'paid_cash', 'waived', 'refunded'].includes(existing.status)) return 'skipped'
  if (existing && existing.status === 'failed' && (!existing.next_attempt_on || existing.next_attempt_on > today)) return 'skipped'
  const m = await monthForParent(admin, orgId, parentId, month)
  if (m.breakdown.sessionIds.length === 0) return 'skipped'
  const b = m.breakdown
  const row = {
    organisation_id: orgId, parent_id: parentId, billing_month: month,
    sessions_pence: b.sessionsPence, credit_applied_pence: b.creditAppliedPence, amount_pence: b.amountPence,
    breakdown: b.sessionIds.map((id) => ({ session_id: id })),
  }
  const { data: charge, error } = await admin.from('coaching_charges')
    .upsert({ ...row, status: existing?.status === 'failed' ? 'failed' : 'pending', attempt_count: existing?.attempt_count ?? 0 }, { onConflict: 'parent_id,billing_month' })
    .select('*').single()
  if (error) throw new Error(error.message)

  const parent = await parentBits(admin, parentId)
  const bits = await orgBits(admin, orgId)

  if (b.amountPence === 0) {
    await settleCharge(admin, charge, { how: 'waived', paymentIntent: null })
    return 'waived'
  }

  // Card on file: any of the parent's slots at this academy.
  const { data: slotWithCard } = await admin.from('regular_slots').select('stripe_customer_id, stripe_payment_method_id')
    .eq('organisation_id', orgId).eq('parent_id', parentId).not('stripe_payment_method_id', 'is', null).limit(1).maybeSingle()
  let failure: string | null = null
  let paymentIntent: string | null = null
  if (!slotWithCard?.stripe_customer_id || !slotWithCard.stripe_payment_method_id) {
    failure = 'No card saved'
  } else {
    try {
      const { rate, stripeAccountId } = await platformFeeRate(admin, orgId)
      const pi = await stripe.paymentIntents.create({
        amount: b.amountPence, currency: 'gbp', customer: slotWithCard.stripe_customer_id, payment_method: slotWithCard.stripe_payment_method_id,
        off_session: true, confirm: true,
        on_behalf_of: stripeAccountId, transfer_data: { destination: stripeAccountId },
        ...(rate > 0 ? { application_fee_amount: Math.round(b.amountPence * rate) } : {}),
        description: `${bits.name} · 1-2-1 sessions · ${monthLabel(month)}`,
        metadata: { pp_module: ONE_TO_ONE_MODULE, kind: 'monthly', charge_id: charge.id, organisation_id: orgId, parent_id: parentId },
      }, { idempotencyKey: `one-to-one:${charge.id}:${(charge.attempt_count ?? 0) + 1}` })
      if (pi.status === 'succeeded') paymentIntent = pi.id
      else failure = `Card needs attention (${pi.status})`
    } catch (e) {
      const err = e as { message?: string; code?: string }
      failure = err.message || err.code || 'Card declined'
    }
  }

  if (!failure && paymentIntent) {
    await settleCharge(admin, charge, { how: 'paid_online', paymentIntent })
    if (parent.email) await sendMonthReceipt({ academy: bits.name, to: parent.email, parentName: parent.name, monthLabel: monthLabel(month), sessionsPence: b.sessionsPence, creditPence: b.creditAppliedPence, amountPence: b.amountPence, count: b.sessionIds.length }).catch(() => {})
    return 'charged'
  }

  const attempts = (charge.attempt_count ?? 0) + 1
  const next = nextAttemptOn(month, attempts)
  await admin.from('coaching_charges').update({ status: 'failed', attempt_count: attempts, last_attempt_at: new Date().toISOString(), next_attempt_on: next, failure_message: failure }).eq('id', charge.id)
  // From the second failure, hand the parent a normal payment page.
  if (attempts >= 2 && parent.email) {
    const url = await payNowUrl(admin, orgId, charge.id).catch(() => null)
    if (url) await sendPaymentFailed({ academy: bits.name, to: parent.email, parentName: parent.name, monthLabel: monthLabel(month), amountPence: b.amountPence, attempts, url, lastTry: next ? `${next.slice(8)} ${monthLabel(month)}` : null }).catch(() => {})
  }
  return 'failed'
}

async function settleCharge(admin: SupabaseClient, charge: { id: string; organisation_id: string; parent_id: string; credit_applied_pence: number; breakdown: unknown; billing_month: string }, opts: { how: 'paid_online' | 'waived' | 'paid_cash'; paymentIntent: string | null; by?: string }) {
  const ids = ((charge.breakdown as { session_id: string }[]) || []).map((x) => x.session_id)
  await admin.from('coaching_charges').update({
    status: opts.how, stripe_payment_intent_id: opts.paymentIntent, last_attempt_at: new Date().toISOString(), next_attempt_on: null, failure_message: null,
    ...(opts.how === 'paid_cash' ? { cash_received_by: opts.by || null, cash_received_at: new Date().toISOString() } : {}),
  }).eq('id', charge.id)
  if (ids.length) await admin.from('coaching_sessions').update({ charge_state: opts.how === 'paid_cash' ? 'paid_cash' : 'charged', charge_id: charge.id }).in('id', ids)
  if (charge.credit_applied_pence && charge.credit_applied_pence !== 0) {
    await admin.from('coaching_credits').insert({ organisation_id: charge.organisation_id, parent_id: charge.parent_id, amount_pence: -charge.credit_applied_pence, reason: 'applied_to_charge', charge_id: charge.id, note: `applied to ${monthLabel(charge.billing_month)}` })
  }
}

/** A normal Checkout for a failed month. Webhook marks it paid. */
export async function payNowUrl(admin: SupabaseClient, orgId: string, chargeId: string): Promise<string> {
  const { data: charge } = await admin.from('coaching_charges').select('*').eq('id', chargeId).eq('organisation_id', orgId).single()
  if (!charge || charge.amount_pence <= 0) throw new CheckoutBlocked('Nothing to pay', 400)
  const parent = await parentBits(admin, charge.parent_id)
  const bits = await orgBits(admin, orgId)
  const { rate, stripeAccountId } = await platformFeeRate(admin, orgId)
  const metadata = { pp_module: ONE_TO_ONE_MODULE, kind: 'paynow', charge_id: charge.id, organisation_id: orgId, parent_id: charge.parent_id }
  const cs = await stripe.checkout.sessions.create({
    mode: 'payment', customer_email: parent.email || undefined, customer_creation: 'always',
    line_items: [{ quantity: 1, price_data: { currency: 'gbp', unit_amount: charge.amount_pence, product_data: { name: `1-2-1 sessions · ${monthLabel(charge.billing_month)}`, description: bits.name } } }],
    payment_intent_data: { on_behalf_of: stripeAccountId, transfer_data: { destination: stripeAccountId }, ...(rate > 0 ? { application_fee_amount: Math.round(charge.amount_pence * rate) } : {}), setup_future_usage: 'off_session', metadata },
    success_url: `${appUrl()}/dashboard/sessions?paid=1`, cancel_url: `${appUrl()}/dashboard/sessions`, metadata,
  })
  await admin.from('coaching_charges').update({ stripe_checkout_session_id: cs.id }).eq('id', charge.id)
  return cs.url!
}

/** Webhook: a pay-now Checkout completed. */
export async function completePayNow(admin: SupabaseClient, cs: Stripe.Checkout.Session) {
  const chargeId = cs.metadata?.charge_id
  if (!chargeId) return
  const { data: charge } = await admin.from('coaching_charges').select('*').eq('id', chargeId).single()
  if (!charge || ['paid_online', 'paid_cash'].includes(charge.status)) return
  const piId = typeof cs.payment_intent === 'string' ? cs.payment_intent : cs.payment_intent?.id || null
  await settleCharge(admin, charge, { how: 'paid_online', paymentIntent: piId })
  // Refresh the saved card from this payment for next month.
  if (piId) {
    const pi = await stripe.paymentIntents.retrieve(piId)
    const pm = typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id
    const customer = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id
    if (pm && customer) await admin.from('regular_slots').update({ stripe_customer_id: customer, stripe_payment_method_id: pm }).eq('organisation_id', charge.organisation_id).eq('parent_id', charge.parent_id)
  }
  const parent = await parentBits(admin, charge.parent_id); const bits = await orgBits(admin, charge.organisation_id)
  if (parent.email) await sendMonthReceipt({ academy: bits.name, to: parent.email, parentName: parent.name, monthLabel: monthLabel(charge.billing_month), sessionsPence: charge.sessions_pence, creditPence: charge.credit_applied_pence, amountPence: charge.amount_pence, count: (charge.breakdown as unknown[]).length }).catch(() => {})
}

// ─── 3. declines, cancellations, cash, refunds ───────────────────────────

export async function declineByParent(admin: SupabaseClient, sessionId: string, parentId: string, now = new Date()) {
  const { data: s } = await admin.from('coaching_sessions').select('*').eq('id', sessionId).eq('parent_id', parentId).single()
  if (!s) throw new CheckoutBlocked('Session not found', 404)
  if (s.status !== 'scheduled') throw new CheckoutBlocked('That session can\'t be declined now', 409)
  const outcome = declineOutcome({ sessionDate: s.session_date, startMinutes: s.start_minutes, pricePence: s.price_pence, now })
  const alreadyCharged = s.charge_state === 'charged' || s.charge_state === 'paid_cash' || s.charge_state === 'paid_online'
  const effect = declineEffect(outcome.tier, s.price_pence, alreadyCharged)
  await admin.from('coaching_sessions').update({ status: 'declined', decline_tier: outcome.tier, declined_at: now.toISOString(), charge_state: effect.stillChargeable ? s.charge_state : (alreadyCharged ? 'credited' : s.charge_state) }).eq('id', s.id)
  if (effect.ledgerPence !== 0) {
    await admin.from('coaching_credits').insert({ organisation_id: s.organisation_id, parent_id: parentId, amount_pence: effect.ledgerPence, reason: 'parent_decline', session_id: s.id, note: `${outcome.tier} · ${fmtDate(s.session_date)} ${hhmm(s.start_minutes)}` })
  }
  const parent = await parentBits(admin, parentId); const bits = await orgBits(admin, s.organisation_id)
  if (parent.email) await sendDeclined({ academy: bits.name, to: parent.email, parentName: parent.name, date: s.session_date, startMinutes: s.start_minutes, message: effect.message }).catch(() => {})
  return { tier: outcome.tier, message: effect.message, ledgerPence: effect.ledgerPence }
}

/** The academy cancels a session with no cover: always a full credit if it was paid. */
export async function cancelByAcademy(admin: SupabaseClient, orgId: string, sessionId: string, reason: string | null) {
  const { data: s } = await admin.from('coaching_sessions').select('*').eq('id', sessionId).eq('organisation_id', orgId).single()
  if (!s) throw new CheckoutBlocked('Session not found', 404)
  if (s.status !== 'scheduled') return
  const wasCharged = s.charge_state === 'charged' || s.charge_state === 'paid_cash' || s.charge_state === 'paid_online'
  await admin.from('coaching_sessions').update({ status: 'cancelled', charge_state: wasCharged ? 'credited' : s.charge_state, note: reason || 'cancelled by academy' }).eq('id', s.id)
  if (wasCharged && s.parent_id && s.price_pence > 0) {
    await admin.from('coaching_credits').insert({ organisation_id: orgId, parent_id: s.parent_id, amount_pence: s.price_pence, reason: 'academy_cancel', session_id: s.id, note: reason || null })
  }
  const to = s.guest_email || (s.parent_id ? (await parentBits(admin, s.parent_id)).email : null)
  const bits = await orgBits(admin, orgId)
  if (to) await sendAcademyCancelled({ academy: bits.name, to, date: s.session_date, startMinutes: s.start_minutes, creditedPence: wasCharged ? s.price_pence : 0, reason }).catch(() => {})
}

export async function markCash(admin: SupabaseClient, orgId: string, chargeId: string, byUserId: string) {
  const { data: charge } = await admin.from('coaching_charges').select('*').eq('id', chargeId).eq('organisation_id', orgId).single()
  if (!charge) throw new CheckoutBlocked('Charge not found', 404)
  if (['paid_online', 'paid_cash', 'refunded'].includes(charge.status)) throw new CheckoutBlocked('Already settled', 409)
  await settleCharge(admin, charge, { how: 'paid_cash', paymentIntent: null, by: byUserId })
}

/** Admin only, last resort. Full refund, transfer reversed, fee returned. */
export async function refundCharge(admin: SupabaseClient, orgId: string, chargeId: string) {
  const { data: charge } = await admin.from('coaching_charges').select('*').eq('id', chargeId).eq('organisation_id', orgId).single()
  if (!charge?.stripe_payment_intent_id) throw new CheckoutBlocked('Nothing to refund on Stripe for this month', 400)
  if (charge.status === 'refunded') throw new CheckoutBlocked('Already refunded', 409)
  await stripe.refunds.create({ payment_intent: charge.stripe_payment_intent_id, reverse_transfer: true, refund_application_fee: true, reason: 'requested_by_customer' })
  const ids = ((charge.breakdown as { session_id: string }[]) || []).map((x) => x.session_id)
  await admin.from('coaching_charges').update({ status: 'refunded' }).eq('id', charge.id)
  if (ids.length) await admin.from('coaching_sessions').update({ charge_state: 'waived', note: 'refunded' }).in('id', ids)
}

export function monthLabel(billingMonth: string): string {
  return new Date(`${billingMonth.slice(0, 7)}-01T12:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/London' })
}

