import { NextRequest, NextResponse } from 'next/server'
import { NotAdmin, requireAdmin, rollMonth } from '@/lib/one-to-one/db'
import { hhmmToMinutes, todayLondon } from '@/lib/one-to-one/time'

export const dynamic = 'force-dynamic'

/**
 * 1-2-1 Slots · academy actions (phase 2: NO MONEY).
 *
 * One route, one `action` per request, admin only, always scoped to the
 * caller's own organisation. Everything here edits the timetable or a
 * session's status. Nothing here charges, credits, refunds or talks to
 * Stripe. Those arrive in phase 4 in their own route.
 */

type Body = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : typeof v === 'string' && v !== '' ? Math.round(Number(v)) : NaN)
const mins = (v: unknown) => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v) ? hhmmToMinutes(v) : int(v))
const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 })

export async function POST(req: NextRequest) {
  let ctx
  try { ctx = await requireAdmin() } catch (e) {
    const err = e as NotAdmin
    return NextResponse.json({ error: err.message }, { status: err.status || 403 })
  }
  const { admin, orgId, userId } = ctx
  const body = (await req.json().catch(() => ({}))) as Body
  const action = str(body.action)

  try {
    switch (action) {
      // ─── settings (product config only) ───
      case 'settings.save': {
        const one = int(body.oneToOnePence), two = int(body.twoToOnePence), len = int(body.sessionMinutes)
        if (!(one >= 0 && two >= 0 && len >= 15 && len <= 120)) return bad('Check the prices and session length')
        const { error } = await admin.from('coaching_settings').upsert({
          organisation_id: orgId, one_to_one_price_pence: one, two_to_one_price_pence: two,
          session_minutes: len, cash_allowed: body.cashAllowed !== false,
        })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      // ─── venues ───
      case 'venue.save': {
        const name = str(body.name); if (!name) return bad('Venue needs a name')
        const weekly = body.weeklyHours && typeof body.weeklyHours === 'object' ? body.weeklyHours : {}
        for (const list of Object.values(weekly as Record<string, unknown>)) {
          if (!Array.isArray(list)) return bad('Bad hours')
          for (const pair of list) {
            if (!Array.isArray(pair) || pair.length !== 2) return bad('Bad hours')
            const [a, b] = pair.map(mins); if (!(a >= 0 && b > a && b <= 1440)) return bad('Hours must run forwards')
          }
        }
        const row = { organisation_id: orgId, name, address: str(body.address) || null, weekly_hours: weekly, is_active: body.isActive !== false }
        const id = str(body.id)
        const q = id ? admin.from('coaching_venues').update(row).eq('id', id).eq('organisation_id', orgId) : admin.from('coaching_venues').insert(row)
        const { error } = await q
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'venue.closure.add': {
        const venueId = str(body.venueId), date = str(body.date)
        if (!venueId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('Pick a venue and a date')
        const { error } = await admin.from('coaching_venue_closures').upsert(
          { organisation_id: orgId, venue_id: venueId, closed_on: date, reason: str(body.reason) || null },
          { onConflict: 'venue_id,closed_on' })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'venue.closure.remove': {
        const { error } = await admin.from('coaching_venue_closures').delete().eq('id', str(body.id)).eq('organisation_id', orgId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      // ─── coaching hours (the academy sets them) ───
      case 'hours.add': {
        const coachId = str(body.coachId), venueId = str(body.venueId), weekday = int(body.weekday)
        const start = mins(body.start), end = mins(body.end)
        if (!coachId || !venueId || !(weekday >= 1 && weekday <= 7)) return bad('Pick a coach, a venue and a day')
        if (!(start >= 0 && end > start && end <= 1440)) return bad('Hours must run forwards')
        const { error } = await admin.from('coaching_hours').insert({
          organisation_id: orgId, coach_id: coachId, venue_id: venueId, weekday,
          start_minutes: start, end_minutes: end, effective_from: str(body.from) || todayLondon(), effective_to: str(body.to) || null,
        })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'hours.remove': {
        // The academy removing hours ends them from today; history stays intact.
        const { error } = await admin.from('coaching_hours').update({ effective_to: todayLondon() }).eq('id', str(body.id)).eq('organisation_id', orgId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      // ─── exceptions: block (admin), extra (admin on a coach's behalf), resolve a flag ───
      case 'exception.add': {
        const kind = str(body.kind); if (!['block', 'extra', 'flag'].includes(kind)) return bad('Bad kind')
        const coachId = str(body.coachId), date = str(body.date)
        if (!coachId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('Pick a coach and a date')
        const start = body.start != null && body.start !== '' ? mins(body.start) : null
        const end = body.end != null && body.end !== '' ? mins(body.end) : null
        if ((start == null) !== (end == null)) return bad('Give both a start and an end, or neither')
        if (start != null && end != null && !(end > start)) return bad('Hours must run forwards')
        if (kind === 'extra' && (start == null || !str(body.venueId))) return bad('Extra hours need a venue, a start and an end')
        const { error } = await admin.from('coach_hour_exceptions').insert({
          organisation_id: orgId, coach_id: coachId, venue_id: str(body.venueId) || null, exception_date: date, kind,
          start_minutes: start, end_minutes: end, note: str(body.note) || null, created_by: userId,
          status: kind === 'flag' ? 'open' : 'resolved',
        })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'exception.resolve': {
        const { error } = await admin.from('coach_hour_exceptions')
          .update({ status: 'resolved', resolved_by: userId, resolved_at: new Date().toISOString() })
          .eq('id', str(body.id)).eq('organisation_id', orgId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'exception.remove': {
        const { error } = await admin.from('coach_hour_exceptions').delete().eq('id', str(body.id)).eq('organisation_id', orgId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      // ─── regular slots ───
      case 'slot.create': {
        const playerId = str(body.playerId), coachId = str(body.coachId), venueId = str(body.venueId)
        const weekday = int(body.weekday), start = mins(body.start), price = int(body.pricePence), dur = int(body.durationMinutes)
        const type = str(body.sessionType) === 'two_to_one' ? 'two_to_one' : 'one_to_one'
        const freq = ['weekly', 'fortnightly', 'monthly'].includes(str(body.frequency)) ? str(body.frequency) : 'weekly'
        const startsOn = str(body.startsOn) || todayLondon()
        if (!playerId || !coachId || !venueId || !(weekday >= 1 && weekday <= 7) || !(start >= 0) || !(price >= 0) || !(dur >= 15)) return bad('Fill in the slot')
        const { data: player } = await admin.from('players').select('id, parent_id, organisation_id').eq('id', playerId).single()
        if (!player || player.organisation_id !== orgId) return bad('That child is not in your academy')
        // The coach must actually be free at that time on that day: no double-booking a regular.
        const { data: clash } = await admin.from('regular_slots').select('id').eq('coach_id', coachId).eq('weekday', weekday)
          .eq('start_minutes', start).in('status', ['pending', 'active', 'paused']).limit(1)
        if (clash && clash.length) return bad('That coach already has a regular at that time')
        const { data, error } = await admin.from('regular_slots').insert({
          organisation_id: orgId, player_id: playerId, parent_id: player.parent_id, coach_id: coachId, venue_id: venueId,
          weekday, start_minutes: start, duration_minutes: dur, session_type: type, frequency: freq, price_pence: price,
          // Phase 2 has no money, so a slot the academy creates is live straight away.
          // Phase 4 introduces 'pending' until the parent completes set-up.
          status: 'active', starts_on: startsOn, note: str(body.note) || null,
        }).select('id').single()
        if (error) throw error
        await rollMonth(admin, orgId, startsOn)
        return NextResponse.json({ ok: true, id: data.id })
      }
      case 'slot.status': {
        const status = str(body.status); if (!['active', 'paused', 'released'].includes(status)) return bad('Bad status')
        const id = str(body.id)
        const patch: Record<string, unknown> = { status }
        if (status === 'released') patch.ends_on = todayLondon()
        const { error } = await admin.from('regular_slots').update(patch).eq('id', id).eq('organisation_id', orgId)
        if (error) throw error
        if (status !== 'active') {
          // Future dated sessions from this slot come off the timetable and go back on sale.
          await admin.from('coaching_sessions').update({ status: 'cancelled', note: `slot ${status}` })
            .eq('regular_slot_id', id).eq('status', 'scheduled').gte('session_date', todayLondon())
        } else {
          await rollMonth(admin, orgId, todayLondon())
        }
        return NextResponse.json({ ok: true })
      }
      case 'slot.pair': {
        const a = str(body.slotId), b = str(body.partnerSlotId)
        if (!a || !b || a === b) return bad('Pick two different keepers')
        const { error: e1 } = await admin.from('regular_slots').update({ partner_slot_id: b, session_type: 'two_to_one' }).eq('id', a).eq('organisation_id', orgId)
        const { error: e2 } = await admin.from('regular_slots').update({ partner_slot_id: a, session_type: 'two_to_one' }).eq('id', b).eq('organisation_id', orgId)
        if (e1 || e2) throw e1 || e2
        return NextResponse.json({ ok: true })
      }

      // ─── dated sessions: cover / move / cancel / attended / no-show (no money) ───
      case 'session.cover': {
        const coachId = str(body.coachId); if (!coachId) return bad('Pick a coach')
        const ids = Array.isArray(body.sessionIds) ? (body.sessionIds as string[]) : [str(body.sessionId)]
        const { error } = await admin.from('coaching_sessions').update({ coach_id: coachId, note: 'cover' })
          .in('id', ids).eq('organisation_id', orgId).eq('status', 'scheduled')
        if (error) throw error
        if (str(body.exceptionId)) await admin.from('coach_hour_exceptions').update({ status: 'resolved', resolved_by: userId, resolved_at: new Date().toISOString() }).eq('id', str(body.exceptionId)).eq('organisation_id', orgId)
        return NextResponse.json({ ok: true })
      }
      case 'session.move': {
        const id = str(body.sessionId), date = str(body.date), start = mins(body.start)
        if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !(start >= 0)) return bad('Pick a session, a date and a time')
        const { data: s } = await admin.from('coaching_sessions').select('*').eq('id', id).eq('organisation_id', orgId).single()
        if (!s) return bad('Session not found')
        const coachId = str(body.coachId) || s.coach_id, venueId = str(body.venueId) || s.venue_id
        // New row first (the unique index refuses a clash), then retire the old one.
        const { error: e1 } = await admin.from('coaching_sessions').insert({
          organisation_id: orgId, regular_slot_id: null, coach_id: coachId, venue_id: venueId,
          player_id: s.player_id, parent_id: s.parent_id, session_date: date, start_minutes: start,
          duration_minutes: s.duration_minutes, session_type: s.session_type, source: 'admin', status: 'scheduled',
          charge_state: s.charge_state, price_pence: s.price_pence, cover_of_session_id: s.id,
          guest_name: s.guest_name, guest_email: s.guest_email, guest_phone: s.guest_phone, guest_child_name: s.guest_child_name,
        })
        if (e1) return bad(e1.code === '23505' ? 'That coach is already booked then' : e1.message)
        const { error: e2 } = await admin.from('coaching_sessions').update({ status: 'cancelled', note: `moved to ${date} ${hhmm(start)}` }).eq('id', id)
        if (e2) throw e2
        return NextResponse.json({ ok: true })
      }
      case 'session.status': {
        const status = str(body.status); if (!['attended', 'no_show', 'cancelled', 'scheduled'].includes(status)) return bad('Bad status')
        const { error } = await admin.from('coaching_sessions').update({ status, note: str(body.note) || null })
          .eq('id', str(body.sessionId)).eq('organisation_id', orgId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      // ─── requests ───
      case 'request.status': {
        const status = str(body.status); if (!['open', 'offered', 'closed'].includes(status)) return bad('Bad status')
        const { error } = await admin.from('session_requests')
          .update({ status, resolved_by: status === 'open' ? null : userId, resolved_at: status === 'open' ? null : new Date().toISOString() })
          .eq('id', str(body.id)).eq('organisation_id', orgId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      // ─── the month roll, on demand (the 20th cron arrives in phase 4) ───
      case 'roll': {
        const month = str(body.month) || todayLondon()
        const r = await rollMonth(admin, orgId, month)
        return NextResponse.json({ ok: true, ...r })
      }

      default:
        return bad('Unknown action')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Something went wrong'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
