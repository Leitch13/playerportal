/**
 * DELETE /api/admin/camps/[campId]/bookings/[bookingId]
 *
 * "Remove" on the camp roster — for bookings that were never paid. A
 * duplicate from a double-click, a test, a parent who changed their mind
 * before paying: rows that hold a seat and mean nothing. Until now the
 * roster had no way to get rid of one; the academy owner had to ask the
 * platform.
 *
 * Hard rules:
 *   - admin only, own academy only
 *   - the booking must be `pending` — anything paid, refunded or otherwise
 *     touched by money is refused here and goes through the refund path
 *   - any open Stripe checkout for the booking is expired first, so a link
 *     already in a parent's inbox can't pay for a row that no longer exists
 *   - the row is snapshotted into the audit log before deletion
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

function getServiceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ campId: string; bookingId: string }> },
) {
  const { campId, bookingId } = await ctx.params
  if (!campId || !bookingId) return NextResponse.json({ error: 'Missing camp or booking id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const orgId = profile.organisation_id as string
  const svc = getServiceClient()

  const { data: booking } = await svc.from('camp_bookings').select('*').eq('id', bookingId).maybeSingle()
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.organisation_id !== orgId || booking.camp_id !== campId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (booking.payment_status !== 'pending') {
    return NextResponse.json(
      { error: `This booking is ${booking.payment_status}. Only unpaid bookings can be removed — use Refund for paid ones.` },
      { status: 400 },
    )
  }

  if (booking.stripe_session_id) {
    try {
      const s = await stripe.checkout.sessions.retrieve(booking.stripe_session_id as string)
      if (s.status === 'open') await stripe.checkout.sessions.expire(s.id)
    } catch { /* stale or foreign id — nothing to expire */ }
  }

  // Snapshot before delete. Best-effort: a missing audit table must not
  // block the removal the admin asked for.
  try {
    await svc.from('audit_log').insert({
      organisation_id: orgId,
      user_id: user.id,
      action: 'camp_booking.removed',
      entity_type: 'camp_booking',
      entity_id: bookingId,
      details: { camp_id: campId, snapshot: booking },
    })
  } catch { /* ignore */ }

  const { error } = await svc.from('camp_bookings').delete().eq('id', bookingId).eq('payment_status', 'pending')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
