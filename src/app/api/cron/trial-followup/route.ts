import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { trialFollowUpEmail } from '@/lib/email-templates'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * Daily cron: send the "How was the trial?" follow-up to parents whose
 * child attended yesterday.
 *
 * P3 Trial Funnel Reliability fix:
 *   - Filter by `followup_sent = false` so we never double-send.
 *   - After a successful send, set `followup_sent = true` on that row.
 *
 * Previously the cron only sent (it never wrote the flag), which meant
 * the same parent could receive the email on overlapping windows, and
 * the downstream trial-conversion cron — which filters on
 * `followup_sent = false` — never advanced its cohort.
 *
 * Behaviour unchanged otherwise: same Resend template, same
 * yesterday-window filter on updated_at.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'

  // Find trial bookings from yesterday with status 'attended' that haven't
  // already received the follow-up.
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStart = yesterday.toISOString().split('T')[0] + 'T00:00:00.000Z'
  const yesterdayEnd = yesterday.toISOString().split('T')[0] + 'T23:59:59.999Z'

  const { data: trials, error: trialsError } = await supabase
    .from('trial_bookings')
    .select('id, parent_name, parent_email, child_name, followup_sent, training_group:training_groups(name), organisation:organisations(name, slug)')
    .eq('status', 'attended')
    .eq('followup_sent', false)
    .gte('updated_at', yesterdayStart)
    .lte('updated_at', yesterdayEnd)

  if (trialsError) {
    return NextResponse.json({ error: 'Failed to fetch trials' }, { status: 500 })
  }

  let sent = 0
  let failed = 0
  let flagged = 0

  for (const trial of trials || []) {
    if (!trial.parent_email) continue

    const group = trial.training_group as unknown as { name: string } | null
    // P1.4 — booking page is routed by slug, not UUID.  Before this fix
    // every CTA in trialFollowUpEmail linked to `/book/<uuid>` (404).
    const org = trial.organisation as unknown as { name: string; slug: string } | null

    // Trial Conversion 1A — Phase 2 + 3: append trial+email for
    // attribution. The webhook auto-link uses `trial` as the primary
    // match key (via trial_signup_attributions written by the booking
    // page when the parent clicks through).
    const personalisedSignupUrl = trial.parent_email
      ? `${appUrl}/book/${org?.slug || ''}?trial=${trial.id}&email=${encodeURIComponent(trial.parent_email)}`
      : `${appUrl}/book/${org?.slug || ''}`

    const template = trialFollowUpEmail({
      parentName: trial.parent_name?.split(' ')[0] || 'there',
      childName: trial.child_name,
      academyName: org?.name || 'the academy',
      signupUrl: personalisedSignupUrl,
      className: group?.name || 'the class',
    })

    const result = await sendEmail({ to: trial.parent_email, ...template })
    if (result.success) {
      sent++
      // Flip the flag so the same trial isn't re-emailed on the next run.
      // Use service-role client (created above) so the update bypasses RLS.
      // We do NOT bump updated_at — leaving it at the attendance timestamp
      // keeps the cron's yesterday-window filter correct for retries within
      // the same day if this row was somehow missed.
      const { error: flagErr } = await supabase
        .from('trial_bookings')
        .update({ followup_sent: true })
        .eq('id', trial.id)
      if (!flagErr) flagged++
    } else {
      failed++
    }
  }

  return NextResponse.json({
    sent,
    failed,
    flagged,
    trialsChecked: (trials || []).length,
  })
}
