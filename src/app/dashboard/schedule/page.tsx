import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import StatusBadge from '@/components/StatusBadge'
import BookClassButton from './BookClassButton'
import CancelBookingButton from './CancelBookingButton'
import CalendarTabs from './CalendarTabs'
import type { CalendarSession, CalendarEvent } from './CalendarTabs'
import type { UserRole } from '@/lib/types'

const DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export default async function SchedulePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const orgId = profile?.organisation_id || ''

  if (role === 'admin' || role === 'coach') {
    return <AdminSchedule userId={user.id} role={role} orgId={orgId} />
  }

  return <ParentSchedule userId={user.id} orgId={orgId} />
}

/* ═══════════════════════════════════════════════
   ADMIN / COACH VIEW
   ═══════════════════════════════════════════════ */
async function AdminSchedule({
  userId,
  role,
  orgId,
}: {
  userId: string
  role: UserRole
  orgId: string
}) {
  const supabase = await createClient()

  // Get all groups
  const { data: allGroups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, max_capacity, coach_id, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .order('name')

  type GroupRow = {
    id: string
    name: string
    day_of_week: string | null
    time_slot: string | null
    location: string | null
    max_capacity: number | null
    coach_id: string | null
    coach: { full_name: string } | null
  }

  const groups = (allGroups || []) as unknown as GroupRow[]

  // Get ALL active enrolments with player + parent info
  const groupIds = groups.map((g) => g.id)
  const { data: allEnrolments } = groupIds.length > 0
    ? await supabase
        .from('enrolments')
        .select('id, player_id, group_id, status, player:players(id, first_name, last_name, parent_id, parent:profiles!players_parent_id_fkey(full_name))')
        .in('group_id', groupIds)
        .eq('status', 'active')
    : { data: [] as never[] }

  type EnrolmentRow = {
    id: string
    player_id: string
    group_id: string
    status: string
    player: {
      id: string
      first_name: string
      last_name: string
      parent_id: string
      parent: { full_name: string } | null
    } | null
  }

  const enrolments = (allEnrolments || []) as unknown as EnrolmentRow[]

  // Build enrolments by group
  const enrolmentsByGroup: Record<string, EnrolmentRow[]> = {}
  for (const e of enrolments) {
    if (!enrolmentsByGroup[e.group_id]) enrolmentsByGroup[e.group_id] = []
    enrolmentsByGroup[e.group_id].push(e)
  }

  // Build calendar sessions
  const calendarSessions: CalendarSession[] = groups.map((group) => {
    const groupEnrolments = enrolmentsByGroup[group.id] || []
    return {
      id: group.id,
      groupName: group.name,
      groupId: group.id,
      day: group.day_of_week || 'Unscheduled',
      timeSlot: group.time_slot || '',
      location: group.location || '',
      coachName: group.coach?.full_name || '',
      coachId: group.coach_id,
      playerCount: groupEnrolments.length,
      maxCapacity: group.max_capacity || 20,
      players: groupEnrolments.map((e) => ({
        id: e.player?.id || e.player_id,
        name: e.player ? `${e.player.first_name} ${e.player.last_name}` : '—',
        parentName: e.player?.parent?.full_name || '—',
      })),
    }
  })

  // Get upcoming events
  const today = new Date().toISOString().split('T')[0]
  const { data: eventsData } = await supabase
    .from('events')
    .select('*')
    .eq('active', true)
    .gte('end_date', today)
    .order('start_date')

  // Get event booking counts
  const eventIds = (eventsData || []).map(e => e.id)
  const { data: eventBookings } = eventIds.length > 0
    ? await supabase
        .from('event_bookings')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('status', 'confirmed')
    : { data: [] as { event_id: string }[] }

  const eventBookingCounts = new Map<string, number>()
  for (const b of eventBookings || []) {
    eventBookingCounts.set(b.event_id, (eventBookingCounts.get(b.event_id) || 0) + 1)
  }

  const calendarEvents: CalendarEvent[] = (eventsData || []).map(event => ({
    id: event.id,
    name: event.name,
    event_type: event.event_type || 'other',
    start_date: event.start_date,
    end_date: event.end_date,
    start_time: event.start_time,
    end_time: event.end_time,
    location: event.location,
    max_capacity: event.max_capacity || 30,
    price: Number(event.price) || 0,
    description: event.description,
    bookingCount: eventBookingCounts.get(event.id) || 0,
  }))

  // Stats
  const totalClasses = groups.length
  const totalEnrolments = enrolments.length
  const uniquePlayers = new Set(enrolments.map((e) => e.player_id)).size
  const coaches = new Set(groups.map((g) => g.coach_id).filter(Boolean)).size
  const todayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' })
  const todayClasses = calendarSessions.filter((s) => s.day === todayName)
  const todayPlayerCount = todayClasses.reduce((sum, s) => sum + s.playerCount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-text-light mt-1">
            Full schedule breakdown — weekly view, by group, coach, location & events.
          </p>
        </div>
        <a
          href="/dashboard/groups"
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          + Manage Sessions
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalClasses}</div>
            <div className="text-[10px] text-text-light mt-0.5">Total Classes</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{uniquePlayers}</div>
            <div className="text-[10px] text-text-light mt-0.5">Active Players</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalEnrolments}</div>
            <div className="text-[10px] text-text-light mt-0.5">Enrolments</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{coaches}</div>
            <div className="text-[10px] text-text-light mt-0.5">Coaches</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className={`text-2xl font-bold ${todayClasses.length > 0 ? 'text-accent' : 'text-text-light'}`}>
              {todayClasses.length}
            </div>
            <div className="text-[10px] text-text-light mt-0.5">Today&apos;s Classes</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className={`text-2xl font-bold ${todayPlayerCount > 0 ? 'text-accent' : 'text-text-light'}`}>
              {todayPlayerCount}
            </div>
            <div className="text-[10px] text-text-light mt-0.5">Players Today</div>
          </div>
        </Card>
      </div>

      {/* Today's highlight */}
      {todayClasses.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-semibold animate-pulse">
              Live Today
            </span>
            <span className="text-sm font-semibold">{todayName}</span>
            <span className="text-xs text-text-light">
              · {todayClasses.length} class{todayClasses.length !== 1 ? 'es' : ''} · {todayPlayerCount} players
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {todayClasses.map((session) => (
              <div key={session.id} className="rounded-xl border border-accent/20 bg-accent/5 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm">{session.groupName}</div>
                    <div className="flex items-center gap-2 text-xs text-text-light mt-1">
                      {session.location && <span>📍 {session.location}</span>}
                      {session.coachName && <span>👤 {session.coachName}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {session.timeSlot && (
                      <div className="text-sm font-bold text-primary">{session.timeSlot}</div>
                    )}
                    <div className="text-xs text-accent font-medium mt-0.5">
                      {session.playerCount} player{session.playerCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                {session.players.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {session.players.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-full text-xs border border-border">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                        {p.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Full Calendar with Tabs */}
      <Card>
        <CalendarTabs
          sessions={calendarSessions}
          events={calendarEvents}
          role={role as 'admin' | 'coach'}
        />
      </Card>

      {/* Quick links */}
      <Card>
        <div className="flex items-center justify-center gap-6 py-2">
          <a href="/dashboard/groups" className="text-sm text-accent hover:underline font-medium">
            Manage Sessions →
          </a>
          <a href="/dashboard/enrolments" className="text-sm text-accent hover:underline font-medium">
            Manage Enrolments →
          </a>
          <a href="/dashboard/attendance" className="text-sm text-accent hover:underline font-medium">
            Take Attendance →
          </a>
          <a href="/dashboard/events" className="text-sm text-accent hover:underline font-medium">
            Manage Events →
          </a>
        </div>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   PARENT VIEW
   ═══════════════════════════════════════════════ */
async function ParentSchedule({
  userId,
  orgId,
}: {
  userId: string
  orgId: string
}) {
  const supabase = await createClient()

  // Get parent's children
  const { data: myPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('parent_id', userId)
    .order('first_name')

  // Get all enrolments for parent's children
  const playerIds = (myPlayers || []).map((p) => p.id)
  const { data: enrolments } = playerIds.length > 0
    ? await supabase
        .from('enrolments')
        .select('id, player_id, group_id, status')
        .in('player_id', playerIds)
    : { data: [] as { id: string; player_id: string; group_id: string; status: string }[] }

  // Get ALL available classes in the org
  const { data: allGroups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, max_capacity, coach_id, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .order('name')

  type GroupRow = {
    id: string
    name: string
    day_of_week: string | null
    time_slot: string | null
    location: string | null
    max_capacity: number | null
    coach_id: string | null
    coach: { full_name: string } | null
  }

  const groups = (allGroups || []) as unknown as GroupRow[]

  // Build active enrolment lookup
  const activeEnrolments = (enrolments || []).filter((e) => e.status === 'active')
  const enrolmentLookup: Record<string, string> = {}
  for (const e of activeEnrolments) {
    enrolmentLookup[`${e.player_id}:${e.group_id}`] = e.id
  }

  // Get active enrolment counts per group (all users)
  const groupIds = groups.map(g => g.id)
  const { data: allGroupEnrolments } = groupIds.length > 0
    ? await supabase
        .from('enrolments')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('status', 'active')
    : { data: [] as { group_id: string }[] }

  const enrolCountByGroup = new Map<string, number>()
  for (const e of allGroupEnrolments || []) {
    enrolCountByGroup.set(e.group_id, (enrolCountByGroup.get(e.group_id) || 0) + 1)
  }

  // Build calendar sessions for parent
  const calendarSessions: CalendarSession[] = groups.map(group => {
    const enrolledPlayers = (myPlayers || []).filter(p => enrolmentLookup[`${p.id}:${group.id}`])
    return {
      id: group.id,
      groupName: group.name,
      groupId: group.id,
      day: group.day_of_week || 'Unscheduled',
      timeSlot: group.time_slot || '',
      location: group.location || '',
      coachName: group.coach?.full_name || '',
      coachId: group.coach_id,
      playerCount: enrolCountByGroup.get(group.id) || 0,
      maxCapacity: group.max_capacity || 20,
      players: enrolledPlayers.map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        parentName: 'You',
      })),
    }
  })

  // Get upcoming events
  const today = new Date().toISOString().split('T')[0]
  const { data: eventsData } = await supabase
    .from('events')
    .select('*')
    .eq('active', true)
    .gte('end_date', today)
    .order('start_date')

  const eventIds = (eventsData || []).map(e => e.id)
  const { data: eventBookings } = eventIds.length > 0
    ? await supabase
        .from('event_bookings')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('status', 'confirmed')
    : { data: [] as { event_id: string }[] }

  const eventBookingCounts = new Map<string, number>()
  for (const b of eventBookings || []) {
    eventBookingCounts.set(b.event_id, (eventBookingCounts.get(b.event_id) || 0) + 1)
  }

  const calendarEvents: CalendarEvent[] = (eventsData || []).map(event => ({
    id: event.id,
    name: event.name,
    event_type: event.event_type || 'other',
    start_date: event.start_date,
    end_date: event.end_date,
    start_time: event.start_time,
    end_time: event.end_time,
    location: event.location,
    max_capacity: event.max_capacity || 30,
    price: Number(event.price) || 0,
    description: event.description,
    bookingCount: eventBookingCounts.get(event.id) || 0,
  }))

  const bookedCount = activeEnrolments.length
  const totalClasses = groups.length
  const bookedGroups = new Set(activeEnrolments.map(e => e.group_id)).size

  // Build class-by-day for the booking section
  const classesByDay: Record<string, GroupRow[]> = {}
  for (const g of groups) {
    const day = g.day_of_week || 'Unscheduled'
    if (!classesByDay[day]) classesByDay[day] = []
    classesByDay[day].push(g)
  }
  const sortedDays = Object.keys(classesByDay).sort(
    (a, b) =>
      (DAY_ORDER.indexOf(a) === -1 ? 99 : DAY_ORDER.indexOf(a)) -
      (DAY_ORDER.indexOf(b) === -1 ? 99 : DAY_ORDER.indexOf(b))
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-sm text-text-light mt-1">
          View your schedule, browse available classes & upcoming events.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalClasses}</div>
            <div className="text-[10px] text-text-light mt-0.5">Classes Available</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{bookedGroups}</div>
            <div className="text-[10px] text-text-light mt-0.5">Classes Booked</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{(myPlayers || []).length}</div>
            <div className="text-[10px] text-text-light mt-0.5">Children</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{calendarEvents.length}</div>
            <div className="text-[10px] text-text-light mt-0.5">Upcoming Events</div>
          </div>
        </Card>
      </div>

      {/* Full Calendar with Tabs */}
      <Card>
        <CalendarTabs
          sessions={calendarSessions}
          events={calendarEvents}
          role="parent"
        />
      </Card>

      {/* My Booked Classes with booking/cancel actions */}
      {bookedCount > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Your Booked Classes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((group) => {
              const enrolledPlayers = (myPlayers || []).filter(
                (p) => enrolmentLookup[`${p.id}:${group.id}`]
              )
              if (enrolledPlayers.length === 0) return null

              const isToday = group.day_of_week === new Date().toLocaleDateString('en-GB', { weekday: 'long' })

              return (
                <Card key={group.id} className={isToday ? 'ring-2 ring-accent' : ''}>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-sm">{group.name}</div>
                        <div className="text-xs text-text-light">
                          {group.day_of_week}{group.time_slot && ` · ${group.time_slot}`}
                        </div>
                      </div>
                      {isToday && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-medium">
                          Today
                        </span>
                      )}
                    </div>

                    {(group.location || group.coach) && (
                      <div className="flex items-center gap-3 text-xs text-text-light">
                        {group.location && <span>📍 {group.location}</span>}
                        {group.coach && <span>👤 {group.coach.full_name}</span>}
                      </div>
                    )}

                    <div className="pt-1 space-y-1">
                      {enrolledPlayers.map((player) => (
                        <div key={player.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StatusBadge status="active" />
                            <span className="text-xs font-medium">
                              {player.first_name} {player.last_name}
                            </span>
                          </div>
                          <CancelBookingButton
                            enrolmentId={enrolmentLookup[`${player.id}:${group.id}`]}
                            playerId={player.id}
                            className={group.name}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* All Available Classes by Day with Book buttons */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Book a Class</h2>

        {sortedDays.length === 0 ? (
          <EmptyState message="No classes available yet. Check back soon!" />
        ) : (
          <div className="space-y-4">
            {sortedDays.map((day) => {
              const classes = classesByDay[day]
              const isToday = day === new Date().toLocaleDateString('en-GB', { weekday: 'long' })

              return (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={`text-sm font-bold ${isToday ? 'text-accent' : 'text-text'}`}>
                      {day}
                    </h3>
                    {isToday && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-medium">
                        Today
                      </span>
                    )}
                    <span className="text-xs text-text-light">
                      {classes.length} class{classes.length !== 1 ? 'es' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {classes.map((group) => {
                      const enrolledPlayerIds = (myPlayers || [])
                        .filter((p) => enrolmentLookup[`${p.id}:${group.id}`])
                        .map((p) => p.id)

                      const availablePlayers = (myPlayers || []).filter(
                        (p) => !enrolledPlayerIds.includes(p.id)
                      )

                      const allBooked = availablePlayers.length === 0 && enrolledPlayerIds.length > 0

                      return (
                        <div
                          key={group.id}
                          className={`rounded-xl border p-4 ${
                            allBooked
                              ? 'border-accent/30 bg-accent/5'
                              : 'border-border bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-semibold text-sm">{group.name}</div>
                              {group.time_slot && (
                                <div className="text-sm font-bold text-primary mt-0.5">
                                  {group.time_slot}
                                </div>
                              )}
                            </div>
                            {allBooked && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-medium">
                                Booked ✓
                              </span>
                            )}
                          </div>

                          {(group.location || group.coach) && (
                            <div className="flex items-center gap-3 text-xs text-text-light mb-3">
                              {group.location && <span>📍 {group.location}</span>}
                              {group.coach?.full_name && <span>👤 {group.coach.full_name}</span>}
                            </div>
                          )}

                          {enrolledPlayerIds.length > 0 && (
                            <div className="mb-2 space-y-1">
                              {(myPlayers || [])
                                .filter((p) => enrolledPlayerIds.includes(p.id))
                                .map((p) => (
                                  <div key={p.id} className="flex items-center gap-1.5 text-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                                    <span className="text-accent font-medium">{p.first_name} booked</span>
                                  </div>
                                ))}
                            </div>
                          )}

                          {availablePlayers.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {availablePlayers.map((player) => {
                                const enrolled = enrolCountByGroup.get(group.id) || 0
                                const capacity = group.max_capacity || 20
                                const spots = capacity - enrolled
                                return (
                                  <BookClassButton
                                    key={player.id}
                                    playerId={player.id}
                                    groupId={group.id}
                                    playerName={player.first_name}
                                    orgId={orgId}
                                    className={group.name}
                                    isFull={spots <= 0}
                                    spotsLeft={spots}
                                  />
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Help text */}
      <Card>
        <div className="text-center py-2 space-y-1">
          <p className="text-sm text-text-light">
            Need to change or cancel a class? Use the cancel button above, or message your coach via{' '}
            <a href="/dashboard/messages" className="text-accent hover:underline font-medium">Messages</a>.
          </p>
          <p className="text-xs text-text-light">
            Payment for classes is handled through your{' '}
            <a href="/dashboard/payments" className="text-accent hover:underline font-medium">subscription</a>.
          </p>
        </div>
      </Card>
    </div>
  )
}
