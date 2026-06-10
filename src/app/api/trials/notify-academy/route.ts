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
import { sendEmail } from '@/lib/email'
import { newTrialBookingAdminEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

// Real notifications column is `user_id` (migration-confirmed). The
// hotfix-era version flag-gated this behind NOTIFICATIONS_SCHEMA_FIX_ENABLED;
// on this lineage every notification write path uses user_id unconditionally,
// so the gate is dropped (Batch 1 / 4e adaptation).
const NOTIF_USER_COL = 'user_id' as const

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
      'id, organisation_id, training_group_id, parent_name, parent_email, parent_phone, child_name, child_age, preferred_date, notes, created_at, training_group:training_groups(name), organisation:organisations(name, contact_email)'
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

  const group = trial.training_group as unknown as { name: string } | null
  const org = trial.organisation as unknown as { name: string; contact_email: string | null } | null
  const academyName = org?.name || 'your academy'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
  const dashboardUrl = `${appUrl}/dashboard/trials`

  // ── Bell notifications: one row per admin profile in the org.
  // Coaches deliberately excluded — owners need to be paged on new
  // bookings, coaches get the existing in-session trial-guest view.
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('organisation_id', organisation_id)
    .eq('role', 'admin')

  let notificationsInserted = 0
  if (admins && admins.length > 0) {
    const notifRows = admins.map((a) => ({
      [NOTIF_USER_COL]: a.id,
      organisation_id,
      type: 'new_trial',
      title: `New trial: ${trial.child_name}`,
      body: `${trial.parent_name} booked a free trial${group?.name ? ` for ${group.name}` : ''}${
        trial.preferred_date ? ` — ${trial.preferred_date}` : ''
      }.`,
      link: '/dashboard/trials',
    }))
    const { error: notifErr, count } = await supabase
      .from('notifications')
      .insert(notifRows, { count: 'exact' })
    if (!notifErr) notificationsInserted = count ?? notifRows.length
  }

  // ── Admin email: one send, to the org owner.
  // Recipient chain mirrors notifyNewAcademy() in /api/onboard:
  //   org.contact_email → env.ADMIN_NOTIFICATION_EMAIL → hardcoded fallback.
  const recipient =
    org?.contact_email ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    'johnleitch970@gmail.com'

  const formattedDate = trial.preferred_date
    ? new Date(trial.preferred_date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : null

  const template = newTrialBookingAdminEmail({
    academyName,
    parentName: trial.parent_name,
    parentEmail: trial.parent_email,
    parentPhone: trial.parent_phone,
    childName: trial.child_name,
    childAge: trial.child_age,
    className: group?.name ?? null,
    preferredDate: formattedDate,
    notes: trial.notes,
    dashboardUrl,
  })
  const emailResult = await sendEmail({ to: recipient, ...template })

  return NextResponse.json({
    ok: true,
    trialId: trial.id,
    notificationsInserted,
    emailRecipient: recipient,
    emailSent: emailResult.success,
  })
}
