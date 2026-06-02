import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Admin: end a trial enrolment. DB-only — flips enrolment to 'cancelled'.
 *
 * No Stripe call required: trials in this app are tracked via
 * `enrolments.is_trial = true` + `trial_expires_at`. There is no Stripe
 * subscription tied to a trial enrolment (those are separate paid signups),
 * so ending a trial does not touch billing.
 *
 * If the academy wants to convert this parent to a paid plan, they should
 * use the booking flow (linked from the Enrolments page "Convert to paid"
 * action). This endpoint is only the "we won't continue" path.
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
  if (enrolment.status !== 'active' && enrolment.status !== 'pending') {
    return NextResponse.json({ ok: false, error: `Trial already in status '${enrolment.status}'` }, { status: 400 })
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
