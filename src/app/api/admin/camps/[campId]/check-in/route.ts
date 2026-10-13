import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isUuid } from '@/lib/camp-waitlist'
import { CHECKED_IN_ACTION, CHECK_IN_UNDONE_ACTION, datesBetween } from '@/lib/camp-checkin'

export const dynamic = 'force-dynamic'

/**
 * Academy admin or coach: tick a child in (or untick them) for one camp day.
 * POST { bookingId, dayId, in: boolean }   a camp sold by the day
 * POST { bookingId, date, in: boolean }    a whole-week camp, which has no day rows
 *
 * Changes nothing about the booking, its days or its payment. It records the
 * press in the academy's audit log; see src/lib/camp-checkin.ts.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ campId: string }> }) {
  const { campId } = await ctx.params
  const body = (await request.json().catch(() => ({}))) as { bookingId?: string; dayId?: string; date?: string; in?: boolean }
  const byDate = !body.dayId && typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
  if (!isUuid(campId) || !isUuid(body.bookingId) || (!byDate && !isUuid(body.dayId)) || typeof body.in !== 'boolean') {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!me || !['admin', 'coach'].includes(me.role as string)) return NextResponse.json({ error: 'Only academy staff can tick children in' }, { status: 403 })

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [{ data: camp }, { data: booking }, { data: day }] = await Promise.all([
    db.from('camps').select('id, organisation_id, start_date, end_date').eq('id', campId).maybeSingle(),
    db.from('camp_bookings').select('id, camp_id, child_name').eq('id', body.bookingId).maybeSingle(),
    byDate ? Promise.resolve({ data: null }) : db.from('camp_days').select('id, camp_id, date').eq('id', body.dayId).maybeSingle(),
  ])
  if (!camp || camp.organisation_id !== me.organisation_id) return NextResponse.json({ error: 'Camp not found' }, { status: 404 })
  if (!booking || booking.camp_id !== campId) return NextResponse.json({ error: 'That child isn’t on this camp' }, { status: 404 })
  if (byDate) {
    if (!datesBetween(camp.start_date as string | null, camp.end_date as string | null).includes(body.date!)) return NextResponse.json({ error: 'That date isn’t one of this camp’s days' }, { status: 400 })
  } else if (!day || day.camp_id !== campId) {
    return NextResponse.json({ error: 'That child isn’t on this camp' }, { status: 404 })
  }

  const { error } = await db.from('audit_log').insert({
    organisation_id: camp.organisation_id,
    user_id: user.id,
    action: body.in ? CHECKED_IN_ACTION : CHECK_IN_UNDONE_ACTION,
    entity_type: 'camp_booking',
    entity_id: booking.id,
    details: byDate
      ? { camp_id: campId, date: body.date, child_name: booking.child_name }
      : { camp_id: campId, camp_day_id: day!.id, date: day!.date, child_name: booking.child_name },
  })
  if (error) {
    console.error('[camp-check-in] could not save', error.message)
    return NextResponse.json({ error: 'That didn’t save. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, in: body.in })
}
