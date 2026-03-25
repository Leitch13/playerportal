import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { trialFollowUpEmail } from '@/lib/email-templates'

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'

  // Find trial bookings from yesterday with status 'attended'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStart = yesterday.toISOString().split('T')[0] + 'T00:00:00.000Z'
  const yesterdayEnd = yesterday.toISOString().split('T')[0] + 'T23:59:59.999Z'

  const { data: trials, error: trialsError } = await supabase
    .from('trial_bookings')
    .select('id, parent_name, parent_email, child_name, training_group:training_groups(name), organisation:organisations(name, id)')
    .eq('status', 'attended')
    .gte('updated_at', yesterdayStart)
    .lte('updated_at', yesterdayEnd)

  if (trialsError) {
    console.error('[TRIAL FOLLOWUP] Error fetching trials:', trialsError)
    return NextResponse.json({ error: 'Failed to fetch trials' }, { status: 500 })
  }

  let sent = 0
  let errors = 0

  for (const trial of trials || []) {
    if (!trial.parent_email) continue

    const group = trial.training_group as unknown as { name: string } | null
    const org = trial.organisation as unknown as { name: string; id: string } | null

    const template = trialFollowUpEmail({
      parentName: trial.parent_name?.split(' ')[0] || 'there',
      childName: trial.child_name,
      academyName: org?.name || 'the academy',
      signupUrl: `${appUrl}/book/${org?.id || ''}`,
      className: group?.name || 'the class',
    })

    const result = await sendEmail({ to: trial.parent_email, ...template })
    if (result.success) {
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
