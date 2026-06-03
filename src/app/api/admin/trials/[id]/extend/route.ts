import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Admin: extend a trial_bookings row by setting a new preferred_date.
 *
 * Body: { newDate: 'YYYY-MM-DD' }
 *
 * DB-only. No Stripe, no email, no cron. Updates:
 *   • preferred_date     ← body.newDate
 *   • status             ← back to 'pending' if currently 'attended'
 *                          / 'no_show' / 'cancelled' (so the row re-enters
 *                          the pending queue and is treated as a future
 *                          booking by deriveTrialStageFromBooking)
 *   • updated_at         ← now()
 *
 * The reset-to-pending behaviour is the lightest-touch way to make the
 * row re-enter the upcoming/today cohort. Without it, an attended-but-
 * extended trial would still derive to awaiting_followup (the past) until
 * the new date arrived.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bookingId } = await params
  const body = await req.json().catch(() => ({})) as { newDate?: string }
  const newDate = (body.newDate || '').trim()
  // Strict YYYY-MM-DD shape — reject anything else.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    return NextResponse.json({ ok: false, error: 'newDate must be YYYY-MM-DD' }, { status: 400 })
  }
  // Defensive: reject dates more than 2 years out (typo guard).
  const newMs = Date.parse(newDate + 'T00:00:00Z')
  if (isNaN(newMs)) {
    return NextResponse.json({ ok: false, error: 'newDate is not a valid calendar date' }, { status: 400 })
  }
  const twoYears = 2 * 365 * 86_400_000
  if (newMs > Date.now() + twoYears) {
    return NextResponse.json({ ok: false, error: 'newDate is too far in the future' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }
  const myOrgId = me.organisation_id as string

  const { data: booking } = await supabase
    .from('trial_bookings')
    .select('id, organisation_id, status, converted')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking || booking.organisation_id !== myOrgId) {
    return NextResponse.json({ ok: false, error: 'Trial booking not found' }, { status: 404 })
  }
  if (booking.converted === true) {
    // Can't extend a converted booking — that's a terminal state.
    return NextResponse.json({ ok: false, error: 'Cannot extend a converted booking' }, { status: 400 })
  }

  // If the row had advanced past 'pending' / 'confirmed', reset so the
  // derive layer puts it back into upcoming/today.
  const currentStatus = (booking.status || '').toLowerCase()
  const shouldResetStatus = currentStatus !== 'pending' && currentStatus !== 'confirmed'

  const update: Record<string, unknown> = {
    preferred_date: newDate,
    updated_at: new Date().toISOString(),
  }
  if (shouldResetStatus) update.status = 'pending'

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await service.from('trial_bookings').update(update).eq('id', bookingId)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, newDate, statusReset: shouldResetStatus })
}
