import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { trialConversionEmail } from '@/lib/email-templates'

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

  // Find trials attended 1-3 days ago that haven't received a follow-up
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
    .eq('followup_sent', false)
    .gte('preferred_date', threeDaysAgo.toISOString().split('T')[0])
    .lte('preferred_date', oneDayAgo.toISOString().split('T')[0])

  if (trialsError) {
    console.error('[TRIAL CONVERSION] Error fetching trials:', trialsError)
    return NextResponse.json({ error: 'Failed to fetch trials' }, { status: 500 })
  }

  let sent = 0
  let errors = 0

  for (const trial of trials || []) {
    if (!trial.parent_email) continue

    const group = trial.training_group as unknown as { name: string } | null
    const org = trial.organisation as unknown as { name: string; slug: string | null } | null

    const discountCode = generateDiscountCode()
    const slug = org?.slug || trial.organisation_id || ''
    const signupUrl = `${appUrl}/book/${slug}?discount=${discountCode}`

    const template = trialConversionEmail({
      parentName: trial.parent_name?.split(' ')[0] || 'there',
      childName: trial.child_name,
      academyName: org?.name || 'the academy',
      className: group?.name || 'the class',
      discountCode,
      signupUrl,
    })

    const result = await sendEmail({ to: trial.parent_email, ...template })
    if (result.success) {
      await supabase
        .from('trial_bookings')
        .update({
          followup_sent: true,
          conversion_offer_sent: true,
          discount_code: discountCode,
        })
        .eq('id', trial.id)
      sent++
    } else {
      errors++
    }
  }

  return NextResponse.json({
    sent,
    errors,
    trialsChecked: (trials || []).length,
  })
}
