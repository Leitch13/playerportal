import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Admin: extend a trial enrolment's expiry by N days (default 14).
 *
 * Body: { days?: number }   — defaults to 14, clamped to [1, 60].
 *
 * DB-only. No Stripe, no email, no cron. Updates:
 *   • trial_expires_at  ← max(current_expiry, today) + days
 *
 * The `max(current_expiry, today)` clamp matters: if the trial has
 * already expired, extending by 14 days should land 14 days in the
 * FUTURE — not 14 days after the past expiry date (which might still
 * be in the past).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: enrolmentId } = await params
  const body = await req.json().catch(() => ({})) as { days?: number }
  const raw = Number(body.days ?? 14)
  if (!Number.isFinite(raw) || raw < 1 || raw > 60) {
    return NextResponse.json({ ok: false, error: 'days must be between 1 and 60' }, { status: 400 })
  }
  const days = Math.floor(raw)

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
    .select('id, organisation_id, status, is_trial, trial_expires_at')
    .eq('id', enrolmentId)
    .maybeSingle()
  if (!enrolment || enrolment.organisation_id !== myOrgId) {
    return NextResponse.json({ ok: false, error: 'Enrolment not found' }, { status: 404 })
  }
  if (!enrolment.is_trial) {
    return NextResponse.json({ ok: false, error: 'Not a trial enrolment' }, { status: 400 })
  }
  if (enrolment.status !== 'active' && enrolment.status !== 'pending') {
    return NextResponse.json({ ok: false, error: `Cannot extend a trial in status '${enrolment.status}'` }, { status: 400 })
  }

  // Compute the new expiry: anchor at max(existing, today) so an already-
  // expired trial gets a full +days window from now, not from the past.
  const todayUtc = (() => {
    const d = new Date()
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  })()
  let anchorMs = todayUtc
  if (enrolment.trial_expires_at) {
    // trial_expires_at is TIMESTAMPTZ — parse the timestamp directly if it
    // already carries a time component; otherwise anchor at UTC midnight.
    const raw: string = enrolment.trial_expires_at
    const ms = Date.parse(/[T ]/.test(raw) ? raw : raw + 'T00:00:00Z')
    if (!isNaN(ms) && ms > anchorMs) anchorMs = ms
  }
  const newExpiryMs = anchorMs + days * 86_400_000
  const newExpiryIso = new Date(newExpiryMs).toISOString().slice(0, 10)

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await service
    .from('enrolments')
    .update({ trial_expires_at: newExpiryIso })
    .eq('id', enrolmentId)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, newExpiry: newExpiryIso, days })
}
