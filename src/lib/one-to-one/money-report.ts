import type { SupabaseClient } from '@supabase/supabase-js'
import { oneToOnePaidOn } from '../analytics-revenue'

/**
 * 1-2-1 money where an academy looks for money: Payments, Analytics and Exports.
 *
 * 1-2-1 money lives in coaching_charges (a family's month) and on one-off sessions,
 * not in `payments`, so the Payments page, the exports and Analytics never listed it:
 * No.1 couldn't find their £350 of card payments or the £2,230 waiting on set-up
 * links anywhere (John, 19 Oct 2026: "can he see properly on analytics and reports
 * finances payments?" … "build now").
 *
 * Reporting only. Nothing here charges, refunds or changes anything.
 */

export type OneToOneMoneyStatus = 'paid' | 'paid_cash' | 'waiting' | 'failed' | 'refunded' | 'covered'

export interface OneToOneMoneyRow {
  id: string
  kind: 'month' | 'one_off'
  /** The day it was paid, or for money not paid yet the month it is for. */
  date: string
  parentId: string | null
  parentName: string
  email: string | null
  children: string
  what: string
  amountPence: number
  status: OneToOneMoneyStatus
}

export const STATUS_LABEL: Record<OneToOneMoneyStatus, string> = {
  paid: 'Paid by card', paid_cash: 'Paid in cash', waiting: 'Waiting to be paid', failed: 'Card failed', refunded: 'Refunded', covered: 'Covered by credit',
}

export interface ChargeIn {
  id: string; parent_id: string; billing_month: string; status: string; amount_pence: number | null
  cash_received_at: string | null; updated_at: string | null; created_at: string
}
export interface OneOffIn {
  id: string; parent_id: string | null; player_id: string | null; session_date: string; start_minutes: number; price_pence: number
  charge_state: string; guest_name: string | null; guest_email: string | null; guest_child_name: string | null; updated_at: string | null; created_at: string
}
export interface People { parents: Map<string, { name: string; email: string | null }>; childrenByCharge: Map<string, string[]>; childNames: Map<string, string> }

const monthWord = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayWord = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function chargeStatus(s: string, amountPence: number): OneToOneMoneyStatus {
  if (s === 'paid_online') return 'paid'
  if (s === 'paid_cash') return 'paid_cash'
  if (s === 'failed') return 'failed'
  if (s === 'refunded') return 'refunded'
  if (s === 'waived' || amountPence === 0) return 'covered'
  return 'waiting'
}

