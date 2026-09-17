/**
 * 1-2-1 Slots · the month's money, as pure arithmetic.
 *
 *   charge = sessions in the month × price − credit on account, never below 0
 *
 * A declined date follows the policy tiers (see policy.ts). Whether it has
 * already been paid for decides how the tier is applied:
 *   • already charged  → the credit share goes onto the ledger as a credit
 *   • not yet charged  → the session drops out of the coming charge; the
 *                        charged share (half / full) goes on the ledger as a
 *                        debit so the coming charge still collects it
 */

import { splitForTier, type DeclineTier } from './policy'

export interface ChargeableSession { id: string; pricePence: number; status: string; declineTier?: string | null }

/** Sessions that count towards a month's charge. */
export function isChargeable(s: ChargeableSession): boolean {
  if (s.status === 'scheduled' || s.status === 'attended' || s.status === 'no_show') return true
  if (s.status === 'declined' && s.declineTier === 'none') return true // under 48h: still charged
  return false
}

export interface ChargeBreakdown {
  sessionIds: string[]
  sessionsPence: number
  creditAvailablePence: number
  creditAppliedPence: number
  amountPence: number
}

export function chargeBreakdown(sessions: ChargeableSession[], creditBalancePence: number): ChargeBreakdown {
  const use = sessions.filter(isChargeable)
  const sessionsPence = use.reduce((a, s) => a + s.pricePence, 0)
  // A negative balance is a debit (e.g. a half-fee for a late decline before the charge ran).
  const creditAppliedPence = creditBalancePence >= 0 ? Math.min(creditBalancePence, sessionsPence) : creditBalancePence
  return {
    sessionIds: use.map((s) => s.id),
    sessionsPence,
    creditAvailablePence: creditBalancePence,
    creditAppliedPence,
    amountPence: Math.max(0, sessionsPence - creditAppliedPence),
  }
}

export interface DeclineEffect {
  /** ledger movement for the parent: + credit, − debit, 0 nothing */
  ledgerPence: number
  /** what the session row becomes */
  sessionStatus: 'declined'
  /** true when the session should still be counted by the next charge (under 48h, unpaid) */
  stillChargeable: boolean
  message: string
}

export function declineEffect(tier: DeclineTier, pricePence: number, alreadyCharged: boolean): DeclineEffect {
  const { creditPence, chargedPence } = splitForTier(tier, pricePence)
  const gbp = (p: number) => `£${(p / 100).toFixed(2).replace(/\.00$/, '')}`
  if (alreadyCharged) {
    return {
      ledgerPence: creditPence, sessionStatus: 'declined', stillChargeable: false,
      message: creditPence === pricePence ? `${gbp(creditPence)} credited to your account.`
        : creditPence > 0 ? `${gbp(creditPence)} credited to your account, ${gbp(chargedPence)} kept.`
        : 'Under 48 hours notice, so this session is not credited.',
    }
  }
  if (tier === 'none') {
    return { ledgerPence: 0, sessionStatus: 'declined', stillChargeable: true, message: 'Under 48 hours notice, so this session will still be charged on the 1st.' }
  }
  return {
    ledgerPence: chargedPence === 0 ? 0 : -chargedPence, sessionStatus: 'declined', stillChargeable: false,
    message: chargedPence === 0 ? 'Removed from next month\'s charge.' : `Removed from next month's charge, with ${gbp(chargedPence)} kept for late notice.`,
  }
}

/** Retry calendar after a failed 1st-of-month charge: 4th, then 8th, then a human. */
export function nextAttemptOn(billingMonth: string, attemptCount: number): string | null {
  const ym = billingMonth.slice(0, 7)
  if (attemptCount <= 1) return `${ym}-04`
  if (attemptCount === 2) return `${ym}-08`
  return null
}
