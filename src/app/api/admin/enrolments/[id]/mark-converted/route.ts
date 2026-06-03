import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Admin: mark a trial enrolment (enrolments.is_trial = true) as converted.
 *
 * DB-only. No Stripe, no checkout, no subscription creation, no email,
 * no webhook, no cron. The trial flag is flipped only.
 *
 * Effects:
 *   • is_trial          ← false
 *   • trial_expires_at  ← unchanged (kept as audit breadcrumb)
 *
 * The caller (TrialManager / Enrolments page) is expected to redirect the
 * admin to the existing paid signup flow after this returns ok=true.
 * Existing signup flow remains unchanged. No subscription rows are
 * created here.
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
  if (enrolment.is_trial === false) {
    return NextResponse.json({ ok: true, alreadyConverted: true })
  }
  if (enrolment.status === 'cancelled') {
    return NextResponse.json({ ok: false, error: 'Cannot convert a cancelled enrolment' }, { status: 400 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await service
    .from('enrolments')
    .update({ is_trial: false })
    .eq('id', enrolmentId)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
