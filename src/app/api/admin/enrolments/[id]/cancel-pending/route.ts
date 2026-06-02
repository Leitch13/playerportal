import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Admin: cancel a Stage 3 pending enrolment BEFORE its scheduled activation.
 *
 * DB-only — no Stripe call. The matching scheduled subscription has only a
 * SetupIntent (no recurring sub created yet), so cancelling the local rows
 * is sufficient. The SetupIntent will expire on its own (~30 days). The
 * existing cron's idempotency means even if it later sees the row, the
 * status check at /api/cron/activate-scheduled-subs prevents re-activation
 * (status changed from 'scheduled' → 'cancelled').
 *
 * No emails are sent — this is an internal admin action. If the parent
 * needs to be notified, do it separately via the Messages page.
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
    .select('id, player_id, group_id, organisation_id, status')
    .eq('id', enrolmentId)
    .maybeSingle()
  if (!enrolment || enrolment.organisation_id !== myOrgId) {
    return NextResponse.json({ ok: false, error: 'Enrolment not found' }, { status: 404 })
  }
  if (enrolment.status !== 'pending') {
    return NextResponse.json({ ok: false, error: `Cannot cancel enrolment in status '${enrolment.status}'` }, { status: 400 })
  }

  // Use service role for the writes so RLS-protected admin paths work
  // consistently with the activation helper.
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Flip both: scheduled sub → cancelled, pending enrolment → cancelled.
  const [{ error: subErr }, { error: enrolErr }] = await Promise.all([
    service
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('player_id', enrolment.player_id)
      .eq('training_group_id', enrolment.group_id)
      .eq('status', 'scheduled'),
    service.from('enrolments').update({ status: 'cancelled' }).eq('id', enrolmentId),
  ])

  if (subErr || enrolErr) {
    return NextResponse.json(
      { ok: false, error: subErr?.message || enrolErr?.message },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
