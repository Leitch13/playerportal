/**
 * 1-2-1 Slots · data layer (server only).
 *
 * Everything the academy pages and the admin route need to read or write.
 * Uses the service-role client after the caller has proven they are an admin
 * of the organisation (see requireAdmin). No Stripe here. No imports from
 * src/lib/billing, ever.
 */

import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { freeSessions, type AvailabilityInput, type FreeSession, type WeeklyHours } from './availability'
import { occurrences, type SlotRule } from './roll'
import { addDays, monthEnd, monthStart, nextMonthStart, todayLondon, type Weekday } from './time'

// ─── auth ───────────────────────────────────────────────────────────────

export interface AdminContext {
  userId: string
  orgId: string
  admin: SupabaseClient
}

export class NotAdmin extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Proves the caller is an admin and returns a service-role client scoped by convention to their org. */
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new NotAdmin('Sign in required', 401)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin' || !profile.organisation_id) throw new NotAdmin('Admins only', 403)
  return { userId: user.id, orgId: profile.organisation_id as string, admin: adminClient() }
}

export function adminClient(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ─── row types ──────────────────────────────────────────────────────────

export interface SettingsRow {
  organisation_id: string
  one_to_one_price_pence: number
  two_to_one_price_pence: number
  session_minutes: number
  cash_allowed: boolean
}
export interface VenueRowDb { id: string; name: string; address: string | null; weekly_hours: WeeklyHours; is_active: boolean }
export interface ClosureRowDb { id: string; venue_id: string; closed_on: string; reason: string | null }
export interface CoachRow { id: string; full_name: string | null; email: string | null }
export interface HoursRowDb {
  id: string; coach_id: string; venue_id: string; weekday: Weekday
  start_minutes: number; end_minutes: number; effective_from: string; effective_to: string | null
}
export interface ExceptionRowDb {
  id: string; coach_id: string; venue_id: string | null; exception_date: string
  kind: 'flag' | 'extra' | 'block'; start_minutes: number | null; end_minutes: number | null
  status: 'open' | 'resolved'; note: string | null; created_at: string
}
export interface SlotRowDb {
  id: string; player_id: string; parent_id: string; coach_id: string; venue_id: string
  weekday: Weekday; start_minutes: number; duration_minutes: number
  session_type: 'one_to_one' | 'two_to_one'; frequency: 'weekly' | 'fortnightly' | 'monthly'
  price_pence: number; status: 'pending' | 'active' | 'paused' | 'released'
  partner_slot_id: string | null; starts_on: string; ends_on: string | null; note: string | null
  player?: { first_name: string; last_name: string } | null
  parent?: { full_name: string | null; email: string | null } | null
}
export interface SessionRowDb {
  id: string; regular_slot_id: string | null; coach_id: string; venue_id: string
  player_id: string | null; parent_id: string | null
  session_date: string; start_minutes: number; duration_minutes: number
  session_type: 'one_to_one' | 'two_to_one'; source: 'regular' | 'adhoc' | 'admin'
  status: 'held' | 'scheduled' | 'declined' | 'cancelled' | 'attended' | 'no_show'
  charge_state: string; price_pence: number
  guest_name: string | null; guest_child_name: string | null; note: string | null
  player?: { first_name: string; last_name: string } | null
}
export interface RequestRowDb {
  id: string; contact_name: string; contact_email: string; contact_phone: string | null
  child_name: string | null; child_age_group: string | null; venue_ids: string[]; weekdays: number[]
  after_minutes: number | null; notes: string | null; status: 'open' | 'offered' | 'closed'; created_at: string
}

// ─── reads ──────────────────────────────────────────────────────────────

export async function getSettings(admin: SupabaseClient, orgId: string): Promise<SettingsRow> {
  const { data } = await admin.from('coaching_settings').select('*').eq('organisation_id', orgId).maybeSingle()
  return (data as SettingsRow | null) ?? {
    organisation_id: orgId, one_to_one_price_pence: 3500, two_to_one_price_pence: 2500, session_minutes: 30, cash_allowed: true,
  }
}

export async function getVenues(admin: SupabaseClient, orgId: string): Promise<VenueRowDb[]> {
  const { data } = await admin.from('coaching_venues').select('id, name, address, weekly_hours, is_active').eq('organisation_id', orgId).order('name')
  return (data as VenueRowDb[]) ?? []
}

export async function getClosures(admin: SupabaseClient, orgId: string, from: string, to: string): Promise<ClosureRowDb[]> {
  const { data } = await admin.from('coaching_venue_closures').select('id, venue_id, closed_on, reason')
    .eq('organisation_id', orgId).gte('closed_on', from).lte('closed_on', to).order('closed_on')
  return (data as ClosureRowDb[]) ?? []
}

/** Coaches = admin and coach profiles in the org. An owner who coaches is a coach too. */
export async function getCoaches(admin: SupabaseClient, orgId: string): Promise<CoachRow[]> {
  const { data } = await admin.from('profiles').select('id, full_name, email, role')
    .eq('organisation_id', orgId).in('role', ['admin', 'coach']).order('full_name')
  return ((data ?? []) as (CoachRow & { role: string })[]).map(({ id, full_name, email }) => ({ id, full_name, email }))
}

export async function getHours(admin: SupabaseClient, orgId: string): Promise<HoursRowDb[]> {
  const { data } = await admin.from('coaching_hours')
    .select('id, coach_id, venue_id, weekday, start_minutes, end_minutes, effective_from, effective_to')
    .eq('organisation_id', orgId).order('weekday').order('start_minutes')
  return (data as HoursRowDb[]) ?? []
}

export async function getExceptions(admin: SupabaseClient, orgId: string, from: string, to: string): Promise<ExceptionRowDb[]> {
  const { data } = await admin.from('coach_hour_exceptions').select('*')
    .eq('organisation_id', orgId).gte('exception_date', from).lte('exception_date', to).order('exception_date')
  return (data as ExceptionRowDb[]) ?? []
}

export async function getSlots(admin: SupabaseClient, orgId: string): Promise<SlotRowDb[]> {
  const { data } = await admin.from('regular_slots')
    .select('*, player:players(first_name, last_name), parent:profiles!regular_slots_parent_id_fkey(full_name, email)')
    .eq('organisation_id', orgId).order('weekday').order('start_minutes')
  return (data as SlotRowDb[]) ?? []
}

export async function getSessions(admin: SupabaseClient, orgId: string, from: string, to: string): Promise<SessionRowDb[]> {
  const { data } = await admin.from('coaching_sessions').select('*, player:players(first_name, last_name)')
    .eq('organisation_id', orgId).gte('session_date', from).lte('session_date', to).order('session_date').order('start_minutes')
  return (data as SessionRowDb[]) ?? []
}

export async function getRequests(admin: SupabaseClient, orgId: string): Promise<RequestRowDb[]> {
  const { data } = await admin.from('session_requests').select('*').eq('organisation_id', orgId).neq('status', 'closed').order('created_at')
  return (data as RequestRowDb[]) ?? []
}

/** Everything the engine needs for a window, straight from the tables. */
export async function loadAvailability(admin: SupabaseClient, orgId: string, from: string, to: string, now = new Date()): Promise<AvailabilityInput> {
  const [settings, venues, closures, hours, exceptions, sessions] = await Promise.all([
    getSettings(admin, orgId), getVenues(admin, orgId), getClosures(admin, orgId, from, to),
    getHours(admin, orgId), getExceptions(admin, orgId, from, to), getSessions(admin, orgId, from, to),
  ])
  return {
    from, to, now,
    durationMinutes: settings.session_minutes,
    venues: venues.map((v) => ({ id: v.id, weeklyHours: v.weekly_hours ?? {}, isActive: v.is_active })),
    closures: closures.map((c) => ({ venueId: c.venue_id, closedOn: c.closed_on })),
    coachHours: hours.map((h) => ({
      coachId: h.coach_id, venueId: h.venue_id, weekday: h.weekday,
      startMinutes: h.start_minutes, endMinutes: h.end_minutes, effectiveFrom: h.effective_from, effectiveTo: h.effective_to,
    })),
    exceptions: exceptions.map((e) => ({
      coachId: e.coach_id, date: e.exception_date, kind: e.kind, venueId: e.venue_id,
      startMinutes: e.start_minutes, endMinutes: e.end_minutes, status: e.status,
    })),
    sessions: sessions.map((s) => ({
      coachId: s.coach_id, date: s.session_date, startMinutes: s.start_minutes, durationMinutes: s.duration_minutes, status: s.status,
    })),
  }
}

export async function freeSessionsFor(admin: SupabaseClient, orgId: string, from: string, to: string): Promise<FreeSession[]> {
  return freeSessions(await loadAvailability(admin, orgId, from, to))
}

// ─── the month roll (idempotent) ────────────────────────────────────────

/**
 * Turn every active/pending regular slot into dated session rows for a month.
 * Upserts on (regular_slot_id, session_date) so running it twice changes nothing.
 * Never touches money: charge_state stays 'unpaid' for the billing phase to pick up.
 */
/**
 * Roll for a slot that has just been created or resumed. The monthly job rolls NEXT
 * month on the 20th, so a slot that appears on the 20th or later has missed it:
 * without this its next month would have no sessions, no charge on the 1st, and its
 * time would go on sale to the public. Idempotent, like every roll.
 */
export async function rollAhead(admin: SupabaseClient, orgId: string, fromDate: string): Promise<void> {
  await rollMonth(admin, orgId, fromDate)
  const today = todayLondon()
  if (Number(today.slice(8, 10)) >= 20) await rollMonth(admin, orgId, nextMonthStart(today))
}

export async function rollMonth(admin: SupabaseClient, orgId: string, anyDateInMonth: string): Promise<{ created: number; month: string }> {
  const from = monthStart(anyDateInMonth), to = monthEnd(anyDateInMonth)
  const slots = await getSlots(admin, orgId)
  const rows: Record<string, unknown>[] = []
  for (const s of slots) {
    const rule: SlotRule = {
      id: s.id, weekday: s.weekday, startMinutes: s.start_minutes, durationMinutes: s.duration_minutes,
      frequency: s.frequency, startsOn: s.starts_on, endsOn: s.ends_on, status: s.status,
    }
    for (const date of occurrences(rule, from, to)) {
      rows.push({
        organisation_id: orgId, regular_slot_id: s.id, coach_id: s.coach_id, venue_id: s.venue_id,
        player_id: s.player_id, parent_id: s.parent_id, session_date: date,
        start_minutes: s.start_minutes, duration_minutes: s.duration_minutes, session_type: s.session_type,
        source: 'regular', status: 'scheduled', charge_state: 'unpaid', price_pence: s.price_pence,
      })
    }
  }
  if (!rows.length) return { created: 0, month: from }
  // The uniqueness index on (regular_slot_id, session_date) is PARTIAL (live rows
  // only), which ON CONFLICT cannot target through the client. So: read what is
  // already there for these slots this month and insert only the missing dates.
  // Existing rows (declined / moved / attended / cancelled) are never touched.
  const { data: existing } = await admin.from('coaching_sessions')
    .select('regular_slot_id, session_date')
    .eq('organisation_id', orgId).gte('session_date', from).lte('session_date', to)
    .not('regular_slot_id', 'is', null)
  const have = new Set((existing ?? []).map((r) => `${r.regular_slot_id}|${r.session_date}`))
  const missing = rows.filter((r) => !have.has(`${r.regular_slot_id}|${r.session_date}`))
  if (!missing.length) return { created: 0, month: from }
  const { error, data } = await admin.from('coaching_sessions').insert(missing).select('id')
  if (error) {
    // 23505 = a concurrent roll got there first for one of these dates. That is fine: nothing is lost.
    if (error.code === '23505') return { created: 0, month: from }
    throw new Error(error.message)
  }
  return { created: data?.length ?? 0, month: from }
}

// ─── Needs attention (a query, not a table) ─────────────────────────────

export interface AttentionItem {
  key: string
  kind: 'cover' | 'closure' | 'request' | 'unpaid' | 'pair' | 'hold' | 'charge'
  title: string
  detail: string
  date?: string
  ids: Record<string, string | string[]>
}

export async function needsAttention(admin: SupabaseClient, orgId: string): Promise<AttentionItem[]> {
  const today = todayLondon()
  const horizon = addDays(today, 60)
  const [exceptions, closures, sessions, requests, slots, coaches, venues] = await Promise.all([
    getExceptions(admin, orgId, today, horizon), getClosures(admin, orgId, today, horizon),
    getSessions(admin, orgId, today, horizon), getRequests(admin, orgId), getSlots(admin, orgId),
    getCoaches(admin, orgId), getVenues(admin, orgId),
  ])
  const coachName = (id: string) => coaches.find((c) => c.id === id)?.full_name || 'Coach'
  const venueName = (id: string) => venues.find((v) => v.id === id)?.name || 'venue'
  const live = sessions.filter((s) => s.status === 'scheduled')
  const items: AttentionItem[] = []

  for (const e of exceptions.filter((x) => x.kind === 'flag' && x.status === 'open')) {
    const hit = live.filter((s) => s.coach_id === e.coach_id && s.session_date === e.exception_date &&
      (e.start_minutes == null || (s.start_minutes < (e.end_minutes ?? 1440) && s.start_minutes + s.duration_minutes > (e.start_minutes ?? 0))))
    items.push({
      key: `flag:${e.id}`, kind: 'cover', date: e.exception_date,
      title: `${coachName(e.coach_id)} can't coach ${fmtDate(e.exception_date)}${e.start_minutes != null ? ` ${hhmm(e.start_minutes)}–${hhmm(e.end_minutes!)}` : ''} · ${hit.length} session${hit.length === 1 ? '' : 's'} affected`,
      detail: (e.note ? `Reason given: ${e.note.replace(/\.$/, '')}. ` : '') + (hit.length ? 'Parents have not been told. Offer cover, move the sessions, or credit them.' : 'Nothing booked in that window. Mark it sorted to clear it.'),
      ids: { exceptionId: e.id, coachId: e.coach_id, sessionIds: hit.map((s) => s.id) },
    })
  }
  for (const c of closures) {
    const hit = live.filter((s) => s.venue_id === c.venue_id && s.session_date === c.closed_on)
    if (!hit.length) continue
    items.push({
      key: `closure:${c.id}`, kind: 'closure', date: c.closed_on,
      title: `${venueName(c.venue_id)} closed ${fmtDate(c.closed_on)} · ${hit.length} session${hit.length === 1 ? '' : 's'}`,
      detail: `${c.reason ? c.reason + '. ' : ''}Move them to another venue or credit them.`,
      ids: { closureId: c.id, sessionIds: hit.map((s) => s.id) },
    })
  }
  for (const r of requests) {
    items.push({
      key: `req:${r.id}`, kind: 'request', date: r.created_at.slice(0, 10),
      title: `Session request · ${r.contact_name}${r.child_name ? ` for ${r.child_name}` : ''}`,
      detail: [r.venue_ids.length ? r.venue_ids.map(venueName).join(', ') : 'any venue',
        r.weekdays.length ? r.weekdays.map((d) => DAY[d]).join('/') : 'any day',
        r.after_minutes != null ? `after ${hhmm(r.after_minutes)}` : '', r.notes || ''].filter(Boolean).join(' · '),
      ids: { requestId: r.id },
    })
  }
  const waiting = slots.filter((s) => s.session_type === 'two_to_one' && !s.partner_slot_id && s.status !== 'released')
  if (waiting.length >= 1) {
    items.push({
      key: 'pair', kind: 'pair',
      title: `${waiting.length} keeper${waiting.length === 1 ? '' : 's'} waiting for a 2-to-1 partner`,
      detail: waiting.map((s) => `${s.player?.first_name ?? 'Child'} (${DAY[s.weekday]} ${hhmm(s.start_minutes)})`).join(', '),
      ids: { slotIds: waiting.map((s) => s.id) },
    })
  }
  // Months the saved card couldn't pay, retries exhausted (or none scheduled): the academy decides.
  const { data: failed } = await admin.from('coaching_charges')
    .select('id, parent_id, billing_month, amount_pence, attempt_count, failure_message, next_attempt_on, parent:profiles!coaching_charges_parent_id_fkey(full_name, email)')
    .eq('organisation_id', orgId).eq('status', 'failed')
  for (const c of failed ?? []) {
    const parent = c.parent as unknown as { full_name: string | null; email: string | null } | null
    const theirs = slots.filter((s) => s.parent_id === c.parent_id && s.status !== 'released')
    const kids = [...new Set(theirs.map((s) => s.player?.first_name).filter(Boolean))]
    const dueAgain = c.next_attempt_on && c.next_attempt_on > today
    items.push({
      key: `charge:${c.id}`, kind: 'charge', date: c.billing_month,
      title: `${kids.join(' & ') || parent?.full_name || 'A parent'} · ${new Date(c.billing_month + 'T12:00:00Z').toLocaleString('en-GB', { month: 'long' })} unpaid, ${gbp(c.amount_pence)}`,
      detail: `${parent?.full_name || ''}${parent?.email ? ` (${parent.email})` : ''}. Card declined ${c.attempt_count} time${c.attempt_count === 1 ? '' : 's'}${c.failure_message ? `: ${c.failure_message.replace(/\.$/, '')}` : ''}. ${dueAgain ? `Retrying on the ${c.next_attempt_on!.slice(8)}. ` : 'No more automatic retries. '}Send the pay link, mark cash, or release the slot.`,
      ids: { chargeId: c.id, parentId: c.parent_id, slotIds: theirs.map((s) => s.id), slotLabels: theirs.map((s) => `${s.player?.first_name ?? 'Child'} ${DAY[s.weekday]} ${hhmm(s.start_minutes)}`) },
    })
  }
  const pending = slots.filter((s) => s.status === 'pending')
  for (const s of pending) {
    items.push({
      key: `pending:${s.id}`, kind: 'unpaid', date: s.starts_on,
      title: `${s.player?.first_name ?? 'Child'} ${s.player?.last_name ?? ''} · slot set up, parent hasn't confirmed`,
      detail: `${DAY[s.weekday]} ${hhmm(s.start_minutes)} with ${coachName(s.coach_id)} at ${venueName(s.venue_id)}. The time is held. Activates when the parent pays the set-up link.`,
      ids: { slotId: s.id },
    })
  }
  items.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
  return items
}

export const DAY: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' }
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
export const fmtShort = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
export const gbp = (pence: number) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`
