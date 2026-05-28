import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, sendEmailBatch } from '@/lib/email'
import {
  trialReminder48hEmail,
  trialReminder24hEmail,
  trialReminder2hEmail,
} from '@/lib/email-templates'

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

  const now = new Date()
  const jobs48: Parameters<typeof sendEmail>[0][] = []
  const jobs24: Parameters<typeof sendEmail>[0][] = []
  const jobs2: Parameters<typeof sendEmail>[0][] = []

  // Fetch all confirmed trials with a future preferred_date that still have reminders to send
  const { data: trials, error: trialsError } = await supabase
    .from('trial_bookings')
    .select(
      'id, parent_name, parent_email, child_name, preferred_date, training_group:training_groups(name, location), organisation:organisations(name), reminder_48h_sent, reminder_24h_sent, reminder_2h_sent'
    )
    .in('status', ['confirmed', 'pending'])
    .gte('preferred_date', now.toISOString().split('T')[0])
    .or('reminder_48h_sent.eq.false,reminder_24h_sent.eq.false,reminder_2h_sent.eq.false')

  if (trialsError) {
    return NextResponse.json({ error: 'Failed to fetch trials' }, { status: 500 })
  }

  for (const trial of trials || []) {
    if (!trial.parent_email || !trial.preferred_date) continue

    const group = trial.training_group as unknown as { name: string; location: string | null } | null
    const org = trial.organisation as unknown as { name: string } | null

    // Calculate hours until the session date (assume 10am session time)
    const sessionDate = new Date(trial.preferred_date + 'T10:00:00')
    const hoursUntil = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60)

    const parentFirst = trial.parent_name?.split(' ')[0] || 'there'
    const className = group?.name || 'the class'
    const location = group?.location || 'Venue TBC'
    const academyName = org?.name || 'the academy'
    const dateStr = new Date(trial.preferred_date).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })

    // 48h reminder: send when 24-48 hours away
    if (!trial.reminder_48h_sent && hoursUntil <= 48 && hoursUntil > 24) {
      const template = trialReminder48hEmail({
        parentName: parentFirst,
        childName: trial.child_name,
        academyName,
        className,
        date: dateStr,
        location,
      })
      jobs48.push({ to: trial.parent_email, ...template })
      await supabase.from('trial_bookings').update({ reminder_48h_sent: true }).eq('id', trial.id)
    }

    // 24h reminder: send when 2-24 hours away
    if (!trial.reminder_24h_sent && hoursUntil <= 24 && hoursUntil > 2) {
      const mapUrl = location !== 'Venue TBC'
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
        : undefined
      const template = trialReminder24hEmail({
        parentName: parentFirst,
        childName: trial.child_name,
        academyName,
        className,
        date: dateStr,
        location,
        mapUrl,
      })
      jobs24.push({ to: trial.parent_email, ...template })
      await supabase.from('trial_bookings').update({ reminder_24h_sent: true }).eq('id', trial.id)
    }

    // 2h reminder: send when 0-2 hours away
    if (!trial.reminder_2h_sent && hoursUntil <= 2 && hoursUntil > 0) {
      const template = trialReminder2hEmail({
        parentName: parentFirst,
        childName: trial.child_name,
        academyName,
        className,
        location,
      })
      jobs2.push({ to: trial.parent_email, ...template })
      await supabase.from('trial_bookings').update({ reminder_2h_sent: true }).eq('id', trial.id)
    }
  }

  const batch48 = await sendEmailBatch(jobs48)
  const batch24 = await sendEmailBatch(jobs24)
  const batch2 = await sendEmailBatch(jobs2)
  const sent48 = batch48.sent
  const sent24 = batch24.sent
  const sent2 = batch2.sent
  const errors = batch48.failed + batch24.failed + batch2.failed

  return NextResponse.json({
    sent48,
    sent24,
    sent2,
    errors,
    trialsChecked: (trials || []).length,
  })
}
