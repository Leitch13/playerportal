import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/one-to-one/db'
import { hhmmToMinutes, todayLondon } from '@/lib/one-to-one/time'

export const dynamic = 'force-dynamic'

/**
 * 1-2-1 Slots · what a coach can do from their own page.
 *
 *   session.status → tick off their own session: coached, no show, or undo
 *   flag.add       → "I can't do this date / these hours" — lands on the
 *                    academy's Needs attention list as cover needed
 *   flag.remove    → take back an open flag of their own
 *   extra.add      → "I can do these extra hours" — goes on sale at once
 *
 * A coach cannot remove their hours, move a regular, or touch another
 * coach's sessions. Money is nowhere near this file.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!profile?.organisation_id || !['coach', 'admin'].includes(profile.role as string)) return NextResponse.json({ error: 'Coaches only' }, { status: 403 })
  const orgId = profile.organisation_id as string
  const admin = adminClient()
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const mins = (v: unknown) => { try { return hhmmToMinutes(str(v)) } catch { return -1 } }
  const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 })
  const today = todayLondon()

  try {
    switch (body.action) {
      case 'session.status': {
        const status = str(body.status)
        if (!['attended', 'no_show', 'scheduled'].includes(status)) return bad('Bad status')
        const { data: s } = await admin.from('coaching_sessions').select('id, coach_id, session_date, status').eq('id', str(body.sessionId)).eq('organisation_id', orgId).maybeSingle()
        if (!s || s.coach_id !== user.id) return NextResponse.json({ error: 'Not your session' }, { status: 404 })
        if (s.session_date > today) return bad('That session hasn\'t happened yet')
        if (!['scheduled', 'attended', 'no_show'].includes(s.status)) return bad('That session can\'t be changed')
        const { error } = await admin.from('coaching_sessions').update({ status }).eq('id', s.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'flag.add': {
        const date = str(body.date)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) return bad('Pick a date from today on')
        const start = str(body.start) ? mins(body.start) : null
        const end = str(body.end) ? mins(body.end) : null
        if ((start == null) !== (end == null)) return bad('Give both a start and an end, or leave both blank for the whole day')
        if (start != null && end != null && !(start >= 0 && end > start && end <= 1440)) return bad('Hours must run forwards')
        const { error } = await admin.from('coach_hour_exceptions').insert({
          organisation_id: orgId, coach_id: user.id, venue_id: null, exception_date: date, kind: 'flag',
          start_minutes: start, end_minutes: end, note: str(body.note) || null, created_by: user.id, status: 'open',
        })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'flag.remove': {
        const { error } = await admin.from('coach_hour_exceptions').delete()
          .eq('id', str(body.id)).eq('organisation_id', orgId).eq('coach_id', user.id).eq('kind', 'flag').eq('status', 'open')
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'extra.add': {
        const date = str(body.date), venueId = str(body.venueId)
        const start = mins(body.start), end = mins(body.end)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) return bad('Pick a date from today on')
        if (!venueId) return bad('Pick a venue')
        if (!(start >= 0 && end > start && end <= 1440)) return bad('Hours must run forwards')
        const { data: venue } = await admin.from('coaching_venues').select('id').eq('id', venueId).eq('organisation_id', orgId).eq('is_active', true).maybeSingle()
        if (!venue) return bad('That venue isn\'t in use')
        const { error } = await admin.from('coach_hour_exceptions').insert({
          organisation_id: orgId, coach_id: user.id, venue_id: venueId, exception_date: date, kind: 'extra',
          start_minutes: start, end_minutes: end, note: str(body.note) || null, created_by: user.id, status: 'resolved',
        })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    console.error('one-to-one coach:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
