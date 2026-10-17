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
import { sendEmail } from '@/lib/email'
import { checkCampLink } from '@/lib/camp-payment-link'

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

  // Same checks the parent's Pay button makes (src/lib/camp-payment-link.ts).
  const c = await checkCampLink(svc, bookingId)
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status })
  const { booking, camp, org, amountPence } = c
  if (booking.organisation_id !== orgId || booking.camp_id !== campId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!booking.parent_email || String(booking.parent_email).endsWith('@theplayerportal.net')) {
    return NextResponse.json({ error: 'No real parent email on this booking.' }, { status: 400 })
  }
  // The link never runs out: it opens /pay/camp/<id>, which makes a fresh Stripe
  // payment every time it's tapped (Stripe's own pages die after 24 hours —
  // WLFA's Felix dropped off a camp twice that way, 17 Oct 2026).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
  const payUrl = `${appUrl}/pay/camp/${booking.id}`

  // ── Email the parent, branded as the academy ──
  const fmt = (iso: string | null) => iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''
  const dates = [fmt(camp.start_date as string | null), fmt(camp.end_date as string | null)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' → ')
  const firstName = String(booking.parent_name || '').trim().split(/\s+/)[0] || 'there'
  const html = `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5">
  <p>Hi ${esc(firstName)},</p>
  <p>${esc(booking.child_name as string)}'s place on <strong>${esc(camp.name as string)}</strong>${dates ? ` (${esc(dates)})` : ''} is being held for you but hasn't been paid for yet.</p>
  <p style="margin:24px 0"><a href="${payUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Pay £${(amountPence / 100).toFixed(2)} and confirm the place</a></p>
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

  return NextResponse.json({ ok: true, url: payUrl, emailed: mail.success })
}
