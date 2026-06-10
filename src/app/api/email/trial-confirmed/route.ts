/**
 * P1.3 — Trial confirmation email to the parent.
 *
 * Fire-and-forget endpoint invoked by TrialManager's `updateStatus` when
 * the admin clicks Confirm.  The status UPDATE already happened on the
 * client; this route exists purely to send the parent an email (and a
 * bell notification when the parent has an account on the platform).
 *
 * Auth: admin/coach via supabase.rpc('get_my_role') — same pattern as
 * /api/trials/nudge.  Anon or parent-role callers get 401.
 *
 * Idempotency: belt-and-braces — read `trial.confirmed_at`.  If it is
 * older than 60 seconds, treat the call as a no-op duplicate (admin
 * double-click, network retry, browser back/forward) and return
 * { ok: true, alreadyConfirmed: true } without sending another email.
 * If `confirmed_at` is within the last 60 seconds, this is the genuine
 * Confirm event — proceed.
 *
 * Reused helpers:
 *   - get_my_role RPC (auth gate)
 *   - sendEmail() (Resend wrapper)
 *   - baseLayout() inside trialConfirmedEmail template
 *   - Wave 1B / B1b: NOTIFICATIONS_SCHEMA_FIX_ENABLED flag (already ON
 *     in prod) — real notifications column is `user_id`.
 *
 * Flag: TRIAL_CONFIRMED_EMAIL_ENABLED.  When 'false' the route returns
 * { ok: true, disabled: true } and writes nothing.  One env flip rollback.
 *
 * Touches no protected systems:
 *   - status / confirmed_at UPDATE is the existing client path, unchanged
 *   - this route is read-only on trial_bookings (no UPDATE here)
 *   - bell notification insert is conditional on trial.parent_id existing
 *   - no Stripe, webhooks, payments, enrolments, attendance, schema, RLS
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { trialConfirmedEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

// Wave 1B / B1b imports kept in case a future schema change introduces a
// parent_id on trial_bookings — see comment in the trial SELECT below.
// Unused at present (no bell notification branch).
//   const NOTIFICATIONS_SCHEMA_FIX_ON = process.env.NOTIFICATIONS_SCHEMA_FIX_ENABLED === 'true'
//   const NOTIF_USER_COL = NOTIFICATIONS_SCHEMA_FIX_ON ? 'user_id' : 'profile_id'

const TRIAL_CONFIRMED_EMAIL_ENABLED =
  process.env.TRIAL_CONFIRMED_EMAIL_ENABLED === 'true'

const IDEMPOTENCY_WINDOW_MS = 60_000

export async function POST(request: NextRequest) {
  // ── Auth FIRST.  Even with the flag OFF an unauthenticated caller must
  // never get a 200 — the route exists to act on a trial booking that
  // only an admin/coach in that org should be able to read.  Order:
  // auth → flag → work.
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role as string)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (!TRIAL_CONFIRMED_EMAIL_ENABLED) {
    return NextResponse.json({ ok: true, disabled: true })
  }

  let body: { trialId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { trialId } = body
  if (!trialId) {
    return NextResponse.json({ error: 'trialId is required' }, { status: 400 })
  }

  // ── Read the trial.  RLS scope already restricts the admin/coach to
  // their own org's rows, so a cross-org trialId returns nothing.
  // NOTE: trial_bookings has NO parent_id column — confirmed via live
  // schema introspection.  The audit basis (assumed Task #177 populated
  // it) was wrong; #177 updates `subscriptions`, not the trial row.
  // Therefore no bell-notification branch — email-only.
  const { data: trial, error: trialErr } = await supabase
    .from('trial_bookings')
    .select(
      'id, organisation_id, parent_name, parent_email, child_name, status, confirmed_at, preferred_date, training_group:training_groups(name, day_of_week, time_slot, location), organisation:organisations(name)'
    )
    .eq('id', trialId)
    .maybeSingle()

  if (trialErr || !trial) {
    return NextResponse.json({ error: 'Trial not found' }, { status: 404 })
  }
  if (!trial.parent_email) {
    return NextResponse.json({ error: 'Trial has no parent_email' }, { status: 400 })
  }

  // ── Idempotency.  TrialManager's UPDATE just set status='confirmed' and
  // confirmed_at=now(); we expect confirmed_at to be within the last 60s
  // for the genuine event.  An older confirmed_at means we've already
  // handled this confirm (or status was flipped manually some time ago).
  if (trial.status !== 'confirmed') {
    // The client did an optimistic fire-and-forget but the server hasn't
    // seen the status flip yet (read replica lag, or the UPDATE failed
    // entirely).  Soft no-op so a stale call doesn't email the parent
    // for a non-confirmed trial.
    return NextResponse.json({ ok: true, statusNotConfirmed: true })
  }
  if (trial.confirmed_at) {
    const ageMs = Date.now() - new Date(trial.confirmed_at).getTime()
    if (ageMs > IDEMPOTENCY_WINDOW_MS) {
      return NextResponse.json({ ok: true, alreadyConfirmed: true, confirmedAtAgeMs: ageMs })
    }
  }

  const group = trial.training_group as unknown as {
    name: string | null
    day_of_week: string | null
    time_slot: string | null
    location: string | null
  } | null
  const org = trial.organisation as unknown as { name: string | null } | null
  const academyName = org?.name || 'the academy'

  const dayTime =
    group?.day_of_week || group?.time_slot
      ? `${group?.day_of_week || ''}${group?.day_of_week && group?.time_slot ? ' ' : ''}${group?.time_slot || ''}`.trim()
      : null
  const preferredDateFormatted = trial.preferred_date
    ? new Date(trial.preferred_date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  const template = trialConfirmedEmail({
    parentName: trial.parent_name?.split(' ')[0] || 'there',
    childName: trial.child_name,
    academyName,
    className: group?.name ?? null,
    dayTime,
    location: group?.location ?? null,
    preferredDate: preferredDateFormatted,
    dashboardUrl: `${appUrl}/dashboard`,
  })

  const emailResult = await sendEmail({ to: trial.parent_email, ...template })

  // No bell notification — trial_bookings has no parent_id column to
  // target a user with.  Email-only path.  If a later schema change
  // wires up a parent_id (e.g. a dedicated trial → parent profile link),
  // re-add the notification insert here gated on that field.

  return NextResponse.json({
    ok: true,
    trialId: trial.id,
    emailSent: emailResult.success,
    notificationsInserted: 0,
  })
}
