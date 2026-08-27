import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, sendEmailBatch } from '@/lib/email'
import { trialConversionEmail } from '@/lib/email-templates'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  // Find trials attended 1-3 days ago that haven't received a CONVERSION
  // OFFER (independent of the day-1 follow-up email).
  //
  // Trial Conversion 1A — Phase 1: this filter previously gated on
  // followup_sent=false, which collided with /api/cron/trial-followup
  // (which also gates + sets followup_sent). Once the day-1 cron ran,
  // this cron would skip the same trial entirely, so the discount offer
  // never sent. We now use conversion_offer_sent (column from migration
  // 039, defaults false) so both crons can fire independently for the
  // same trial. Each cron is still individually idempotent.
  // Window on WHEN THE TRIAL WAS MARKED ATTENDED (updated_at), not
  // preferred_date: in production every attended trial has preferred_date
  // NULL (the booking flow doesn't reliably set it), so the old date-window
  // matched nothing — the cron ran green daily and emailed nobody (9/9
  // attended trials, zero offers ever sent). 1-day lower gap so the day-1
  // follow-up always lands first; 14-day lookback so warm-but-unactioned
  // trials still get the invitation instead of being dropped forever.
  const now = new Date()
  const lookbackStart = new Date(now.getTime() - 14 * 86_400_000).toISOString()
  const upperBound = new Date(now.getTime() - 1 * 86_400_000).toISOString()

  const { data: trials, error: trialsError } = await supabase
    .from('trial_bookings')
    .select(
      'id, parent_name, parent_email, child_name, organisation_id, training_group:training_groups(name), organisation:organisations(name, slug)'
    )
    .eq('status', 'attended')
    .eq('conversion_offer_sent', false)
    .gte('updated_at', lookbackStart)
    .lte('updated_at', upperBound)

  if (trialsError) {
    return NextResponse.json({ error: 'Failed to fetch trials' }, { status: 500 })
  }

  const jobs: Parameters<typeof sendEmail>[0][] = []

  // One offer per parent even when a child has duplicate attended rows
  // (real case in prod: the same trial recorded twice).
  const seenEmails = new Set<string>()

  for (const trial of trials || []) {
    if (!trial.parent_email) continue
    const emailKey = trial.parent_email.toLowerCase()
    if (seenEmails.has(emailKey)) continue
    seenEmails.add(emailKey)

    const group = trial.training_group as unknown as { name: string } | null
    const org = trial.organisation as unknown as { name: string; slug: string | null } | null

    const slug = org?.slug || trial.organisation_id || ''
    // Trial Conversion 1A — Phase 2 + 3: append trial+email for attribution.
    // Personalisation: signup form can pre-fill from `email`; webhook
    // auto-link uses `trial` as the primary match key (via the
    // trial_signup_attributions table written when the parent loads the
    // /book/[slug] page).
    //
    // NO `discount` param: the platform does not offer money off an
    // academy's classes on their behalf. See trialConversionEmail.
    const signupUrl = `${appUrl}/book/${slug}?trial=${trial.id}&email=${encodeURIComponent(trial.parent_email)}`

    const template = trialConversionEmail({
      parentName: trial.parent_name?.split(' ')[0] || 'there',
      childName: trial.child_name,
      academyName: org?.name || 'the academy',
      className: group?.name || 'the class',
      signupUrl,
    })

    jobs.push({ to: trial.parent_email, ...template })

    // Trial Conversion 1A — Phase 1: DO NOT set followup_sent here.
    // followup_sent belongs exclusively to the day-1 cron now.
    await supabase
      .from('trial_bookings')
      .update({ conversion_offer_sent: true })
      .eq('id', trial.id)
  }

  const { sent, failed: errors } = await sendEmailBatch(jobs)

  return NextResponse.json({
    sent,
    errors,
    trialsChecked: (trials || []).length,
  })
}
