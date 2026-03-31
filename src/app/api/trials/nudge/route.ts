import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import {
  trialReminder48hEmail,
  trialConversionEmail,
} from '@/lib/email-templates'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { trialId, action } = await request.json()
  if (!trialId || !action) {
    return NextResponse.json({ error: 'Missing trialId or action' }, { status: 400 })
  }

  const { data: trial } = await supabase
    .from('trial_bookings')
    .select('*, training_group:training_groups(name, location), organisation:organisations(name, slug)')
    .eq('id', trialId)
    .single()

  if (!trial || !trial.parent_email) {
    return NextResponse.json({ error: 'Trial not found' }, { status: 404 })
  }

  const group = trial.training_group as unknown as { name: string; location: string | null } | null
  const org = trial.organisation as unknown as { name: string; slug: string | null } | null
  const parentFirst = trial.parent_name?.split(' ')[0] || 'there'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  if (action === 'reminder') {
    const dateStr = trial.preferred_date
      ? new Date(trial.preferred_date).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long',
        })
      : 'your upcoming session'

    const template = trialReminder48hEmail({
      parentName: parentFirst,
      childName: trial.child_name,
      academyName: org?.name || 'the academy',
      className: group?.name || 'the class',
      date: dateStr,
      location: group?.location || 'Venue TBC',
    })

    const result = await sendEmail({ to: trial.parent_email, ...template })
    if (result.success) {
      await supabase.from('trial_bookings').update({ reminder_48h_sent: true }).eq('id', trialId)
    }
    return NextResponse.json({ success: result.success })
  }

  if (action === 'conversion') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let discountCode = 'TRIAL-'
    for (let i = 0; i < 6; i++) {
      discountCode += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    const slug = org?.slug || trial.organisation_id || ''
    const signupUrl = `${appUrl}/book/${slug}?discount=${discountCode}`

    const template = trialConversionEmail({
      parentName: parentFirst,
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
        .update({ followup_sent: true, conversion_offer_sent: true, discount_code: discountCode })
        .eq('id', trialId)
    }
    return NextResponse.json({ success: result.success })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
