import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Admin: mark a trial_bookings row as converted.
 *
 * DB-only. No Stripe, no checkout, no subscription creation, no email,
 * no webhook, no cron.
 *
 * Effects (within `trial_bookings` only):
 *   • converted          ← true
 *   • status             ← 'attended' (only when the row was 'pending' or
 *                          'confirmed'; we do NOT downgrade 'attended' or
 *                          override terminal 'cancelled'/'no_show')
 *   • updated_at         ← now()
 *
 * Deep-linking the admin to the existing paid signup flow is a UI concern;
 * the caller redirects after the API returns ok=true. This endpoint does
 * not create or modify any subscription / Stripe state.
 *
 * Mirrors the existing /api/admin/enrolments/[id]/* pattern:
 *   - server-side auth check (admin only)
 *   - explicit org match before any mutation
 *   - service-role client for the actual UPDATE
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
    // Idempotent — already converted, nothing to do.
    return NextResponse.json({ ok: true, alreadyConverted: true })
  }

  // Status: only auto-bump pending/confirmed → attended. Never touch
  // 'attended', 'cancelled', or 'no_show'.
  const currentStatus = (booking.status || '').toLowerCase()
  const shouldBumpStatus = currentStatus === 'pending' || currentStatus === 'confirmed'

  const update: Record<string, unknown> = {
    converted: true,
    updated_at: new Date().toISOString(),
  }
  if (shouldBumpStatus) update.status = 'attended'

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await service.from('trial_bookings').update(update).eq('id', bookingId)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, statusBumped: shouldBumpStatus })
}
