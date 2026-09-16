import { NextRequest, NextResponse } from 'next/server'
import { adminClient, getCoaches, getVenues } from '@/lib/one-to-one/db'
import { sendSessionReminder } from '@/lib/one-to-one/emails'
import { addDays, todayLondon } from '@/lib/one-to-one/time'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Daily at 17:00. One reminder per scheduled 1-2-1 session tomorrow, to the
// guest email (ad hoc) or the parent's account email (regular). The class
// reminder crons already skip 1-2-1 class types, so nothing double-sends.
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (process.env.SESSION_REMINDERS_ENABLED === 'false') return NextResponse.json({ skipped: 'off' })
  const admin = adminClient()
  const tomorrow = addDays(todayLondon(), 1)
  const { data: sessions } = await admin.from('coaching_sessions')
    .select('id, organisation_id, coach_id, venue_id, session_date, start_minutes, duration_minutes, guest_email, guest_name, guest_child_name, parent_id, player:players(first_name, last_name), parent:profiles!coaching_sessions_parent_id_fkey(email, full_name)')
    .eq('session_date', tomorrow).eq('status', 'scheduled')
  let sent = 0, skipped = 0
  const byOrg = new Map<string, { coaches: Awaited<ReturnType<typeof getCoaches>>; venues: Awaited<ReturnType<typeof getVenues>>; name: string }>()
  for (const s of sessions ?? []) {
    const parent = s.parent as unknown as { email: string | null; full_name: string | null } | null
    const player = s.player as unknown as { first_name: string; last_name: string } | null
    const to = s.guest_email || parent?.email
    if (!to) { skipped++; continue }
    if (!byOrg.has(s.organisation_id)) {
      const [coaches, venues, org] = await Promise.all([getCoaches(admin, s.organisation_id), getVenues(admin, s.organisation_id), admin.from('organisations').select('name').eq('id', s.organisation_id).single()])
      byOrg.set(s.organisation_id, { coaches, venues, name: (org.data?.name as string) || 'Your academy' })
    }
    const o = byOrg.get(s.organisation_id)!
    const venue = o.venues.find((v) => v.id === s.venue_id)
    const r = await sendSessionReminder({
      academy: o.name, to, parentName: s.guest_name || parent?.full_name || null,
      childName: player ? `${player.first_name}` : s.guest_child_name || 'Your child',
      date: s.session_date, startMinutes: s.start_minutes, durationMinutes: s.duration_minutes,
      coach: o.coaches.find((c) => c.id === s.coach_id)?.full_name?.split(' ')[0] || 'your coach',
      venue: venue?.name || 'the venue', venueAddress: venue?.address,
    }).catch(() => ({ success: false }))
    if ((r as { success?: boolean }).success) sent++; else skipped++
  }
  return NextResponse.json({ date: tomorrow, sent, skipped })
}
