import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
    .eq('organisation_id', orgId)
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
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-sm text-white/60 mt-1">
            Full schedule breakdown — weekly view, by group, coach, location & events.
          </p>
        </div>
        <a
          href="/dashboard/groups"
          className="px-4 py-2 bg-[#4ecde6] text-[#0a0a0a] rounded-lg text-sm font-medium hover:bg-[#4ecde6]/90 transition-colors"
        >
          + Manage Sessions
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#4ecde6]">{totalClasses}</div>
            <div className="text-[10px] text-white/60 mt-0.5">Total Classes</div>
          </div>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#4ecde6]">{uniquePlayers}</div>
            <div className="text-[10px] text-white/60 mt-0.5">Active Players</div>
          </div>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#4ecde6]">{totalEnrolments}</div>
            <div className="text-[10px] text-white/60 mt-0.5">Enrolments</div>
          </div>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#4ecde6]">{coaches}</div>
            <div className="text-[10px] text-white/60 mt-0.5">Coaches</div>
          </div>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className={`text-2xl font-bold ${todayClasses.length > 0 ? 'text-[#4ecde6]' : 'text-white/60'}`}>
              {todayClasses.length}
            </div>
            <div className="text-[10px] text-white/60 mt-0.5">Today&apos;s Classes</div>
          </div>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className={`text-2xl font-bold ${todayPlayerCount > 0 ? 'text-[#4ecde6]' : 'text-white/60'}`}>
              {todayPlayerCount}
            </div>
            <div className="text-[10px] text-white/60 mt-0.5">Players Today</div>
          </div>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent" />

      {/* Today's highlight */}
      {todayClasses.length > 0 && (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 text-xs rounded-full bg-[#4ecde6]/10 text-[#4ecde6] font-semibold animate-pulse">
              Live Today
            </span>
            <span className="text-sm font-semibold">{todayName}</span>
            <span className="text-xs text-white/60">
              · {todayClasses.length} class{todayClasses.length !== 1 ? 'es' : ''} · {todayPlayerCount} players
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {todayClasses.map((session) => (
              <div key={session.id} className="rounded-xl border border-[#4ecde6]/20 bg-[#4ecde6]/5 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm">{session.groupName}</div>
                    <div className="flex items-center gap-2 text-xs text-white/60 mt-1">
                      {session.location && <span>📍 {session.location}</span>}
                      {session.coachName && <span>👤 {session.coachName}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {session.timeSlot && (
                      <div className="text-sm font-bold text-[#4ecde6]">{session.timeSlot}</div>
                    )}
                    <div className="text-xs text-[#4ecde6] font-medium mt-0.5">
                      {session.playerCount} player{session.playerCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                {session.players.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {session.players.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/[0.05] rounded-full text-xs border border-white/[0.08] text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4ecde6]" />
                        {p.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Calendar with Tabs */}
      <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
        <CalendarTabs
          sessions={calendarSessions}
          events={calendarEvents}
          role={role as 'admin' | 'coach'}
        />
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent" />

      {/* Quick links */}
      <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center justify-center gap-6 py-2">
          <a href="/dashboard/groups" className="text-sm text-[#4ecde6] hover:underline font-medium">
            Manage Sessions →
          </a>
          <a href="/dashboard/enrolments" className="text-sm text-[#4ecde6] hover:underline font-medium">
            Manage Enrolments →
          </a>
          <a href="/dashboard/attendance" className="text-sm text-[#4ecde6] hover:underline font-medium">
            Take Attendance →
          </a>
          <a href="/dashboard/events" className="text-sm text-[#4ecde6] hover:underline font-medium">
            Manage Events →
          </a>
        </div>
      </div>
    </div>
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

  // Get academy branding so the schedule feels like the academy's own product,
  // not a generic Player Portal page. Falls back to platform cyan if missing.
  const { data: orgBrand } = await supabase
    .from('organisations')
    .select('name, slug, logo_url, primary_color, hero_image_url')
    .eq('id', orgId)
    .maybeSingle()
  const academyName = (orgBrand?.name as string | undefined) || 'Your Academy'
  const academySlug = (orgBrand?.slug as string | undefined) || ''
  const academyLogo = (orgBrand?.logo_url as string | undefined) || null
  const academyHero = (orgBrand?.hero_image_url as string | undefined) || null
  const brandColor = (orgBrand?.primary_color as string | undefined) || '#4ecde6'

  // Get parent's profile for personalised greeting
  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()
  const parentFirstName = (parentProfile?.full_name as string | undefined)?.split(' ')[0] || ''

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
    .eq('organisation_id', orgId)
    .order('name')

  // Upcoming published camps for this academy (shown as a section below classes)
  const todayStr = new Date().toISOString().split('T')[0]
  const { data: campRows } = await supabase
    .from('camps')
    .select('id, name, start_date, end_date, daily_start_time, daily_end_time, location, age_group, price, early_bird_price, early_bird_deadline, image_url')
    .eq('organisation_id', orgId)
    .eq('is_published', true)
    .gte('end_date', todayStr)
    .order('start_date')
  const upcomingCamps = (campRows || []) as {
    id: string; name: string; start_date: string; end_date: string
    daily_start_time: string | null; daily_end_time: string | null
    location: string | null; age_group: string | null
    price: number | null; early_bird_price: number | null; early_bird_deadline: string | null
    image_url: string | null
  }[]

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
    <div
      className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white"
      style={{ ['--brand' as string]: brandColor }}
    >
    <div className="space-y-5 sm:space-y-6">
      {/* Branded hero — academy logo + name + personalised greeting */}
      <div
        className="relative overflow-hidden rounded-3xl border border-[#1e1e1e] p-4 sm:p-8"
        style={{
          background: academyHero
            ? `linear-gradient(135deg, ${brandColor}20 0%, rgba(10,10,10,0.7) 50%, #0a0a0a 100%)`
            : `linear-gradient(135deg, ${brandColor}15 0%, ${brandColor}05 50%, #0a0a0a 100%)`,
        }}
      >
        {academyHero && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
            style={{ backgroundImage: `url(${academyHero})` }}
          />
        )}
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-[80px] pointer-events-none"
          style={{ background: `${brandColor}25` }}
        />
        <div className="relative flex items-center gap-3 sm:gap-5">
          {academyLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={academyLogo}
              alt={academyName}
              className="w-12 h-12 sm:w-20 sm:h-20 rounded-2xl object-cover shadow-2xl border-2"
              style={{ borderColor: `${brandColor}40` }}
            />
          ) : (
            // Polished fallback: gradient tile with football icon + initial overlay
            // Looks deliberate (not "we couldn't find a logo") until the academy uploads one.
            <div
              className="relative w-12 h-12 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shadow-2xl border-2 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${brandColor}30 0%, ${brandColor}10 100%)`,
                borderColor: `${brandColor}60`,
              }}
            >
              {/* Football icon */}
              <svg
                className="absolute inset-0 m-auto w-7 h-7 sm:w-12 sm:h-12 opacity-30"
                viewBox="0 0 24 24"
                fill="none"
                stroke={brandColor}
                strokeWidth={1.5}
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="12,7 16,10 14.5,15 9.5,15 8,10" fill={brandColor} fillOpacity="0.4" />
                <line x1="12" y1="2" x2="12" y2="7" />
                <line x1="22" y1="12" x2="16" y2="10" />
                <line x1="18.5" y1="20" x2="14.5" y2="15" />
                <line x1="5.5" y1="20" x2="9.5" y2="15" />
                <line x1="2" y1="12" x2="8" y2="10" />
              </svg>
              {/* Initial overlay on top, bold */}
              <span
                className="relative text-xl sm:text-3xl font-extrabold drop-shadow-md"
                style={{ color: brandColor }}
              >
                {academyName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1" style={{ color: `${brandColor}` }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-xl sm:text-3xl font-extrabold text-white leading-tight">
              {parentFirstName ? `${parentFirstName}'s Schedule` : 'Your Schedule'}
            </h1>
            <p className="text-xs sm:text-sm text-white/60 mt-0.5 sm:mt-1 truncate">
              at <strong className="text-white">{academyName}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards — punchier than the old generic boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="relative overflow-hidden rounded-2xl border border-[#1e1e1e] bg-gradient-to-br from-[#4ecde6]/10 via-[#0f1818] to-[#0a0a0a] p-3 sm:p-4">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#4ecde6]/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">{bookedGroups}</p>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#4ecde6]/80 mt-1">Classes Booked</p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#4ecde6]/15 border border-[#4ecde6]/30 flex items-center justify-center text-[#4ecde6]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#1e1e1e] bg-gradient-to-br from-white/[0.04] via-[#0f1416] to-[#0a0a0a] p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">{totalClasses}</p>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/50 mt-1">Available</p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-white/60">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#1e1e1e] bg-gradient-to-br from-white/[0.04] via-[#0f1416] to-[#0a0a0a] p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">{(myPlayers || []).length}</p>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/50 mt-1">Children</p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-white/60">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#1e1e1e] bg-gradient-to-br from-purple-500/10 via-[#0f1418] to-[#0a0a0a] p-3 sm:p-4">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">{calendarEvents.length}</p>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-300/80 mt-1">Events</p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Full Calendar with Tabs */}
      <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3 sm:p-5">
        <CalendarTabs
          sessions={calendarSessions}
          events={calendarEvents}
          role="parent"
          brandColor={brandColor}
        />
      </div>

      {/* Divider */}
      <div className="h-px" style={{ background: `linear-gradient(to right, transparent, ${brandColor}40, transparent)` }} />

      {/* ═══ ALL CLASSES — single unified list (booked status + book actions on each card) ═══ */}
      <div className="space-y-4 sm:space-y-5">
        <div className="flex items-end justify-between flex-wrap gap-2 sm:gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">Classes</h2>
            <p className="text-xs sm:text-sm text-white/50 mt-0.5">All weekly sessions — book your child in with one click.</p>
          </div>
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/40">
            {sortedDays.length} day{sortedDays.length !== 1 ? 's' : ''} this week
          </span>
        </div>

        {sortedDays.length === 0 ? (
          <EmptyState message="No classes available yet. Check back soon!" />
        ) : (
          <div className="space-y-5 sm:space-y-6">
            {sortedDays.map((day) => {
              const classes = classesByDay[day]
              const isToday = day === new Date().toLocaleDateString('en-GB', { weekday: 'long' })

              return (
                <div key={day} className="space-y-2.5 sm:space-y-3">
                  {/* Day header — sticky-feeling with bold day and class count chip */}
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <h3
                      className={`text-base sm:text-lg font-extrabold ${isToday ? '' : 'text-white'}`}
                      style={isToday ? { color: brandColor } : undefined}
                    >
                      {day}
                    </h3>
                    {isToday && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${brandColor}15`,
                          color: brandColor,
                          border: `1px solid ${brandColor}30`,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: brandColor }} />
                        Today
                      </span>
                    )}
                    <span className="ml-auto text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/30">
                      {classes.length} class{classes.length !== 1 ? 'es' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
                    {classes.map((group) => {
                      const enrolledPlayerIds = (myPlayers || [])
                        .filter((p) => enrolmentLookup[`${p.id}:${group.id}`])
                        .map((p) => p.id)
                      const availablePlayers = (myPlayers || []).filter(
                        (p) => !enrolledPlayerIds.includes(p.id)
                      )
                      const allBooked = availablePlayers.length === 0 && enrolledPlayerIds.length > 0
                      const enrolled = enrolCountByGroup.get(group.id) || 0
                      const capacity = group.max_capacity || 20
                      const spots = capacity - enrolled
                      const fillPct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0
                      const isFull = spots <= 0
                      const isAlmostFull = !isFull && spots <= 3

                      return (
                        <div
                          key={group.id}
                          className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#141414] via-[#0f1416] to-[#0a0a0a] p-3 sm:p-4 transition-all hover:shadow-[0_8px_28px_rgba(0,0,0,0.4)]"
                          style={{
                            borderColor: allBooked ? `${brandColor}55` : '#1e1e1e',
                            boxShadow: allBooked ? `inset 0 0 20px ${brandColor}10` : undefined,
                          }}
                        >
                          {/* Booked-checkmark watermark in corner */}
                          {allBooked && (
                            <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${brandColor}20`, color: brandColor, border: `1px solid ${brandColor}40` }}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              Booked
                            </div>
                          )}

                          {/* Top row: time block + class name */}
                          <div className="flex items-center gap-3 mb-3">
                            {group.time_slot && (
                              <div
                                className="shrink-0 flex flex-col items-center justify-center min-w-[60px] rounded-xl px-2 py-2"
                                style={{ background: `${brandColor}15`, border: `1px solid ${brandColor}30` }}
                              >
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `${brandColor}99` }}>Time</span>
                                <span className="text-xs font-extrabold whitespace-nowrap leading-tight mt-0.5" style={{ color: brandColor }}>{group.time_slot}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-white truncate">{group.name}</h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-white/50">
                                {group.location && (
                                  <span className="inline-flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><circle cx="12" cy="11" r="3" /></svg>
                                    {group.location}
                                  </span>
                                )}
                                {group.coach?.full_name && (
                                  <span className="inline-flex items-center gap-1 min-w-0 max-w-[160px]">
                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /></svg>
                                    <span className="truncate">{group.coach.full_name}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Capacity progress */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${fillPct}%`,
                                  background: isFull
                                    ? 'linear-gradient(90deg, #f43f5e, #be123c)'
                                    : isAlmostFull
                                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                    : `linear-gradient(90deg, ${brandColor}, ${brandColor}99)`,
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-bold tabular-nums text-white/50 whitespace-nowrap">
                              {enrolled}/{capacity}
                            </span>
                            {isFull && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">Full</span>
                            )}
                            {isAlmostFull && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">{spots} left</span>
                            )}
                          </div>

                          {/* Per-child status + actions */}
                          <div className="space-y-1.5 pt-2 border-t border-white/[0.05]">
                            {(myPlayers || []).map((player) => {
                              const enrolmentId = enrolmentLookup[`${player.id}:${group.id}`]
                              const isEnrolled = !!enrolmentId
                              return (
                                <div key={player.id} className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full shrink-0"
                                      style={{ background: isEnrolled ? brandColor : '#3a3a3a' }}
                                    />
                                    <span className={`text-xs font-medium truncate ${isEnrolled ? 'text-white' : 'text-white/50'}`}>
                                      {player.first_name}
                                    </span>
                                  </div>
                                  {isEnrolled ? (
                                    <CancelBookingButton
                                      enrolmentId={enrolmentId}
                                      playerId={player.id}
                                      className={group.name}
                                    />
                                  ) : (
                                    <BookClassButton
                                      playerId={player.id}
                                      groupId={group.id}
                                      playerName={player.first_name}
                                      orgId={orgId}
                                      className={group.name}
                                      isFull={isFull}
                                      spotsLeft={spots}
                                    />
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Per-class booking options — quick links to full detail page + trial booking */}
                          {academySlug && (
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05]">
                              <a
                                href={`/book/${academySlug}/class/${group.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/60 hover:text-white transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Details
                              </a>
                              <span className="text-white/15">·</span>
                              <a
                                href={`/book/${academySlug}/trial/quick`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300/80 hover:text-emerald-200 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Try free
                              </a>
                              {!isFull && (
                                <>
                                  <span className="text-white/15">·</span>
                                  <a
                                    href={`/book/${academySlug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline transition-colors"
                                    style={{ color: brandColor }}
                                  >
                                    Subscribe →
                                  </a>
                                </>
                              )}
                              {isFull && (
                                <>
                                  <span className="text-white/15">·</span>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300/80">
                                    Waitlist available
                                  </span>
                                </>
                              )}
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

      {/* ═══ CAMPS & EVENTS — upcoming holiday camps the parent can book ═══ */}
      {upcomingCamps.length > 0 && (
        <>
          <div className="h-px" style={{ background: `linear-gradient(to right, transparent, ${brandColor}40, transparent)` }} />
          <div className="space-y-4 sm:space-y-5">
            <div className="flex items-end justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Camps &amp; Events</h2>
                <p className="text-xs sm:text-sm text-white/50 mt-0.5">Holiday camps &amp; one-off events — book a place for your child.</p>
              </div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/40">
                {upcomingCamps.length} upcoming
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {upcomingCamps.map((camp) => {
                const isEarlyBird = camp.early_bird_price != null && camp.early_bird_deadline != null && todayStr <= camp.early_bird_deadline
                const price = isEarlyBird ? Number(camp.early_bird_price) : (camp.price != null ? Number(camp.price) : null)
                const start = new Date(camp.start_date + 'T00:00:00')
                const end = new Date(camp.end_date + 'T00:00:00')
                const sameMonth = start.getMonth() === end.getMonth()
                const dateLabel = sameMonth
                  ? `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString('en-GB', { month: 'short' })}`
                  : `${start.getDate()} ${start.toLocaleDateString('en-GB', { month: 'short' })} – ${end.getDate()} ${end.toLocaleDateString('en-GB', { month: 'short' })}`
                return (
                  <a
                    key={camp.id}
                    href={`/book/${academySlug}/camps/${camp.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 rounded-2xl border border-[#1e1e1e] bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-3 transition-all hover:-translate-y-0.5"
                    style={{ ['--tw-ring-color' as string]: brandColor }}
                  >
                    {/* Thumbnail */}
                    <div
                      className="shrink-0 w-20 h-20 rounded-xl bg-cover bg-center relative overflow-hidden"
                      style={camp.image_url
                        ? { backgroundImage: `url(${camp.image_url})` }
                        : { background: `linear-gradient(135deg, #060606, ${brandColor}66)` }}
                    >
                      {isEarlyBird && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase bg-green-500 text-white">Early</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-white truncate">{camp.name}</h4>
                      <div className="text-[11px] text-white/50 mt-0.5">📅 {dateLabel}</div>
                      {camp.location && <div className="text-[11px] text-white/40 truncate">📍 {camp.location}</div>}
                      <div className="flex items-center justify-between mt-1.5">
                        {price != null && (
                          <span className="text-base font-extrabold" style={{ color: brandColor }}>£{price.toFixed(0)}</span>
                        )}
                        <span className="text-[11px] font-bold group-hover:underline" style={{ color: brandColor }}>Book →</span>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Help footer — compact */}
      <div className="rounded-2xl border border-[#1e1e1e] bg-white/[0.02] p-3 sm:p-4 text-center">
        <p className="text-[11px] sm:text-xs text-white/40">
          Need help? Message your coach via{' '}
          <a href="/dashboard/messages" className="font-semibold hover:underline" style={{ color: brandColor }}>Messages</a>
          {' '}· Payment handled through your{' '}
          <a href="/dashboard/payments" className="font-semibold hover:underline" style={{ color: brandColor }}>subscription</a>.
        </p>
      </div>
    </div>
    </div>
  )
}
