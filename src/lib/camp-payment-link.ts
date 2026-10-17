import type { SupabaseClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { isConnectChargeReady, CONNECT_NOT_READY_MESSAGE } from '@/lib/connect-readiness'

/**
 * A camp payment link that keeps working until it's paid.
 *
 * John, 17 Oct 2026 (WLFA, Felix): "it's simple, we should just be able to send a
 * link … it should come up red and then the academy sends the link." Stripe's
 * payment pages die after 24 hours, so the emailed link now points at
 * /pay/camp/<booking id>, and every tap there opens a fresh Stripe payment for
 * what's owed. The booking stays on the register in red until it's paid or the
 * academy removes it. Routing and fee mirror /api/stripe/camp-checkout.
 */

export type CampLinkCheck =
  | { ok: true; booking: Booking; camp: Camp; org: Org; amountPence: number }
  | { ok: false; error: string; status: number }

interface Booking { id: string; camp_id: string; organisation_id: string; parent_email: string | null; parent_name: string | null; child_name: string | null; amount_paid: number | null; payment_status: string; stripe_session_id: string | null }
interface Camp { id: string; name: string; start_date: string | null; end_date: string | null }
interface Org { name: string; slug: string; stripe_account_id: string | null; platform_plan_id: string | null; contact_email: string | null; contact_phone: string | null }

/** Everything that must be true before a link can be sent or paid. */
export async function checkCampLink(svc: SupabaseClient, bookingId: string): Promise<CampLinkCheck> {
  const { data: booking } = await svc.from('camp_bookings')
    .select('id, camp_id, organisation_id, parent_email, parent_name, child_name, amount_paid, payment_status, stripe_session_id')
    .eq('id', bookingId).maybeSingle()
  if (!booking) return { ok: false, error: 'This booking could not be found.', status: 404 }
  if (booking.payment_status === 'paid') return { ok: false, error: 'This place is already paid for.', status: 409 }
  if (booking.payment_status !== 'pending') return { ok: false, error: 'This booking is no longer open for payment. Please contact the academy.', status: 410 }
  const amountPence = Math.round(Number(booking.amount_paid || 0) * 100)
  if (amountPence <= 0) return { ok: false, error: 'This booking has no amount to collect.', status: 400 }
  const { data: camp } = await svc.from('camps').select('id, name, start_date, end_date').eq('id', booking.camp_id).maybeSingle()
  if (!camp) return { ok: false, error: 'Camp not found.', status: 404 }
  const { data: org } = await svc.from('organisations').select('name, slug, stripe_account_id, platform_plan_id, contact_email, contact_phone').eq('id', booking.organisation_id).single()
  if (!org?.stripe_account_id) return { ok: false, error: 'The academy has not finished setting up payments yet.', status: 400 }
  if (!(await isConnectChargeReady(org.stripe_account_id))) return { ok: false, error: CONNECT_NOT_READY_MESSAGE, status: 400 }
  return { ok: true, booking: booking as Booking, camp: camp as Camp, org: org as Org, amountPence }
}

/** A fresh Stripe payment for what's owed. Any older open one is closed first, so only one is ever live. */
export async function openCampCheckout(svc: SupabaseClient, c: Extract<CampLinkCheck, { ok: true }>, origin: string): Promise<string> {
  const { booking, camp, org, amountPence } = c
  let feeRate = 0.035
  if (org.platform_plan_id) {
    const { data: plan } = await svc.from('platform_plans').select('transaction_fee_percent').eq('id', org.platform_plan_id).single()
    if (plan) feeRate = Number(plan.transaction_fee_percent) / 100
  }
  const feeAmount = feeRate > 0 ? Math.round(amountPence * feeRate) : 0
  if (booking.stripe_session_id) {
    try {
      const old = await stripe.checkout.sessions.retrieve(booking.stripe_session_id)
      if (old.status === 'open') await stripe.checkout.sessions.expire(old.id)
    } catch { /* stale id — ignore */ }
  }
  const session = await stripe.checkout.sessions.create({
    ...(booking.parent_email && !booking.parent_email.endsWith('@theplayerportal.net') ? { customer_email: booking.parent_email } : {}),
    mode: 'payment',
    line_items: [{ price_data: { currency: 'gbp', product_data: { name: camp.name, description: `${booking.child_name} - ${camp.name}` }, unit_amount: amountPence }, quantity: 1 }],
    payment_intent_data: {
      on_behalf_of: org.stripe_account_id!,
      ...(feeAmount > 0 ? { application_fee_amount: feeAmount } : {}),
      transfer_data: { destination: org.stripe_account_id! },
    },
    success_url: `${origin}/book/${org.slug}/camps/${camp.id}?booked=1&booking=${booking.id}`,
    cancel_url: `${origin}/pay/camp/${booking.id}?cancelled=1`,
    metadata: { camp_booking_id: booking.id, camp_id: camp.id, child_name: booking.child_name || '', sent_by: 'academy_payment_link' },
  })
  await svc.from('camp_bookings').update({ stripe_session_id: session.id }).eq('id', booking.id).eq('payment_status', 'pending')
  return session.url as string
}
