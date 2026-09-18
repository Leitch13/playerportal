import { NextRequest, NextResponse } from 'next/server'
import { adminClient, getCoaches, getVenues } from '@/lib/one-to-one/db'
import { buildIcs, userFromToken, type CalendarEvent } from '@/lib/one-to-one/calendar'
import { addDays, todayLondon } from '@/lib/one-to-one/time'

export const dynamic = 'force-dynamic'

/**
 * 1-2-1 Slots · a read-only calendar feed.
 *
 *   coach   → their own sessions
 *   parent  → their children's sessions
 *   admin   → every 1-2-1 session in the academy
 *
 * The token stands in for the login: phones fetch this with no cookie.
 * Sessions from a month back to four months ahead, so the past stays
 * visible and the roll on the 20th shows up as soon as it lands.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const userId = userFromToken(token.replace(/\.ics$/, ''))
  if (!userId) return new NextResponse('Not found', { status: 404 })

  const admin = adminClient()
  const { data: profile } = await admin.from('profiles').select('role, organisation_id, full_name').eq('id', userId).maybeSingle()
  if (!profile?.organisation_id || !['admin', 'coach', 'parent'].includes(profile.role as string)) return new NextResponse('Not found', { status: 404 })
  const orgId = profile.organisation_id as string
  const role = profile.role as 'admin' | 'coach' | 'parent'

  const today = todayLondon()
  const from = addDays(today, -31), to = addDays(today, 122)
  let q = admin.from('coaching_sessions')
    .select('id, coach_id, venue_id, session_date, start_minutes, duration_minutes, session_type, source, status, guest_child_name, guest_name, player:players(first_name, last_name)')
    .eq('organisation_id', orgId).gte('session_date', from).lte('session_date', to)
    .in('status', ['scheduled', 'attended', 'no_show', 'cancelled'])
  if (role === 'coach') q = q.eq('coach_id', userId)
  if (role === 'parent') q = q.eq('parent_id', userId)
  const [{ data: sessions }, coaches, venues, org] = await Promise.all([
    q.order('session_date').order('start_minutes'), getCoaches(admin, orgId), getVenues(admin, orgId),
    admin.from('organisations').select('name').eq('id', orgId).single(),
  ])
  const academy = (org.data?.name as string) || 'Academy'
  const cname = (id: string) => coaches.find((c) => c.id === id)?.full_name?.split(' ')[0] || 'Coach'

  const events: CalendarEvent[] = (sessions ?? []).map((s) => {
    const player = s.player as unknown as { first_name: string; last_name: string } | null
    const child = player ? `${player.first_name} ${player.last_name?.[0] || ''}`.trim() : s.guest_child_name || s.guest_name || 'Booked'
    const type = s.session_type === 'two_to_one' ? '2-to-1' : '1-to-1'
    const venue = venues.find((v) => v.id === s.venue_id)
    const title = role === 'parent' ? `${type} · ${child} with ${cname(s.coach_id)}` : role === 'coach' ? `${type} · ${child}` : `${type} · ${child} · ${cname(s.coach_id)}`
    const bits = [s.source === 'adhoc' ? 'One-off booking' : 'Regular slot', s.status === 'attended' ? 'Coached' : s.status === 'no_show' ? 'No show' : s.status === 'cancelled' ? 'Cancelled by the academy' : null].filter(Boolean)
    return {
      uid: s.id, date: s.session_date, startMinutes: s.start_minutes, durationMinutes: s.duration_minutes,
      title, location: venue ? [venue.name, venue.address].filter(Boolean).join(', ') : null,
      description: `${academy} · ${bits.join(' · ')}`, cancelled: s.status === 'cancelled',
    }
  })

  const name = role === 'admin' ? `${academy} 1-2-1s` : role === 'coach' ? `My 1-2-1s · ${academy}` : `1-2-1s · ${academy}`
  return new NextResponse(buildIcs(name, events), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="one-to-one.ics"',
      'Cache-Control': 'private, max-age=300',
    },
  })
}
