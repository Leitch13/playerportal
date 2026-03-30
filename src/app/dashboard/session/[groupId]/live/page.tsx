import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'
import SessionMode from './SessionMode'

export default async function LiveSessionPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // Ensure user is coach or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  if (role === 'parent') redirect('/dashboard')

  // Fetch training group details
  const { data: group } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location')
    .eq('id', groupId)
    .single()

  if (!group) redirect('/dashboard')

  // Fetch enrolled players for this group (active enrolments)
  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('player:players(id, first_name, last_name, photo_url)')
    .eq('group_id', groupId)
    .eq('status', 'active')

  const players = (enrolments || [])
    .map(
      (e) =>
        e.player as unknown as {
          id: string
          first_name: string
          last_name: string
          photo_url: string | null
        }
    )
    .filter(Boolean)
    .sort((a, b) => a.first_name.localeCompare(b.first_name))

  const today = new Date().toISOString().split('T')[0]

  // Fetch session plan for today (if any)
  const { data: sessionPlan } = await supabase
    .from('session_plans')
    .select(
      'id, title, objectives, warm_up, main_activity, cool_down, equipment, notes, duration_minutes'
    )
    .eq('training_group_id', groupId)
    .eq('session_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch existing attendance records for today
  const { data: existingAttendance } = await supabase
    .from('attendance')
    .select('player_id, status')
    .eq('training_group_id', groupId)
    .eq('session_date', today)

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 min-h-screen">
      <SessionMode
        groupId={group.id}
        groupName={group.name}
        dayOfWeek={group.day_of_week}
        timeSlot={group.time_slot}
        location={group.location}
        sessionDate={today}
        coachId={user.id}
        players={players}
        sessionPlan={sessionPlan}
        existingAttendance={(existingAttendance || []).map(a => ({ player_id: a.player_id, present: a.status === 'present' }))}
      />
    </div>
  )
}
