import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WeekCalendar from './WeekCalendar'

export type CalendarGroup = {
  id: string
  name: string
  day_of_week: string | null
  time_slot: string | null
  location: string | null
  class_type: string | null
  max_capacity: number | null
  coach_id: string | null
  coachName: string | null
  enrolledCount: number
  enrolledPlayers: { id: string; name: string }[]
  isMyChild: boolean
}

export default async function CalendarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id, role')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organisation_id || ''
  const role = (profile?.role || 'parent') as 'admin' | 'coach' | 'parent'

  // Fetch training groups for the org
  const { data: rawGroups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, class_type, max_capacity, coach_id, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .eq('organisation_id', orgId)
    .order('name')

  type RawGroup = {
    id: string
    name: string
    day_of_week: string | null
    time_slot: string | null
    location: string | null
    class_type: string | null
    max_capacity: number | null
    coach_id: string | null
    coach: { full_name: string } | null
  }

  const groups = (rawGroups || []) as unknown as RawGroup[]

  // All group IDs (we need counts for all, even for coaches we show all on calendar)
  const allGroupIds = groups.map((g) => g.id)

  // Get active enrolment counts
  const { data: enrolments } = allGroupIds.length > 0
    ? await supabase
        .from('enrolments')
        .select('group_id, player_id, player:players(id, first_name, last_name)')
        .in('group_id', allGroupIds)
        .eq('status', 'active')
    : { data: [] as never[] }

  type EnrolmentRow = {
    group_id: string
    player_id: string
    player: { id: string; first_name: string; last_name: string } | null
  }

  const typedEnrolments = (enrolments || []) as unknown as EnrolmentRow[]

  // Count per group
  const countByGroup = new Map<string, number>()
  const playersByGroup = new Map<string, { id: string; name: string }[]>()
  for (const e of typedEnrolments) {
    countByGroup.set(e.group_id, (countByGroup.get(e.group_id) || 0) + 1)
    const list = playersByGroup.get(e.group_id) || []
    if (e.player) {
      list.push({ id: e.player.id, name: `${e.player.first_name} ${e.player.last_name}` })
    }
    playersByGroup.set(e.group_id, list)
  }

  // For parents: fetch their children's enrolments
  let childGroupIds = new Set<string>()
  let childPlayerIds = new Set<string>()
  if (role === 'parent') {
    const { data: myPlayers } = await supabase
      .from('players')
      .select('id')
      .eq('parent_id', user.id)

    const pIds = (myPlayers || []).map((p) => p.id)
    childPlayerIds = new Set(pIds)

    if (pIds.length > 0) {
      const { data: childEnrolments } = await supabase
        .from('enrolments')
        .select('group_id')
        .in('player_id', pIds)
        .eq('status', 'active')

      for (const e of childEnrolments || []) {
        childGroupIds.add(e.group_id)
      }
    }
  }

  // Get all unique locations for filter
  const locations = Array.from(new Set(groups.map((g) => g.location).filter(Boolean))) as string[]
  const classTypes = Array.from(new Set(groups.map((g) => g.class_type).filter(Boolean))) as string[]

  // Build calendar groups - show ALL groups on calendar (even for coaches, they see everything but theirs highlighted)
  const calendarGroups: CalendarGroup[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    day_of_week: g.day_of_week,
    time_slot: g.time_slot,
    location: g.location,
    class_type: g.class_type,
    max_capacity: g.max_capacity,
    coach_id: g.coach_id,
    coachName: g.coach?.full_name || null,
    enrolledCount: countByGroup.get(g.id) || 0,
    enrolledPlayers: (role === 'admin' || role === 'coach') ? (playersByGroup.get(g.id) || []) : [],
    isMyChild: role === 'parent' ? childGroupIds.has(g.id) : false,
  }))

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <WeekCalendar
        groups={calendarGroups}
        role={role}
        locations={locations}
        classTypes={classTypes}
      />
    </div>
  )
}
