import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminClient, getVenues, hhmm, fmtDate, DAY } from '@/lib/one-to-one/db'
import { calendarUrl } from '@/lib/one-to-one/calendar'
import { addDays, todayLondon, isoWeekday } from '@/lib/one-to-one/time'
import CoachSessions from './CoachSessions'

export const dynamic = 'force-dynamic'

// A coach's own 1-2-1 page. Their sessions, tick them off, flag a day they
// can't do, offer extra hours, and a calendar feed for their phone. Nothing
// here changes anyone else's timetable; the academy owns that.
export default async function MySessionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  const { data: profile } = await supabase.from('profiles').select('role, organisation_id, full_name').eq('id', user.id).single()
  if (!profile?.organisation_id || !['coach', 'admin'].includes(profile.role as string)) notFound()
  const orgId = profile.organisation_id as string
  const admin = adminClient()
  const today = todayLondon()
  const from = addDays(today, -7), to = addDays(today, 27)

  const [sessions, venues, hours, exceptions, org] = await Promise.all([
    admin.from('coaching_sessions').select('id, venue_id, session_date, start_minutes, duration_minutes, session_type, source, status, note, guest_child_name, guest_name, player:players(first_name, last_name)')
      .eq('organisation_id', orgId).eq('coach_id', user.id).gte('session_date', from).lte('session_date', to)
      .in('status', ['scheduled', 'attended', 'no_show']).order('session_date').order('start_minutes'),
    getVenues(admin, orgId),
    admin.from('coaching_hours').select('id, venue_id, weekday, start_minutes, end_minutes, effective_to').eq('organisation_id', orgId).eq('coach_id', user.id).order('weekday').order('start_minutes'),
    admin.from('coach_hour_exceptions').select('id, venue_id, exception_date, kind, start_minutes, end_minutes, status, note')
      .eq('organisation_id', orgId).eq('coach_id', user.id).gte('exception_date', today).lte('exception_date', addDays(today, 90)).order('exception_date'),
    admin.from('organisations').select('name').eq('id', orgId).single(),
  ])
  const vname = (id: string | null) => venues.find((v) => v.id === id)?.name || ''
  const vaddr = (id: string | null) => venues.find((v) => v.id === id)?.address || null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'

  return (
    <CoachSessions
      academy={(org.data?.name as string) || 'Your academy'}
      coachName={(profile.full_name as string | null)?.split(' ')[0] || 'Coach'}
      today={today}
      calendar={calendarUrl(user.id, appUrl)}
      venues={venues.filter((v) => v.is_active).map((v) => ({ id: v.id, name: v.name }))}
      sessions={(sessions.data ?? []).map((s) => {
        const player = s.player as unknown as { first_name: string; last_name: string } | null
        return {
          id: s.id, date: s.session_date, dateLabel: fmtDate(s.session_date), day: DAY[isoWeekday(s.session_date)], time: hhmm(s.start_minutes), end: hhmm(s.start_minutes + s.duration_minutes),
          child: player ? `${player.first_name} ${player.last_name?.[0] || ''}`.trim() : s.guest_child_name || s.guest_name || 'Booked',
          type: s.session_type === 'two_to_one' ? '2-to-1' : '1-to-1', source: s.source, status: s.status, cover: s.note === 'cover',
          venue: vname(s.venue_id), address: vaddr(s.venue_id),
        }
      })}
      hours={(hours.data ?? []).filter((h) => !h.effective_to || h.effective_to >= today).map((h) => ({ id: h.id, day: DAY[h.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7], from: hhmm(h.start_minutes), to: hhmm(h.end_minutes), venue: vname(h.venue_id) }))}
      exceptions={(exceptions.data ?? []).map((e) => ({
        id: e.id, date: e.exception_date, dateLabel: fmtDate(e.exception_date), kind: e.kind as 'flag' | 'extra' | 'block', status: e.status as 'open' | 'resolved',
        hours: e.start_minutes != null && e.end_minutes != null ? `${hhmm(e.start_minutes)}–${hhmm(e.end_minutes)}` : 'all day', venue: vname(e.venue_id), note: e.note,
      }))}
    />
  )
}
