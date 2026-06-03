import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Admin: mark a trial enrolment as lost (status='cancelled').
 *
 * DB-only. Equivalent semantics to /api/admin/enrolments/[id]/end-trial
 * (also flips status → 'cancelled'); kept as a distinct endpoint so the
 * Trial Follow-up surfaces have a uniform URL shape with the booking-
 * source mark-lost path.
 *
 * Effects:
 *   • status  ← 'cancelled'
 *
 * No Stripe, no email, no cron. Trials are never tied to a recurring
 * Stripe subscription.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: enrolmentId } = await params

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

  const { data: enrolment } = await supabase
    .from('enrolments')
    .select('id, organisation_id, status, is_trial')
    .eq('id', enrolmentId)
    .maybeSingle()
  if (!enrolment || enrolment.organisation_id !== myOrgId) {
    return NextResponse.json({ ok: false, error: 'Enrolment not found' }, { status: 404 })
  }
  if (!enrolment.is_trial) {
    return NextResponse.json({ ok: false, error: 'Not a trial enrolment' }, { status: 400 })
  }
  if (enrolment.status === 'cancelled') {
    return NextResponse.json({ ok: true, alreadyCancelled: true })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await service.from('enrolments').update({ status: 'cancelled' }).eq('id', enrolmentId)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
