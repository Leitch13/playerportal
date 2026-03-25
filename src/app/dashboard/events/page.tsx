import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import StatusBadge from '@/components/StatusBadge'
import EventManager from './EventManager'
import BookEventButton from './BookEventButton'
import type { UserRole } from '@/lib/types'

const EVENT_TYPE_LABELS: Record<string, string> = {
  holiday_camp: 'Holiday Camp',
  tournament: 'Tournament',
  workshop: 'Workshop',
  social: 'Social',
  other: 'Other',
}

export default async function EventsPage() {
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
    return <AdminEvents userId={user.id} role={role} orgId={orgId} />
  }

  return <ParentEvents userId={user.id} orgId={orgId} />
}

/* ═══════════════════════════════════════════════
   ADMIN / COACH VIEW
   ═══════════════════════════════════════════════ */
async function AdminEvents({
  userId,
  role,
  orgId,
}: {
  userId: string
  role: UserRole
  orgId: string
}) {
  const supabase = await createClient()

  // Get coaches for the form
  const { data: coachRows } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['admin', 'coach'])
    .order('full_name')

  const coaches = (coachRows || []) as { id: string; full_name: string }[]

  // Get all events with coach info
  const { data: allEvents } = await supabase
    .from('events')
    .select('*, coach:profiles!events_coach_id_fkey(full_name)')
    .order('start_date', { ascending: false })

  type EventRow = {
    id: string
    name: string
    description: string | null
    event_type: string
    start_date: string
    end_date: string
    start_time: string | null
    end_time: string | null
    location: string | null
    max_capacity: number | null
    price: number | null
    age_groups: string[] | null
    coach_id: string | null
    active: boolean
    coach: { full_name: string } | null
  }

  const events = (allEvents || []) as unknown as EventRow[]

  // Get all bookings with player + parent info
  const eventIds = events.map((e) => e.id)
  const { data: allBookings } = eventIds.length > 0
    ? await supabase
        .from('event_bookings')
        .select('id, event_id, player_id, parent_id, status, payment_status, amount_paid, player:players(first_name, last_name), parent:profiles!event_bookings_parent_id_fkey(full_name)')
        .in('event_id', eventIds)
    : { data: [] as never[] }

  type BookingRow = {
    id: string
    event_id: string
    player_id: string
    parent_id: string
    status: string
    payment_status: string
    amount_paid: number
    player: { first_name: string; last_name: string } | null
    parent: { full_name: string } | null
  }

  const bookings = (allBookings || []) as unknown as BookingRow[]

  // Group bookings by event
  const bookingsByEvent: Record<string, BookingRow[]> = {}
  for (const b of bookings) {
    if (!bookingsByEvent[b.event_id]) bookingsByEvent[b.event_id] = []
    bookingsByEvent[b.event_id].push(b)
  }

  // Stats
  const activeEvents = events.filter((e) => e.active)
  const totalBookings = bookings.filter((b) => b.status === 'confirmed').length
  const upcomingEvents = events.filter(
    (e) => e.active && new Date(e.start_date) >= new Date(new Date().toDateString())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events & Holiday Camps</h1>
          <p className="text-sm text-text-light mt-1">
            Create and manage events, camps, tournaments, and workshops.
          </p>
        </div>
        <EventManager coaches={coaches} orgId={orgId} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{events.length}</div>
            <div className="text-xs text-text-light mt-0.5">Total Events</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{upcomingEvents.length}</div>
            <div className="text-xs text-text-light mt-0.5">Upcoming</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalBookings}</div>
            <div className="text-xs text-text-light mt-0.5">Bookings</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{activeEvents.length}</div>
            <div className="text-xs text-text-light mt-0.5">Active</div>
          </div>
        </Card>
      </div>

      {/* Event List */}
      {events.length === 0 ? (
        <EmptyState message="No events created yet. Click '+ Create Event' to get started." />
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const eventBookings = bookingsByEvent[event.id] || []
            const confirmedBookings = eventBookings.filter((b) => b.status === 'confirmed')
            const cancelledBookings = eventBookings.filter((b) => b.status === 'cancelled')
            const waitlistedBookings = eventBookings.filter((b) => b.status === 'waitlisted')
            const spotsLeft = event.max_capacity
              ? event.max_capacity - confirmedBookings.length
              : null
            const isPast = new Date(event.end_date) < new Date(new Date().toDateString())

            return (
              <Card key={event.id} className={!event.active || isPast ? 'opacity-60' : ''}>
                <div className="space-y-3">
                  {/* Event header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{event.name}</h3>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                          {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                        </span>
                        {!event.active && <StatusBadge status="cancelled" />}
                        {isPast && event.active && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">
                            Past
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-text-light mt-1">{event.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">
                        {confirmedBookings.length}
                        {event.max_capacity && (
                          <span className="text-sm font-normal text-text-light">
                            /{event.max_capacity}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-light">booked</div>
                    </div>
                  </div>

                  {/* Event details row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-text-light">
                    <span>
                      {new Date(event.start_date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {event.end_date !== event.start_date && (
                        <>
                          {' '}
                          &ndash;{' '}
                          {new Date(event.end_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </>
                      )}
                    </span>
                    {event.start_time && (
                      <span>
                        {event.start_time}
                        {event.end_time && ` \u2013 ${event.end_time}`}
                      </span>
                    )}
                    {event.location && <span>{event.location}</span>}
                    {event.coach && <span>Coach: {event.coach.full_name}</span>}
                    {event.price != null && event.price > 0 && (
                      <span className="font-semibold text-primary">
                        &pound;{event.price.toFixed(2)}
                      </span>
                    )}
                    {event.age_groups && event.age_groups.length > 0 && (
                      <span>{event.age_groups.join(', ')}</span>
                    )}
                    {spotsLeft !== null && (
                      <span
                        className={`font-medium ${
                          spotsLeft <= 0 ? 'text-danger' : spotsLeft <= 5 ? 'text-warning' : 'text-accent'
                        }`}
                      >
                        {spotsLeft <= 0 ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                      </span>
                    )}
                  </div>

                  {/* Bookings table */}
                  {confirmedBookings.length > 0 && (
                    <div className="pt-2">
                      <div className="text-xs font-medium text-text-light mb-2">
                        Confirmed Bookings ({confirmedBookings.length})
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-1.5 font-medium text-xs">Player</th>
                              <th className="text-left py-1.5 font-medium text-xs">Parent</th>
                              <th className="text-left py-1.5 font-medium text-xs">Payment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {confirmedBookings.map((booking) => (
                              <tr key={booking.id} className="border-b border-border last:border-0">
                                <td className="py-1.5 text-xs">
                                  {booking.player
                                    ? `${booking.player.first_name} ${booking.player.last_name}`
                                    : '\u2014'}
                                </td>
                                <td className="py-1.5 text-xs text-text-light">
                                  {booking.parent?.full_name || '\u2014'}
                                </td>
                                <td className="py-1.5">
                                  <StatusBadge status={booking.payment_status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Waitlisted / Cancelled summary */}
                  {(waitlistedBookings.length > 0 || cancelledBookings.length > 0) && (
                    <div className="flex gap-4 text-xs text-text-light pt-1">
                      {waitlistedBookings.length > 0 && (
                        <span>{waitlistedBookings.length} waitlisted</span>
                      )}
                      {cancelledBookings.length > 0 && (
                        <span>{cancelledBookings.length} cancelled</span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   PARENT VIEW
   ═══════════════════════════════════════════════ */
async function ParentEvents({
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

  const playerIds = (myPlayers || []).map((p) => p.id)

  // Get upcoming active events
  const today = new Date().toISOString().split('T')[0]
  const { data: allEvents } = await supabase
    .from('events')
    .select('*, coach:profiles!events_coach_id_fkey(full_name)')
    .eq('active', true)
    .gte('end_date', today)
    .order('start_date')

  type EventRow = {
    id: string
    name: string
    description: string | null
    event_type: string
    start_date: string
    end_date: string
    start_time: string | null
    end_time: string | null
    location: string | null
    max_capacity: number | null
    price: number | null
    age_groups: string[] | null
    coach_id: string | null
    active: boolean
    coach: { full_name: string } | null
  }

  const events = (allEvents || []) as unknown as EventRow[]

  // Get all bookings for this parent's children
  const { data: allBookings } = playerIds.length > 0
    ? await supabase
        .from('event_bookings')
        .select('id, event_id, player_id, status, payment_status, amount_paid')
        .in('player_id', playerIds)
    : { data: [] as never[] }

  type BookingRow = {
    id: string
    event_id: string
    player_id: string
    status: string
    payment_status: string
    amount_paid: number
  }

  const bookings = (allBookings || []) as unknown as BookingRow[]

  // Build booking lookup: eventId:playerId -> booking
  const bookingLookup: Record<string, BookingRow> = {}
  for (const b of bookings) {
    bookingLookup[`${b.event_id}:${b.player_id}`] = b
  }

  // Get confirmed booking counts per event (all parents)
  const eventIds = events.map((e) => e.id)
  const { data: bookingCounts } = eventIds.length > 0
    ? await supabase
        .from('event_bookings')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('status', 'confirmed')
    : { data: [] as never[] }

  const countByEvent: Record<string, number> = {}
  for (const row of bookingCounts || []) {
    const r = row as { event_id: string }
    countByEvent[r.event_id] = (countByEvent[r.event_id] || 0) + 1
  }

  // Separate into booked and available
  const myBookedEventIds = new Set(
    bookings.filter((b) => b.status === 'confirmed').map((b) => b.event_id)
  )

  const bookedEvents = events.filter((e) => myBookedEventIds.has(e.id))
  const totalBooked = bookings.filter((b) => b.status === 'confirmed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Events & Holiday Camps</h1>
        <p className="text-sm text-text-light mt-1">
          Browse upcoming events and book your children in.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{events.length}</div>
            <div className="text-xs text-text-light mt-0.5">Upcoming Events</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{totalBooked}</div>
            <div className="text-xs text-text-light mt-0.5">Booked</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{(myPlayers || []).length}</div>
            <div className="text-xs text-text-light mt-0.5">Children</div>
          </div>
        </Card>
      </div>

      {/* My Booked Events */}
      {bookedEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Your Booked Events</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bookedEvents.map((event) => {
              const enrolledPlayers = (myPlayers || []).filter(
                (p) => bookingLookup[`${event.id}:${p.id}`]?.status === 'confirmed'
              )

              return (
                <Card key={event.id}>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-sm">{event.name}</div>
                        <div className="text-xs text-text-light">
                          {new Date(event.start_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                          {event.end_date !== event.start_date && (
                            <>
                              {' \u2013 '}
                              {new Date(event.end_date).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </>
                          )}
                          {event.start_time && ` \u00B7 ${event.start_time}`}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                        {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                      </span>
                    </div>

                    {(event.location || event.coach) && (
                      <div className="flex items-center gap-3 text-xs text-text-light">
                        {event.location && <span>{event.location}</span>}
                        {event.coach && <span>Coach: {event.coach.full_name}</span>}
                      </div>
                    )}

                    <div className="pt-1 space-y-1">
                      {enrolledPlayers.map((player) => {
                        const booking = bookingLookup[`${event.id}:${player.id}`]
                        return (
                          <div key={player.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <StatusBadge status="confirmed" />
                              <span className="text-xs font-medium">
                                {player.first_name} {player.last_name}
                              </span>
                            </div>
                            {booking && (
                              <StatusBadge status={booking.payment_status} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* All Upcoming Events */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Upcoming Events</h2>

        {events.length === 0 ? (
          <EmptyState message="No upcoming events at the moment. Check back soon!" />
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const totalConfirmed = countByEvent[event.id] || 0
              const spotsLeft = event.max_capacity
                ? event.max_capacity - totalConfirmed
                : null
              const isFull = spotsLeft !== null && spotsLeft <= 0

              const bookedPlayerIds = (myPlayers || [])
                .filter(
                  (p) => bookingLookup[`${event.id}:${p.id}`]?.status === 'confirmed'
                )
                .map((p) => p.id)

              const availablePlayers = (myPlayers || []).filter(
                (p) => !bookedPlayerIds.includes(p.id)
              )

              const allBooked = availablePlayers.length === 0 && bookedPlayerIds.length > 0

              return (
                <div
                  key={event.id}
                  className={`rounded-xl border p-4 ${
                    allBooked
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-border bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{event.name}</div>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                          {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                        </span>
                        {allBooked && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-medium">
                            Booked
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-text-light mt-1">{event.description}</p>
                      )}
                    </div>
                    {event.price != null && event.price > 0 && (
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">
                          &pound;{event.price.toFixed(2)}
                        </div>
                        <div className="text-xs text-text-light">per player</div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-text-light mb-3">
                    <span>
                      {new Date(event.start_date).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                      {event.end_date !== event.start_date && (
                        <>
                          {' \u2013 '}
                          {new Date(event.end_date).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </>
                      )}
                    </span>
                    {event.start_time && (
                      <span>
                        {event.start_time}
                        {event.end_time && ` \u2013 ${event.end_time}`}
                      </span>
                    )}
                    {event.location && <span>{event.location}</span>}
                    {event.coach && <span>Coach: {event.coach.full_name}</span>}
                    {event.age_groups && event.age_groups.length > 0 && (
                      <span>{event.age_groups.join(', ')}</span>
                    )}
                    {spotsLeft !== null && (
                      <span
                        className={`font-medium ${
                          spotsLeft <= 0 ? 'text-danger' : spotsLeft <= 5 ? 'text-warning' : 'text-accent'
                        }`}
                      >
                        {spotsLeft <= 0
                          ? 'Full'
                          : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                      </span>
                    )}
                  </div>

                  {/* Already booked children */}
                  {bookedPlayerIds.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {(myPlayers || [])
                        .filter((p) => bookedPlayerIds.includes(p.id))
                        .map((p) => (
                          <div key={p.id} className="flex items-center gap-1.5 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                            <span className="text-accent font-medium">
                              {p.first_name} booked
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Book buttons for available children */}
                  {availablePlayers.length > 0 && !isFull && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {availablePlayers.map((player) => (
                        <BookEventButton
                          key={player.id}
                          eventId={event.id}
                          playerId={player.id}
                          playerName={player.first_name}
                          parentId={userId}
                          orgId={orgId}
                          price={event.price}
                        />
                      ))}
                    </div>
                  )}

                  {isFull && availablePlayers.length > 0 && (
                    <div className="text-xs text-danger font-medium pt-1">
                      This event is full. Contact us about the waitlist.
                    </div>
                  )}
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
            Need to cancel a booking or ask about an event? Message your coach via{' '}
            <a href="/dashboard/messages" className="text-accent hover:underline font-medium">
              Messages
            </a>.
          </p>
        </div>
      </Card>
    </div>
  )
}
