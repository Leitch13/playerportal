import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Admin: mark a trial_bookings row as lost (status='cancelled').
 *
 * DB-only. No Stripe, no email, no cron. Updates:
 *   • status      ← 'cancelled'
 *   • updated_at  ← now()
 *
 * Mirrors the existing per-row "Cancel" behaviour already in
 * TrialManager.updateStatus(id, 'cancelled') but exposed as a dedicated
 * endpoint so the Trial Follow-up surfaces share a single contract with
 * the enrolment-source mark-lost path.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bookingId } = await params

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
    return NextResponse.json({ ok: false, error: 'Cannot mark a converted booking as lost' }, { status: 400 })
  }
  if ((booking.status || '').toLowerCase() === 'cancelled') {
    // Idempotent.
    return NextResponse.json({ ok: true, alreadyCancelled: true })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await service
    .from('trial_bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', bookingId)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
