/**
 * Revenue on the Analytics page = class money (payments) + paid 1-2-1s (coaching_charges).
 *
 * 1-2-1 money lives in its own table and Analytics only summed `payments`, so
 * No.1 Goalkeeping's £350 of card-paid 1-2-1s never showed (John, 15 Oct 2026).
 * Reporting only: nothing here charges anyone.
 *
 * A 1-2-1 charge counts once it is paid, by card or in cash, in the month it
 * was paid: cash on the day it was marked received, card on the day the charge
 * row last changed (when the webhook settled it).
 */
export const PAID_ONE_TO_ONE = ['paid_online', 'paid_cash'] as const

export interface OneToOneCharge {
  status: string
  amount_pence: number | null
  cash_received_at: string | null
  updated_at: string | null
  created_at: string
}

export function oneToOnePaidOn(c: OneToOneCharge): string {
  return c.cash_received_at || c.updated_at || c.created_at
}

/** Pounds paid for 1-2-1s, by month label, for the labels the chart already has. */
export function oneToOneByMonth(charges: OneToOneCharge[], label: (d: Date) => string, months: string[]): Map<string, number> {
  const out = new Map(months.map((m) => [m, 0]))
  for (const c of charges) {
    if (!(PAID_ONE_TO_ONE as readonly string[]).includes(c.status)) continue
    const key = label(new Date(oneToOnePaidOn(c)))
    if (out.has(key)) out.set(key, (out.get(key) || 0) + (c.amount_pence || 0) / 100)
  }
  return out
}