/** Turn charge and one-off rows into one list, newest first. Pure, so it is tested. */
export function toMoneyRows(charges: ChargeIn[], oneOffs: OneOffIn[], people: People): OneToOneMoneyRow[] {
  const rows: OneToOneMoneyRow[] = []
  for (const c of charges) {
    const amount = c.amount_pence || 0
    const status = chargeStatus(c.status, amount)
    const paid = status === 'paid' || status === 'paid_cash'
    const p = people.parents.get(c.parent_id)
    rows.push({
      id: c.id, kind: 'month', date: paid ? oneToOnePaidOn(c).slice(0, 10) : c.billing_month.slice(0, 10),
      parentId: c.parent_id, parentName: p?.name || '—', email: p?.email || null,
      children: [...new Set(people.childrenByCharge.get(c.id) || [])].join(', ') || '—',
      what: `1-2-1s · ${monthWord(c.billing_month)}`, amountPence: amount, status,
    })
  }
  for (const s of oneOffs) {
    const status: OneToOneMoneyStatus = s.charge_state === 'paid_cash' ? 'paid_cash' : s.charge_state === 'refunded' ? 'refunded' : 'paid'
    const p = s.parent_id ? people.parents.get(s.parent_id) : undefined
    rows.push({
      id: s.id, kind: 'one_off', date: (s.updated_at || s.created_at).slice(0, 10),
      parentId: s.parent_id, parentName: p?.name || s.guest_name || '—', email: p?.email || s.guest_email || null,
      children: (s.player_id && people.childNames.get(s.player_id)) || s.guest_child_name || '—',
      what: `1-2-1 booked · ${dayWord(s.session_date)} ${hhmm(s.start_minutes)}`, amountPence: s.price_pence || 0, status,
    })
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export function summarise(rows: OneToOneMoneyRow[]) {
  const sum = (f: (r: OneToOneMoneyRow) => boolean) => rows.filter(f).reduce((a, r) => a + r.amountPence, 0)
  return {
    paidPence: sum((r) => r.status === 'paid' || r.status === 'paid_cash'),
    waitingPence: sum((r) => r.status === 'waiting'),
    failedPence: sum((r) => r.status === 'failed'),
    waitingCount: rows.filter((r) => r.status === 'waiting').length,
    failedCount: rows.filter((r) => r.status === 'failed').length,
  }
}

/** Every 1-2-1 money row for an academy. `parentIds` narrows to a search. Use a service client after the admin check. */
export async function loadOneToOneMoney(admin: SupabaseClient, orgId: string, opts: { parentIds?: string[] } = {}): Promise<OneToOneMoneyRow[]> {
  let cq = admin.from('coaching_charges').select('id, parent_id, billing_month, status, amount_pence, cash_received_at, updated_at, created_at').eq('organisation_id', orgId)
  let oq = admin.from('coaching_sessions').select('id, parent_id, player_id, session_date, start_minutes, price_pence, charge_state, guest_name, guest_email, guest_child_name, updated_at, created_at')
    .eq('organisation_id', orgId).neq('source', 'regular').in('charge_state', ['paid_online', 'paid_cash', 'refunded']).is('charge_id', null)
  if (opts.parentIds) {
    if (!opts.parentIds.length) return []
    cq = cq.in('parent_id', opts.parentIds); oq = oq.in('parent_id', opts.parentIds)
  }
  const [{ data: charges }, { data: oneOffs }] = await Promise.all([cq.limit(5000), oq.limit(5000)])
  const chargeIds = (charges ?? []).map((c) => c.id as string)
  const { data: linked } = chargeIds.length ? await admin.from('coaching_sessions').select('charge_id, player_id').in('charge_id', chargeIds) : { data: [] }
  const parentIds = [...new Set([...(charges ?? []).map((c) => c.parent_id as string), ...(oneOffs ?? []).map((s) => s.parent_id as string | null).filter(Boolean) as string[]])]
  // A month not paid yet has no sessions tied to it, so its child comes from the family's sessions that month.
  const linkedIds = new Set((linked ?? []).map((l) => l.charge_id as string))
  const unlinked = (charges ?? []).filter((c) => !linkedIds.has(c.id as string))
  const { data: famSessions } = unlinked.length
    ? await admin.from('coaching_sessions').select('parent_id, player_id, session_date').eq('organisation_id', orgId).in('parent_id', [...new Set(unlinked.map((c) => c.parent_id as string))]).not('player_id', 'is', null).limit(5000)
    : { data: [] }
  const playerIds = [...new Set([...(linked ?? []).map((l) => l.player_id as string | null), ...(oneOffs ?? []).map((s) => s.player_id as string | null), ...(famSessions ?? []).map((f) => f.player_id as string | null)].filter(Boolean) as string[])]
  const [{ data: ps }, { data: kids }] = await Promise.all([
    parentIds.length ? admin.from('profiles').select('id, full_name, email').in('id', parentIds) : Promise.resolve({ data: [] }),
    playerIds.length ? admin.from('players').select('id, first_name, last_name').in('id', playerIds) : Promise.resolve({ data: [] }),
  ])
  const childNames = new Map((kids ?? []).map((k) => [k.id as string, `${k.first_name} ${k.last_name || ''}`.trim()]))
  const childrenByCharge = new Map<string, string[]>()
  for (const l of linked ?? []) {
    const n = l.player_id ? childNames.get(l.player_id as string) : null
    if (n) childrenByCharge.set(l.charge_id as string, [...(childrenByCharge.get(l.charge_id as string) || []), n])
  }
  for (const c of unlinked) {
    const m = (c.billing_month as string).slice(0, 7)
    const names = (famSessions ?? []).filter((f) => f.parent_id === c.parent_id && (f.session_date as string).slice(0, 7) === m).map((f) => childNames.get(f.player_id as string)).filter(Boolean) as string[]
    if (names.length) childrenByCharge.set(c.id as string, names)
  }
  const parents = new Map((ps ?? []).map((p) => [p.id as string, { name: (p.full_name as string) || '—', email: (p.email as string | null) || null }]))
  return toMoneyRows((charges ?? []) as ChargeIn[], (oneOffs ?? []) as OneOffIn[], { parents, childrenByCharge, childNames })
}

/** Sessions per coach for a month, and past sessions nobody has marked Coached or No show. */
export async function loadOneToOneActivity(admin: SupabaseClient, orgId: string, monthStartIso: string, monthEndIso: string, todayIso: string) {
  const [{ data: month }, { data: unmarked }, { data: slots }] = await Promise.all([
    admin.from('coaching_sessions').select('coach_id, status').eq('organisation_id', orgId).gte('session_date', monthStartIso).lte('session_date', monthEndIso).in('status', ['scheduled', 'attended', 'no_show']),
    admin.from('coaching_sessions').select('id', { count: 'exact', head: false }).eq('organisation_id', orgId).eq('status', 'scheduled').lt('session_date', todayIso).limit(1000),
    admin.from('regular_slots').select('status').eq('organisation_id', orgId).in('status', ['active', 'paused', 'pending']),
  ])
  const coachIds = [...new Set((month ?? []).map((m) => m.coach_id as string))]
  const { data: coaches } = coachIds.length ? await admin.from('profiles').select('id, full_name, email').in('id', coachIds) : { data: [] }
  const name = new Map((coaches ?? []).map((c) => [c.id as string, (c.full_name as string) || (c.email as string) || 'Coach']))
  const perCoach = new Map<string, number>()
  for (const m of month ?? []) perCoach.set(name.get(m.coach_id as string) || 'Coach', (perCoach.get(name.get(m.coach_id as string) || 'Coach') || 0) + 1)
  return {
    perCoach: [...perCoach.entries()].sort((a, b) => b[1] - a[1]),
    sessionsThisMonth: (month ?? []).length,
    notMarked: (unmarked ?? []).length,
    regularsLive: (slots ?? []).filter((s) => s.status === 'active' || s.status === 'paused').length,
    regularsWaiting: (slots ?? []).filter((s) => s.status === 'pending').length,
  }
}
