/**
 * POST /api/admin/camps/[campId]/bookings/[bookingId]/amount — "Change amount" on an
 * unpaid camp booking (WLFA, 17 Oct 2026: "can she change the amount?").
 *
 * The academy sets what this one family owes (a sibling deal, a missed day) with a
 * reason. The red "£X outstanding" box and the never-expiring payment link use the new
 * amount at once. Never £0 — nobody attends free (BILLING_RULES.md "Camps"). Paid
 * bookings can't be changed here; that's Refund. Recorded in the audit log.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest, ctx: { params: Promise<{ campId: string; bookingId: string }> }) {
  const { campId, bookingId } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Only an admin can change what a family owes.' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as { amount?: unknown; reason?: unknown }
  const amount = Math.round(Number(body.amount) * 100) / 100
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : ''
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Enter an amount above £0. Nobody attends for free — remove the booking instead if they are not coming.' }, { status: 400 })
  if (amount > 5000) return NextResponse.json({ error: 'That amount looks too high. Check it and try again.' }, { status: 400 })
  if (!reason) return NextResponse.json({ error: 'Say why, e.g. "sibling discount" or "only coming 2 days".' }, { status: 400 })

  const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: b } = await svc.from('camp_bookings').select('id, camp_id, organisation_id, payment_status, amount_paid, stripe_session_id, child_name').eq('id', bookingId).maybeSingle()
  if (!b || b.organisation_id !== profile.organisation_id || b.camp_id !== campId) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (b.payment_status !== 'pending') return NextResponse.json({ error: 'Only an unpaid booking can have its amount changed. For a paid one, use Refund.' }, { status: 400 })

  // An open Stripe page still asks for the old amount: close it. The pay link opens a fresh one.
  if (b.stripe_session_id) {
    try { const s = await stripe.checkout.sessions.retrieve(b.stripe_session_id as string); if (s.status === 'open') await stripe.checkout.sessions.expire(s.id) } catch { /* stale id */ }
  }
  const { error } = await svc.from('camp_bookings').update({ amount_paid: amount }).eq('id', bookingId).eq('payment_status', 'pending')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await svc.from('audit_log').insert({
    organisation_id: b.organisation_id, user_id: user.id, action: 'camp_booking.amount_changed', entity_type: 'camp_booking', entity_id: bookingId,
    details: { child: b.child_name, from: Number(b.amount_paid || 0), to: amount, reason },
  })
  return NextResponse.json({ ok: true, amount })
}
