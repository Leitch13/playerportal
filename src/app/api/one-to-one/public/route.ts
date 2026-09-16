import { NextRequest, NextResponse } from 'next/server'
import { adminClient, getCoaches, getVenues, getSettings, loadAvailability } from '@/lib/one-to-one/db'
import { freeSessions, isFree } from '@/lib/one-to-one/availability'
import { addDays, todayLondon } from '@/lib/one-to-one/time'
import { createAdhocCheckout, CheckoutBlocked } from '@/lib/one-to-one/checkout'

export const dynamic = 'force-dynamic'

/**
 * 1-2-1 Slots · the public side (no login).
 *
 *   search   → genuinely free sessions for an academy, from the engine
 *   hold     → 12-minute hold on one of them (atomic in the database)
 *   checkout → Stripe Checkout for that held session (ONE-OFF payment)
 *   request  → "nothing fits" lead
 *
 * Every action is scoped by the academy slug. Regulars are never returned:
 * the engine subtracts them before anything reaches this file.
 */

type Body = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const bad = (m: string, status = 400) => NextResponse.json({ error: m }, { status })
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body
  const action = str(body.action)
  const slug = str(body.slug)
  if (!slug) return bad('Which academy?')
  const admin = adminClient()
  const { data: org } = await admin.from('organisations').select('id, name, slug, is_published, pilot').eq('slug', slug).maybeSingle()
  if (!org || (org.is_published === false && !org.pilot)) return bad('Academy not found', 404)
  const orgId = org.id as string

  try {
    switch (action) {
      case 'search': {
        const today = todayLondon()
        const from = /^\d{4}-\d{2}-\d{2}$/.test(str(body.from)) && str(body.from) >= today ? str(body.from) : today
        const to = addDays(from, 27)
        const weekdays = Array.isArray(body.weekdays) ? (body.weekdays as unknown[]).map(Number).filter((n) => n >= 1 && n <= 7) : []
        const venueIds = Array.isArray(body.venueIds) ? (body.venueIds as unknown[]).map(String) : []
        const after = Number(body.afterMinutes); const before = Number(body.beforeMinutes)
        const [input, coaches, venues, settings] = await Promise.all([
          loadAvailability(admin, orgId, from, to), getCoaches(admin, orgId), getVenues(admin, orgId), getSettings(admin, orgId),
        ])
        const free = freeSessions({ ...input, filters: {
          weekdays: weekdays as (1 | 2 | 3 | 4 | 5 | 6 | 7)[], venueIds,
          afterMinutes: Number.isFinite(after) ? after : undefined, beforeMinutes: Number.isFinite(before) ? before : undefined,
        } })
        const first = (id: string) => coaches.find((c) => c.id === id)?.full_name?.split(' ')[0] || 'Coach'
        return NextResponse.json({
          academy: org.name, pricePence: settings.one_to_one_price_pence, durationMinutes: settings.session_minutes,
          venues: venues.filter((v) => v.is_active).map((v) => ({ id: v.id, name: v.name, address: v.address })),
          sessions: free.slice(0, 60).map((f) => ({
            date: f.date, startMinutes: f.startMinutes, coachId: f.coachId, coach: first(f.coachId),
            venueId: f.venueId, venue: venues.find((v) => v.id === f.venueId)?.name || '',
          })),
          more: free.length > 60,
        })
      }

      case 'hold': {
        const date = str(body.date), coachId = str(body.coachId), venueId = str(body.venueId), start = Number(body.startMinutes)
        const guestName = str(body.guestName), guestEmail = str(body.guestEmail).toLowerCase(), guestPhone = str(body.guestPhone), child = str(body.childName)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !coachId || !venueId || !Number.isFinite(start)) return bad('Pick a session')
        if (!guestName || !EMAIL.test(guestEmail) || !child) return bad('Your name, an email and the child\'s name are needed')
        const input = await loadAvailability(admin, orgId, date, date)
        if (!isFree(input, { date, startMinutes: start, coachId, venueId })) return bad('That session has just gone. Pick another.', 409)
        const settings = await getSettings(admin, orgId)
        const { data, error } = await admin.rpc('hold_session', {
          p_org: orgId, p_coach: coachId, p_venue: venueId, p_date: date, p_start: start, p_duration: settings.session_minutes,
          p_type: 'one_to_one', p_price: settings.one_to_one_price_pence,
          p_guest_name: guestName, p_guest_email: guestEmail, p_guest_phone: guestPhone || null, p_guest_child_name: child,
        })
        if (error) return bad(error.message.includes('SESSION_TAKEN') ? 'That session has just gone. Pick another.' : error.message, 409)
        const row = Array.isArray(data) ? data[0] : data
        return NextResponse.json({ sessionId: row.session_id, holdToken: row.hold_token, holdExpiresAt: row.hold_expires_at })
      }

      case 'checkout': {
        const sessionId = str(body.sessionId), token = str(body.holdToken)
        const { data: s } = await admin.from('coaching_sessions').select('*').eq('id', sessionId).eq('organisation_id', orgId).maybeSingle()
        if (!s || s.hold_token !== token) return bad('Hold not found', 404)
        if (s.status !== 'held') return bad(s.status === 'scheduled' ? 'Already paid' : 'That hold has ended. Pick the session again.', 409)
        if (new Date(s.hold_expires_at).getTime() < Date.now()) return bad('That hold has ended. Pick the session again.', 409)
        const [coaches, venues] = await Promise.all([getCoaches(admin, orgId), getVenues(admin, orgId)])
        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
        const { url, checkoutId } = await createAdhocCheckout({
          admin, orgId, orgName: org.name as string, slug, origin, session: s,
          coachName: coaches.find((c) => c.id === s.coach_id)?.full_name?.split(' ')[0] || 'your coach',
          venueName: venues.find((v) => v.id === s.venue_id)?.name || 'the venue',
        })
        await admin.from('coaching_sessions').update({ stripe_checkout_session_id: checkoutId }).eq('id', s.id)
        return NextResponse.json({ url })
      }

      case 'request': {
        const name = str(body.contactName), email = str(body.contactEmail).toLowerCase()
        if (!name || !EMAIL.test(email)) return bad('Your name and an email are needed')
        const weekdays = Array.isArray(body.weekdays) ? (body.weekdays as unknown[]).map(Number).filter((n) => n >= 1 && n <= 7) : []
        const venueIds = Array.isArray(body.venueIds) ? (body.venueIds as unknown[]).map(String).filter(Boolean) : []
        const after = Number(body.afterMinutes)
        const { error } = await admin.from('session_requests').insert({
          organisation_id: orgId, contact_name: name, contact_email: email, contact_phone: str(body.contactPhone) || null,
          child_name: str(body.childName) || null, child_age_group: str(body.childAgeGroup) || null,
          venue_ids: venueIds, weekdays, after_minutes: Number.isFinite(after) ? after : null, notes: str(body.notes).slice(0, 1000) || null,
        })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      default:
        return bad('Unknown action')
    }
  } catch (e) {
    if (e instanceof CheckoutBlocked) return bad(e.message, e.status)
    const msg = e instanceof Error ? e.message : 'Something went wrong'
    console.error('one-to-one public:', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
