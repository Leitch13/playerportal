/**
 * 1-2-1 Slots · cancellation policy.
 *
 * Fixed for every academy. Not a setting.
 *
 *   more than 7 days notice   → full credit
 *   7 days down to 48 hours   → half credit, half charged
 *   under 48 hours            → charged in full
 *
 * Academy cancellations always credit in full (see academyCancelCredit).
 * Credit goes on the parent's ledger and comes off the next month's charge.
 * Refund is a separate, admin-only, last-resort action.
 */

import { londonToInstant } from './time'

export type DeclineTier = 'full' | 'half' | 'none'

export const HOURS_FULL_CREDIT = 7 * 24
export const HOURS_HALF_CREDIT = 48

export interface DeclineOutcome {
  tier: DeclineTier
  hoursNotice: number
  creditPence: number
  chargedPence: number
  /** What the parent is told, in one line. */
  message: string
}

export function tierForNotice(hoursNotice: number): DeclineTier {
  if (hoursNotice > HOURS_FULL_CREDIT) return 'full'
  if (hoursNotice >= HOURS_HALF_CREDIT) return 'half'
  return 'none'
}

/** Half credit rounds in the parent's favour by the penny. */
export function splitForTier(tier: DeclineTier, pricePence: number): { creditPence: number; chargedPence: number } {
  if (pricePence < 0) throw new Error('price must not be negative')
  if (tier === 'full') return { creditPence: pricePence, chargedPence: 0 }
  if (tier === 'half') {
    const credit = Math.ceil(pricePence / 2)
    return { creditPence: credit, chargedPence: pricePence - credit }
  }
  return { creditPence: 0, chargedPence: pricePence }
}

export function declineOutcome(args: {
  sessionDate: string; startMinutes: number; pricePence: number; now: Date
}): DeclineOutcome {
  const start = londonToInstant(args.sessionDate, args.startMinutes)
  const hoursNotice = (start.getTime() - args.now.getTime()) / 3_600_000
  if (hoursNotice <= 0) {
    return { tier: 'none', hoursNotice, creditPence: 0, chargedPence: args.pricePence, message: 'This session has already started, so it is charged in full.' }
  }
  const tier = tierForNotice(hoursNotice)
  const { creditPence, chargedPence } = splitForTier(tier, args.pricePence)
  const pounds = (p: number) => `£${(p / 100).toFixed(2).replace(/\.00$/, '')}`
  const message =
    tier === 'full' ? `More than 7 days notice, so the full ${pounds(creditPence)} comes off next month.`
    : tier === 'half' ? `Between 7 days and 48 hours notice, so ${pounds(creditPence)} comes off next month and ${pounds(chargedPence)} is charged.`
    : `Under 48 hours notice, so this session is charged in full.`
  return { tier, hoursNotice, creditPence, chargedPence, message }
}

/** The academy cancelling (no cover found) is always a full credit. */
export function academyCancelCredit(pricePence: number): number {
  if (pricePence < 0) throw new Error('price must not be negative')
  return pricePence
}
