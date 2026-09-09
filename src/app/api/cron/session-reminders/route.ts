import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, sendEmailBatch } from '@/lib/email'
import { sessionReminderEmail } from '@/lib/email-templates'

export const maxDuration = 300
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

  // Off switch. Set SESSION_REMINDERS_ENABLED=false in Vercel to stop every
  // next-day reminder without a deploy; unset or anything else keeps them on.
  if (process.env.SESSION_REMINDERS_ENABLED === 'false') {
    return NextResponse.json({ skipped: 'disabled by SESSION_REMINDERS_ENABLED' })
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDay = DAYS[tomorrow.getDay()]

  // Find all classes scheduled for tomorrow's day of week.
  //
  // 1-2-1 (and 2-1) slots are excluded. Jamie Allan runs 18 weekly 1-2-1
  // slots, but the plans behind them are "2 x per month" or "4 sessions per
  // month" — which weeks a child actually attends is arranged with the coach
  // and the app has no record of it. A weekly "see you tomorrow" for a
  // session that may not be happening confused parents (John, 9 Sep 2026).
  // Group classes, tots, intensity etc. really are weekly, so they keep it.
  const { data: groups, error: groupsError } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, class_type, organisation:organisations(name)')
    .eq('day_of_week', tomorrowDay)
    .not('class_type', 'in', '("1-2-1","2-1")')

  if (groupsError) {
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }

  const jobs: Parameters<typeof sendEmail>[0][] = []

  for (const group of groups || []) {
    // Find all enrolled players and their parents.
    //
    // players → profiles has TWO foreign keys since Archive Player added
    // archived_by alongside parent_id. An un-hinted `parent:profiles(...)`
    // is ambiguous and PostgREST refuses it (PGRST201). This route did not
    // check the error, looped over nothing, and returned `sent: 0` as a
    // success — 198 parents missed their next-day reminder in the first
    // week of September before anyone noticed. Hint the relationship, and
    // fail loudly if the query ever errors again.
    const { data: enrolments, error: enrolmentsError } = await supabase
      .from('enrolments')
      .select('player:players(id, first_name, last_name, parent:profiles!players_parent_id_fkey(full_name, email))')
      .eq('group_id', group.id)
      .eq('status', 'active')
    if (enrolmentsError) {
      console.error('[session-reminders] enrolments query failed for group', group.id, enrolmentsError.message)
      return NextResponse.json({ error: `enrolments query failed: ${enrolmentsError.message}` }, { status: 500 })
    }

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

      jobs.push({ to: player.parent.email, ...template })
    }
  }

  const { sent, failed: errors } = await sendEmailBatch(jobs)

  return NextResponse.json({
    sent,
    errors,
    groupsChecked: (groups || []).length,
    tomorrowDay,
  })
}
