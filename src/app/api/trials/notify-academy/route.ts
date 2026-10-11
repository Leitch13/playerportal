/**
 * P1.1 — Academy notification when a parent books a free trial.
 *
 * Fire-and-forget endpoint invoked by TrialForm.tsx immediately after the
 * anon INSERT into trial_bookings.  Form passes the resolving tuple
 * (organisation_id, parent_email, child_name); we look up the matching
 * trial via service role (avoids the SELECT-after-INSERT RLS trap that
 * anon clients hit), fan out one bell notification per org admin, and
 * send one email to the org's contact_email.
 *
 * Reused helpers:
 *   - Wave 1B / B1b: NOTIFICATIONS_SCHEMA_FIX_ENABLED flag (already ON in
 *     prod, both server + NEXT_PUBLIC_*).  Real column is `user_id`.
 *   - notifyNewAcademy admin-email pattern: contact_email →
 *     ADMIN_NOTIFICATION_EMAIL → johnleitch970@gmail.com fallback chain.
 *   - sendEmail() Resend wrapper.
 *
 * Flag: TRIAL_ACADEMY_NOTIFY_ENABLED.  When 'false' the route returns
 * { ok: true, disabled: true } and writes nothing — one env flip rollback.
 *
 * Auth: none.  Public-anon callable (the trial booking flow itself is
 * anon).  Idempotency-by-correlation: the trial lookup window is a 60s
 * recency check against the (organisation_id, parent_email, child_name)
 * tuple — duplicate calls within 60s would resolve to the same trial and
 * write duplicate notifications, so the caller (TrialForm) only fires
 * once after a successful insert.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { alertAcademyOfTrial } from '@/lib/trial-alerts'

export const dynamic = 'force-dynamic'

const TRIAL_ACADEMY_NOTIFY_ENABLED =
  process.env.TRIAL_ACADEMY_NOTIFY_ENABLED === 'true'

export async function POST(request: NextRequest) {
  if (!TRIAL_ACADEMY_NOTIFY_ENABLED) {
    return NextResponse.json({ ok: true, disabled: true })
  }

  let body: { organisation_id?: string; parent_email?: string; child_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { organisation_id, parent_email, child_name } = body
  if (!organisation_id || !parent_email || !child_name) {
    return NextResponse.json(
      { error: 'organisation_id, parent_email and child_name are required' },
      { status: 400 }
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── Resolve the freshly-inserted trial within the last 60 seconds.
  // Matches the (org, parent_email, child_name) tuple; if the same parent
  // booked the same child twice in the last 60s we take the most recent.
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString()
  const { data: trial, error: trialErr } = await supabase
    .from('trial_bookings')
    .select(
      'id'
    )
    .eq('organisation_id', organisation_id)
    .eq('parent_email', parent_email)
    .eq('child_name', child_name)
    .gte('created_at', sixtySecondsAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (trialErr || !trial) {
    // The form fires this before the row could be visible (race) or the
    // row was deleted.  Either way, nothing to do — surface a soft 404 so
    // the fire-and-forget caller can log it but still treat the user
    // experience as successful.
    return NextResponse.json(
      { ok: false, error: 'Trial not found within recency window' },
      { status: 404 }
    )
  }

  // One place tells the academy about a trial, free or paid, and writes down
  // that it did: src/lib/trial-alerts.ts. Canary 17 checks every trial has that record.
  const alerted = await alertAcademyOfTrial(supabase, trial.id as string)

  return NextResponse.json({
    ok: alerted.ok,
    trialId: trial.id,
    notificationsInserted: alerted.notifications,
    emailSent: alerted.emailSent,
    already: alerted.already,
  })
}
