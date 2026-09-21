import { NextRequest, NextResponse } from 'next/server'
import { NotAdmin, requireAdmin, rollMonth, rollAhead } from '@/lib/one-to-one/db'
import { sendSetupCheckout, markCash, refundCharge, payNowUrl, cancelByAcademy } from '@/lib/one-to-one/money'
import { CheckoutBlocked, paymentsReady, ACADEMY_NOT_READY_MESSAGE } from '@/lib/one-to-one/checkout'
import { sendPaymentFailed } from '@/lib/one-to-one/emails'
import { todayLondon } from '@/lib/one-to-one/time'

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
/** "14:45", "14.45", "1445", "2:45pm", "9am", "16" → minutes since midnight. NaN if it isn't a time. */
const mins = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : NaN
  if (typeof v !== 'string') return NaN
  const t = v.trim().toLowerCase().replace(/\s+/g, '')
  const m = /^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/.exec(t) ?? /^(\d{2})(\d{2})()$/.exec(t)
  if (!m) return NaN
  let h = Number(m[1]); const mi = m[2] ? Number(m[2]) : 0
  if (m[3] === 'pm' && h < 12) h += 12
  if (m[3] === 'am' && h === 12) h = 0
  return h > 24 || mi > 59 ? NaN : h * 60 + mi
}
/** Coaching doesn't happen at 3am. Almost always someone typed 2:45 meaning 14:45. */
const nightTypo = (start: number) => start >= 0 && start < 300
const nightMsg = (start: number) => `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')} is the middle of the night. Times are 24-hour, so quarter to three in the afternoon is 14:45. You can also type 2:45pm.`
const DAY_KEY = ['', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_NAME = ['', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays']
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
            const [a, b] = pair.map(mins); if (!(a >= 0 && b > a && b <= 1440)) return bad('Opening hours must run forwards, like 16:00-19:30')
            if (nightTypo(a)) return bad(nightMsg(a))
          }
        }
        const row = { organisation_id: orgId, name, address: str(body.address) || null, weekly_hours: weekly, is_active: body.isActive !== false }
        const id = str(body.id)
        const q = id ? admin.from('coaching_venues').update(row).eq('id', id).eq('organisation_id', orgId) : admin.from('coaching_venues').insert(row)
        const { error } = await q
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'venue.remove': {
        const id = str(body.id); if (!id) return bad('Which venue?')
        const { data: v } = await admin.from('coaching_venues').select('id, name').eq('id', id).eq('organisation_id', orgId).maybeSingle()
        if (!v) return bad('Venue not found')
        const [{ count: slotCount }, { count: sessCount }] = await Promise.all([
          admin.from('regular_slots').select('id', { count: 'exact', head: true }).eq('venue_id', id).neq('status', 'released'),
          admin.from('coaching_sessions').select('id', { count: 'exact', head: true }).eq('venue_id', id),
        ])
        if ((slotCount || 0) > 0 || (sessCount || 0) > 0) {
          return bad(`${v.name} has ${slotCount || 0} regular${slotCount === 1 ? '' : 's'} and ${sessCount || 0} session${sessCount === 1 ? '' : 's'} on it, so it can't be deleted. Move or release those first, or open Edit and untick "In use" to stop selling time there.`)
        }
        // Nothing depends on it: take its hours, closures and one-off extras with it.
        await admin.from('coaching_hours').delete().eq('venue_id', id).eq('organisation_id', orgId)
        await admin.from('coaching_venue_closures').delete().eq('venue_id', id).eq('organisation_id', orgId)
        await admin.from('coach_hour_exceptions').delete().eq('venue_id', id).eq('organisation_id', orgId)
        await admin.from('regular_slots').delete().eq('venue_id', id).eq('organisation_id', orgId).eq('status', 'released')
        const { error } = await admin.from('coaching_venues').delete().eq('id', id).eq('organisation_id', orgId)
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
        if (!(start >= 0 && end > start && end <= 1440)) return bad('Hours must run forwards, like 16:00 to 19:30')
        if (nightTypo(start)) return bad(nightMsg(start))
        {
          // Free time is the overlap of the coach's hours and the venue's opening hours.
          // Hours outside the venue's would sell nothing, silently — so say so.
          const { data: venue } = await admin.from('coaching_venues').select('name, weekly_hours').eq('id', venueId).eq('organisation_id', orgId).maybeSingle()
          if (!venue) return bad('Venue not found')
          const open = ((venue.weekly_hours as Record<string, [string, string][]> | null)?.[DAY_KEY[weekday]] ?? []).map(([a, b]) => [mins(a), mins(b)] as const)
          const inside = open.some(([a, b]) => start >= a && end <= b)
          if (!inside) {
            const when = open.length ? `open ${open.map(([a, b]) => `${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')} to ${String(Math.floor(b / 60)).padStart(2, '0')}:${String(b % 60).padStart(2, '0')}`).join(' and ')} on ${DAY_NAME[weekday]}` : `not open on ${DAY_NAME[weekday]}`
            return bad(`${venue.name} is ${when}. These hours fall outside that, so nothing would go on sale. Press Edit on the venue and change its opening hours first.`)
          }
        }
        const { error } = await admin.from('coaching_hours').insert({
          organisation_id: orgId, coach_id: coachId, venue_id: venueId, weekday,
          start_minutes: start, end_minutes: end, effective_from: str(body.from) || todayLondon(), effective_to: str(body.to) || null,
        })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'hours.remove': {
        // If nothing was ever booked inside these hours, they were a mistake: delete them.
        // Otherwise end them yesterday, so they vanish now and the history stays true.
        const { data: h } = await admin.from('coaching_hours').select('id, coach_id, venue_id, weekday, start_minutes, end_minutes').eq('id', str(body.id)).eq('organisation_id', orgId).maybeSingle()
        if (!h) return bad('Hours not found')
        const { data: used } = await admin.from('coaching_sessions').select('id, session_date, start_minutes').eq('organisation_id', orgId).eq('coach_id', h.coach_id).eq('venue_id', h.venue_id).gte('start_minutes', h.start_minutes).lt('start_minutes', h.end_minutes).limit(200)
        const everUsed = (used ?? []).some((x) => { const d = new Date(`${x.session_date}T12:00:00Z`).getUTCDay(); return (d === 0 ? 7 : d) === h.weekday })
        const yesterday = new Date(`${todayLondon()}T12:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1)
        const { error } = everUsed
          ? await admin.from('coaching_hours').update({ effective_to: yesterday.toISOString().slice(0, 10) }).eq('id', h.id)
          : await admin.from('coaching_hours').delete().eq('id', h.id)
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
          // Pending until the parent completes set-up (pays the rest of this month and
          // saves a card). The time is protected on the timetable from now.
          status: 'pending', starts_on: startsOn, note: str(body.note) || null,
        }).select('id').single()
        if (error) throw error
        await rollAhead(admin, orgId, startsOn)
        let setup: { url: string; amountPence: number } | null = null
        let setupError: string | null = null
        try { setup = await sendSetupCheckout(admin, orgId, data.id) } catch (e) { setupError = e instanceof Error ? e.message : 'set-up link failed' }
        // The slot is saved either way. If the link could not go, the academy is told so on screen, in their words.
        const warning = setupError ? `Slot saved and the time is held. ${/payment setup/i.test(setupError) ? ACADEMY_NOT_READY_MESSAGE : `No pay link was sent: ${setupError}`}` : null
        return NextResponse.json({ ok: true, id: data.id, setup, setupError, warning })
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
          await rollAhead(admin, orgId, todayLondon())
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

      case 'slot.setup_link': {
        if (!(await paymentsReady(admin, orgId))) return bad(ACADEMY_NOT_READY_MESSAGE)
        const r = await sendSetupCheckout(admin, orgId, str(body.id))
        return NextResponse.json({ ok: true, ...r })
      }

      // ─── the month's money: cash, refund, pay-now, academy cancellation ───
      case 'charge.cash': {
        await markCash(admin, orgId, str(body.id), userId)
        return NextResponse.json({ ok: true })
      }
      case 'charge.refund': {
        await refundCharge(admin, orgId, str(body.id))
        return NextResponse.json({ ok: true })
      }
      case 'charge.remind': {
        const url = await payNowUrl(admin, orgId, str(body.id))
        const { data: c } = await admin.from('coaching_charges').select('parent_id, billing_month, amount_pence, attempt_count, parent:profiles!coaching_charges_parent_id_fkey(email, full_name)').eq('id', str(body.id)).single()
        const { data: o } = await admin.from('organisations').select('name').eq('id', orgId).single()
        const parent = c?.parent as unknown as { email: string | null; full_name: string | null } | null
        if (parent?.email) await sendPaymentFailed({ academy: (o?.name as string) || 'Your academy', to: parent.email, parentName: parent.full_name, monthLabel: new Date(c!.billing_month + 'T12:00:00Z').toLocaleString('en-GB', { month: 'long', year: 'numeric' }), amountPence: c!.amount_pence, attempts: c!.attempt_count, url, lastTry: null })
        return NextResponse.json({ ok: true, url })
      }
      case 'session.academy_cancel': {
        await cancelByAcademy(admin, orgId, str(body.sessionId), str(body.note) || null)
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
    if (e instanceof CheckoutBlocked) return NextResponse.json({ error: e.message }, { status: e.status })
    const msg = e instanceof Error ? e.message : 'Something went wrong'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
