import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { sessionReminderEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDay = DAYS[tomorrow.getDay()]

  // Find all classes scheduled for tomorrow's day of week
  const { data: groups, error: groupsError } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, organisation:organisations(name)')
    .eq('day_of_week', tomorrowDay)

  if (groupsError) {
    console.error('[SESSION REMINDERS] Error fetching groups:', groupsError)
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }

  let sent = 0
  let errors = 0

  for (const group of groups || []) {
    // Find all enrolled players and their parents
    const { data: enrolments } = await supabase
      .from('enrolments')
      .select('player:players(id, first_name, last_name, parent:profiles(full_name, email))')
      .eq('group_id', group.id)
      .eq('status', 'active')

    for (const enrolment of enrolments || []) {
      const player = enrolment.player as unknown as {
        id: string
        first_name: string
        last_name: string
        parent: { full_name: string; email: string } | null
      } | null

      if (!player?.parent?.email) continue

      const org = group.organisation as unknown as { name: string } | null

      const template = sessionReminderEmail({
        parentName: player.parent.full_name?.split(' ')[0] || 'there',
        childName: player.first_name,
        className: group.name,
        dayTime: `${group.day_of_week} at ${group.time_slot}`,
        location: group.location || 'TBC',
        academyName: org?.name || 'your academy',
      })

      const result = await sendEmail({ to: player.parent.email, ...template })
      if (result.success) {
        sent++
      } else {
        errors++
      }
    }
  }

  return NextResponse.json({
    sent,
    errors,
    groupsChecked: (groups || []).length,
    tomorrowDay,
  })
}
