import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { postSessionFollowUpEmail, missedSessionEmail } from '@/lib/email-templates'

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'
  const today = new Date()
  const todayDay = DAYS[today.getDay()]
  const todayDate = today.toISOString().split('T')[0]

  // Find all classes that happened today
  const { data: groups, error: groupsError } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, organisation:organisations(name)')
    .eq('day_of_week', todayDay)

  if (groupsError) {
    console.error('[POST SESSION] Error fetching groups:', groupsError)
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }

  let followUpsSent = 0
  let missedSent = 0
  let errors = 0

  for (const group of groups || []) {
    // Get all enrolled players for this group
    const { data: enrolments } = await supabase
      .from('enrolments')
      .select('player:players(id, first_name, last_name, parent:profiles(full_name, email))')
      .eq('group_id', group.id)
      .eq('status', 'active')

    // Get attendance records for today's session
    const { data: attendanceRecords } = await supabase
      .from('attendance')
      .select('player_id, status')
      .eq('training_group_id', group.id)
      .eq('session_date', todayDate)

    const attendanceMap = new Map(
      (attendanceRecords || []).map((r) => [r.player_id, r.status])
    )

    const org = group.organisation as unknown as { name: string } | null

    for (const enrolment of enrolments || []) {
      const player = enrolment.player as unknown as {
        id: string
        first_name: string
        last_name: string
        parent: { full_name: string; email: string } | null
      } | null

      if (!player?.parent?.email) continue

      const parentFirstName = player.parent.full_name?.split(' ')[0] || 'there'
      const attendanceStatus = attendanceMap.get(player.id)

      if (attendanceStatus === 'present') {
        // Send follow-up email for attended session
        const template = postSessionFollowUpEmail({
          parentName: parentFirstName,
          childName: player.first_name,
          className: group.name,
          academyName: org?.name || 'your academy',
          dashboardUrl: `${appUrl}/dashboard`,
        })

        const result = await sendEmail({ to: player.parent.email, ...template })
        if (result.success) followUpsSent++
        else errors++
      } else if (attendanceStatus === 'absent') {
        // Send missed session email
        const template = missedSessionEmail({
          parentName: parentFirstName,
          childName: player.first_name,
          className: group.name,
          date: todayDate,
          dashboardUrl: `${appUrl}/dashboard`,
        })

        const result = await sendEmail({ to: player.parent.email, ...template })
        if (result.success) missedSent++
        else errors++
      }
    }
  }

  return NextResponse.json({
    followUpsSent,
    missedSent,
    errors,
    groupsChecked: (groups || []).length,
    date: todayDate,
  })
}
