/**
 * POST /api/admin/camps/[campId]/bookings/[bookingId]/payment-link
 *
 * "Send payment link" on the camp roster. For a booking that is still
 * `pending` — a parent who booked but never completed checkout — this mints
 * a fresh Stripe Checkout link for the booking's amount and emails it to the
 * parent, academy-branded. When they pay, the normal webhook path takes
 * over: the booking flips to paid, the child becomes a player, both
 * confirmation emails go out.
 *
 * Why it exists: a parent double-booked a child, paid for neither, and the
 * academy had no way to chase — the roster could move or resend a
 * confirmation, nothing else. The owner had to ask the platform to build a
 * link by hand.
 *
 * Routing and fee mirror /api/stripe/camp-checkout exactly: on_behalf_of +
 * transfer_data to the academy's connected account, application fee from
 * the academy's platform plan (default 3.5%). Any previous open session for
 * this booking is expired first so there is only ever one live link.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/email'
import { isConnectChargeReady, CONNECT_NOT_READY_MESSAGE } from '@/lib/connect-readiness'

function getServiceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ campId: string; bookingId: string }> },
) {
  const { campId, bookingId } = await ctx.params
  if (!campId || !bookingId) return NextResponse.json({ error: 'Missing camp or booking id' }, { status: 400 })

  // ── Auth: admin/coach of the owning academy ──
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!profile || !['admin', 'coach'].includes(profile.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const orgId = profile.organisation_id as string
  const svc = getServiceClient()

  const { data: booking } = await svc
    .from('camp_bookings')
    .select('id, camp_id, organisation_id, parent_email, parent_name, child_name, amount_paid, payment_status, stripe_session_id')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.organisation_id !== orgId || booking.camp_id !== campId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (booking.payment_status !== 'pending') {
    return NextResponse.json({ error: `This booking is ${booking.payment_status} — a payment link only applies to an unpaid booking.` }, { status: 400 })
  }
  const amountPence = Math.round(Number(booking.amount_paid || 0) * 100)
  if (amountPence <= 0) {
    return NextResponse.json({ error: 'This booking has no amount to collect.' }, { status: 400 })
  }
  if (!booking.parent_email || String(booking.parent_email).endsWith('@theplayerportal.net')) {
    return NextResponse.json({ error: 'No real parent email on this booking.' }, { status: 400 })
  }

  const { data: camp } = await svc.from('camps').select('id, name, start_date, end_date, is_published').eq('id', campId).maybeSingle()
  if (!camp) return NextResponse.json({ error: 'Camp not found' }, { status: 404 })

  const { data: org } = await svc
    .from('organisations')
    .select('name, slug, stripe_account_id, platform_plan_id, contact_email, contact_phone')
    .eq('id', orgId)
    .single()
  if (!org?.stripe_account_id) return NextResponse.json({ error: 'Connect Stripe before sending payment links.' }, { status: 400 })
  if (!(await isConnectChargeReady(org.stripe_account_id))) {
    return NextResponse.json({ error: CONNECT_NOT_READY_MESSAGE }, { status: 400 })
  }

  let feeRate = 0.035
  if (org.platform_plan_id) {
    const { data: plan } = await svc.from('platform_plans').select('transaction_fee_percent').eq('id', org.platform_plan_id).single()
    if (plan) feeRate = Number(plan.transaction_fee_percent) / 100
  }
  const feeAmount = feeRate > 0 ? Math.round(amountPence * feeRate) : 0

  // Only one live link per booking.
  if (booking.stripe_session_id) {
    try {
      const old = await stripe.checkout.sessions.retrieve(booking.stripe_session_id)
      if (old.status === 'open') await stripe.checkout.sessions.expire(old.id)
    } catch { /* stale id — ignore */ }
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
  const session = await stripe.checkout.sessions.create({
    customer_email: booking.parent_email,
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'gbp',
        product_data: { name: camp.name as string, description: `${booking.child_name} - ${camp.name}` },
        unit_amount: amountPence,
      },
      quantity: 1,
    }],
    payment_intent_data: {
      on_behalf_of: org.stripe_account_id,
      ...(feeAmount > 0 ? { application_fee_amount: feeAmount } : {}),
      transfer_data: { destination: org.stripe_account_id },
    },
    success_url: `${origin}/book/${org.slug}/camps/${campId}?booked=1&booking=${booking.id}`,
    cancel_url: `${origin}/book/${org.slug}/camps/${campId}?cancelled=1`,
    // Stripe caps Checkout links at 24h; 23h keeps clear of clock skew.
    expires_at: Math.floor(Date.now() / 1000) + 23 * 3600,
    metadata: { camp_booking_id: booking.id, camp_id: campId, child_name: booking.child_name as string, sent_by: 'academy_payment_link' },
  })

  await svc.from('camp_bookings').update({ stripe_session_id: session.id }).eq('id', booking.id)

  // ── Email the parent, branded as the academy ──
  const fmt = (iso: string | null) => iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''
  const dates = [fmt(camp.start_date as string | null), fmt(camp.end_date as string | null)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' → ')
  const firstName = String(booking.parent_name || '').trim().split(/\s+/)[0] || 'there'
  const html = `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5">
  <p>Hi ${esc(firstName)},</p>
  <p>${esc(booking.child_name as string)}'s place on <strong>${esc(camp.name as string)}</strong>${dates ? ` (${esc(dates)})` : ''} is being held for you but hasn't been paid for yet.</p>
  <p style="margin:24px 0"><a href="${session.url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Pay £${(amountPence / 100).toFixed(2)} and confirm the place</a></p>
  <p style="color:#555;font-size:14px">The link is valid for 24 hours. If it expires, you can book again from ${esc(org.name as string)}'s booking page.</p>
  <p style="color:#555;font-size:14px">Questions? Reply to this email${org.contact_phone ? ` or call ${esc(org.contact_phone as string)}` : ''}.</p>
  <p>${esc(org.name as string)}</p>
</div>`
  const mail = await sendEmail({
    to: booking.parent_email as string,
    subject: `Complete ${booking.child_name}'s booking — ${camp.name}`,
    html,
    fromName: org.name as string,
    replyTo: (org.contact_email as string | null) || undefined,
  })

  return NextResponse.json({ ok: true, url: session.url, emailed: mail.success, expiresAt: session.expires_at })
}
