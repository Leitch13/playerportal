import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, sendEmailBatch } from '@/lib/email'
import { trialConversionEmail } from '@/lib/email-templates'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function generateDiscountCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'TRIAL-'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

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
  const now = new Date()
  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const oneDayAgo = new Date(now)
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const { data: trials, error: trialsError } = await supabase
    .from('trial_bookings')
    .select(
      'id, parent_name, parent_email, child_name, organisation_id, training_group:training_groups(name), organisation:organisations(name, slug)'
    )
    .eq('status', 'attended')
    .eq('conversion_offer_sent', false)
    .gte('preferred_date', threeDaysAgo.toISOString().split('T')[0])
    .lte('preferred_date', oneDayAgo.toISOString().split('T')[0])

  if (trialsError) {
    return NextResponse.json({ error: 'Failed to fetch trials' }, { status: 500 })
  }

  const jobs: Parameters<typeof sendEmail>[0][] = []

  for (const trial of trials || []) {
    if (!trial.parent_email) continue

    const group = trial.training_group as unknown as { name: string } | null
    const org = trial.organisation as unknown as { name: string; slug: string | null } | null

    const discountCode = generateDiscountCode()
    const slug = org?.slug || trial.organisation_id || ''
    // Trial Conversion 1A — Phase 2 + 3: append trial+email for attribution.
    // Personalisation: signup form can pre-fill from `email`; webhook
    // auto-link uses `trial` as the primary match key (via the
    // trial_signup_attributions table written when the parent loads the
    // /book/[slug] page).
    const signupUrl = `${appUrl}/book/${slug}?discount=${discountCode}&trial=${trial.id}&email=${encodeURIComponent(trial.parent_email)}`

    const template = trialConversionEmail({
      parentName: trial.parent_name?.split(' ')[0] || 'there',
      childName: trial.child_name,
      academyName: org?.name || 'the academy',
      className: group?.name || 'the class',
      discountCode,
      signupUrl,
    })

    jobs.push({ to: trial.parent_email, ...template })

    // Trial Conversion 1A — Phase 1: DO NOT set followup_sent here.
    // followup_sent belongs exclusively to the day-1 cron now.
    await supabase
      .from('trial_bookings')
      .update({
        conversion_offer_sent: true,
        discount_code: discountCode,
      })
      .eq('id', trial.id)
  }

  const { sent, failed: errors } = await sendEmailBatch(jobs)

  return NextResponse.json({
    sent,
    errors,
    trialsChecked: (trials || []).length,
  })
}
