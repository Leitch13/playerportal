/**
 * A family's month, as the academy sees it under Regulars → More and as the parent
 * gets it by email ("Jamie's November sessions, updated").
 *
 * John, 17–18 Oct 2026: "it should then have a breakdown for the parent with the money
 * due … if they can't make the 18th of November that is now missing from the invoice."
 *
 * The total is never worked out here: it is the same chargeBreakdown() the 1st-of-month
 * charge uses (ledger.ts), so what the parent is told is what is taken. This file only
 * sorts the dates into "on" and "taken off" and says why in plain words.
 */
import { isChargeable, chargeBreakdown } from './ledger'
import { minutesToHHMM as hhmm } from './time'

// Same wording as db.ts fmtDate (kept local so this file loads without the server client).
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export interface FamilySessionRow {
  id: string; session_date: string; start_minutes: number; coach_id: string; venue_id: string; price_pence: number
  status: string; decline_tier: string | null; charge_state: string; note: string | null; regular_slot_id: string | null; source: string
  player_id: string | null
}
export interface FamilyCharge { status: string; amount_pence: number; credit_applied_pence: number; sessions_pence: number }

export interface MonthLine { id: string; date: string; startMinutes: number; coachId: string; venueId: string; pricePence: number; slotId: string | null; playerId: string | null; tag?: string }
export interface OffLine extends MonthLine { why: string }

export interface FamilyMonth {
  on: MonthLine[]
  off: OffLine[]
  sessionsPence: number
  /** Credit taken off (+) or money owed added on (−), as on the bill. */
  creditPence: number
  toPayPence: number
  state: 'due' | 'paid' | 'failed' | 'covered'
  /** Dates held for a regular the parent hasn't set up yet: shown, not on this bill, they go on the set-up link. */
  setUpPence: number
}

const PAID = ['paid_online', 'paid_cash']

/** Why a date isn't on the bill, in the words a parent understands. */
export function offReason(r: Pick<FamilySessionRow, 'status' | 'decline_tier' | 'note' | 'charge_state'>): string {
  if (r.status === 'cancelled' && r.note && /^moved to /i.test(r.note)) {
    const m = r.note.match(/moved to (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/i)
    return m ? `moved to ${fmtDate(m[1])} ${m[2]}` : 'moved'
  }
  if (r.status === 'declined') {
    if (r.decline_tier === 'half') return "you couldn't make it · half charged (under 7 days' notice)"
    return r.charge_state === 'credited' ? "you couldn't make it · credited" : "you couldn't make it · not charged"
  }
  if (r.status === 'cancelled') {
    if (r.note && /slot paused/i.test(r.note)) return 'paused'
    if (r.note && /released/i.test(r.note)) return 'slot ended'
    return r.charge_state === 'credited' ? 'cancelled by the academy · credited' : 'cancelled by the academy · not charged'
  }
  return 'not on'
}

/**
 * Sort a month's dates and attach the bill. `charge` is the month's charge row if it
 * exists; `creditBalancePence` is the family's ledger balance today (used only while
 * the month has not been charged yet, exactly as the 1st-of-month charge would).
 */
export function buildFamilyMonth(rows: FamilySessionRow[], charge: FamilyCharge | null, creditBalancePence: number, pendingSlotIds: Set<string> = new Set()): FamilyMonth {
  const line = (r: FamilySessionRow): MonthLine => ({ id: r.id, date: r.session_date, startMinutes: r.start_minutes, coachId: r.coach_id, venueId: r.venue_id, pricePence: r.price_pence, slotId: r.regular_slot_id, playerId: r.player_id })
  const notSetUp = (r: FamilySessionRow) => !!r.regular_slot_id && pendingSlotIds.has(r.regular_slot_id)
  const all = rows.filter((r) => r.status !== 'held')
  const mine = all.filter((r) => !notSetUp(r))
  // A regular the parent hasn't set up yet: its dates are held and shown (Aaron, Granite, 18 Oct 2026:
  // the panel said "no sessions" while three dates were held), but they are not on this bill.
  const held = all.filter(notSetUp).sort((a, b) => a.session_date.localeCompare(b.session_date) || a.start_minutes - b.start_minutes)
  const setUpPence = held.filter((r) => r.charge_state === 'unpaid' && isChargeable({ id: r.id, pricePence: r.price_pence, status: r.status, declineTier: r.decline_tier })).reduce((a, r) => a + r.price_pence, 0)
  const on: MonthLine[] = held.filter((r) => isChargeable({ id: r.id, pricePence: r.price_pence, status: r.status, declineTier: r.decline_tier })).map((r) => ({ ...line(r), tag: 'held · not set up yet' }))
  const off: OffLine[] = []
  for (const r of [...mine].sort((a, b) => a.session_date.localeCompare(b.session_date) || a.start_minutes - b.start_minutes)) {
    const chargeable = isChargeable({ id: r.id, pricePence: r.price_pence, status: r.status, declineTier: r.decline_tier })
    if (chargeable) on.push({ ...line(r), ...(r.status === 'declined' ? { tag: 'released late · still charged' } : r.source === 'admin' ? { tag: 'moved here' } : {}) })
    else off.push({ ...line(r), why: offReason(r) })
  }
  on.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)
  if (charge && (PAID.includes(charge.status) || charge.status === 'waived')) {
    return { on, off, sessionsPence: charge.sessions_pence, creditPence: charge.credit_applied_pence, toPayPence: 0, state: charge.status === 'waived' ? 'covered' : 'paid', setUpPence }
  }
  if (charge && (charge.status === 'failed' || charge.status === 'pending')) {
    return { on, off, sessionsPence: charge.sessions_pence, creditPence: charge.credit_applied_pence, toPayPence: charge.amount_pence, state: charge.status === 'failed' ? 'failed' : 'due', setUpPence }
  }
  // Not charged yet: exactly what the 1st-of-month charge would take.
  const unpaid = mine.filter((r) => r.charge_state === 'unpaid' && ['regular', 'admin'].includes(r.source))
  const b = chargeBreakdown(unpaid.map((r) => ({ id: r.id, pricePence: r.price_pence, status: r.status, declineTier: r.decline_tier })), creditBalancePence)
  return { on, off, sessionsPence: b.sessionsPence, creditPence: b.creditAppliedPence, toPayPence: b.amountPence, state: b.amountPence === 0 && b.sessionsPence > 0 ? 'covered' : 'due', setUpPence }
}

export const lineWhen = (l: MonthLine) => `${fmtDate(l.date)} · ${hhmm(l.startMinutes)}`
