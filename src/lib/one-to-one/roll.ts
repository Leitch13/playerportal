/**
 * 1-2-1 Slots · the month roll.
 *
 * A regular slot is a rule (weekday, time, frequency, from, to). The roll turns
 * the rule into dated session rows for one month. It is idempotent: the DB has
 * a unique index on (regular_slot_id, session_date) for live rows, and the
 * caller upserts on that.
 *
 *   weekly       every matching weekday in the month
 *   fortnightly  every second matching weekday, counted from starts_on
 *   monthly      the first matching weekday in the month
 *
 * Closures and flags do NOT skip a date here. They surface on Needs attention
 * so a human decides cover / move / credit. The roll never decides money.
 */

import { addDays, daysBetween, isoWeekday, monthEnd, monthStart, type Weekday } from './time'

export interface SlotRule {
  id: string
  weekday: Weekday
  startMinutes: number
  durationMinutes: number
  frequency: 'weekly' | 'fortnightly' | 'monthly'
  startsOn: string
  endsOn?: string | null
  status: 'pending' | 'active' | 'paused' | 'released'
}

export interface RolledSession {
  regularSlotId: string
  date: string
  startMinutes: number
  durationMinutes: number
}

/** Dates this slot rule falls on inside [from, to] inclusive. */
export function occurrences(slot: SlotRule, from: string, to: string): string[] {
  if (slot.status !== 'active' && slot.status !== 'pending') return []
  const lo = from > slot.startsOn ? from : slot.startsOn
  const hi = slot.endsOn && slot.endsOn < to ? slot.endsOn : to
  if (daysBetween(lo, hi) < 0) return []

  // First matching weekday on/after starts_on anchors fortnightly counting.
  const anchorOffset = (slot.weekday - isoWeekday(slot.startsOn) + 7) % 7
  const anchor = addDays(slot.startsOn, anchorOffset)

  const out: string[] = []
  // First matching weekday on/after lo.
  let d = addDays(lo, (slot.weekday - isoWeekday(lo) + 7) % 7)
  while (d <= hi) {
    const weeksFromAnchor = daysBetween(anchor, d) / 7
    const take =
      slot.frequency === 'weekly' ? true
      : slot.frequency === 'fortnightly' ? weeksFromAnchor % 2 === 0
      : out.length === 0 // monthly: first only
    if (take) out.push(d)
    if (slot.frequency === 'monthly' && out.length) break
    d = addDays(d, 7)
  }
  return out
}

/** Sessions for every slot for the month containing `anyDateInMonth`. */
export function rollMonth(slots: SlotRule[], anyDateInMonth: string): RolledSession[] {
  const from = monthStart(anyDateInMonth), to = monthEnd(anyDateInMonth)
  const out: RolledSession[] = []
  for (const s of slots) {
    for (const date of occurrences(s, from, to)) {
      out.push({ regularSlotId: s.id, date, startMinutes: s.startMinutes, durationMinutes: s.durationMinutes })
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)
  return out
}

/** What a parent will be charged for a month: sessions × price, minus credit, never below zero. */
export function monthCharge(args: { sessionPrices: number[]; creditBalancePence: number }): {
  sessionsPence: number; creditAppliedPence: number; amountPence: number
} {
  const sessionsPence = args.sessionPrices.reduce((a, b) => a + b, 0)
  const creditAppliedPence = Math.max(0, Math.min(args.creditBalancePence, sessionsPence))
  return { sessionsPence, creditAppliedPence, amountPence: sessionsPence - creditAppliedPence }
}
