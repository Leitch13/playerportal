import { stripe } from '@/lib/stripe'

// Read-only view of an academy's Stripe money: what's on its way to the bank,
// what already landed, and what came out in fees this month. Everything is a
// live read on the academy's own connected account. Nothing here moves money
// or touches billing.
//
// Fail-SOFT: any Stripe error returns null and the page simply doesn't show
// the box. A payments page must never break because Stripe was slow.

export interface PayoutRow {
  id: string
  arrivalDate: string // ISO date
  amountPence: number
  status: string // paid | pending | in_transit | failed | canceled
}

export interface PayoutSnapshot {
  currency: string
  availablePence: number // cleared, will go in the next payout
  pendingPence: number // still in Stripe's settlement wait
  schedule: { interval: string; delayDays: number; weeklyAnchor?: string; monthlyAnchor?: number }
  next: PayoutRow | null // the soonest payout not yet paid
  recent: PayoutRow[] // last paid, newest first
  month: {
    label: string // e.g. "September"
    grossPence: number
    stripeFeePence: number
    platformFeePence: number
    refundedPence: number
    netPence: number
    count: number
  }
}

const iso = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10)

export async function getPayoutSnapshot(accountId: string | null | undefined): Promise<PayoutSnapshot | null> {
  if (!accountId) return null
  try {
    const opts = { stripeAccount: accountId }
    const now = new Date()
    const monthStart = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000)

    const [account, balance, payouts, txns] = await Promise.all([
      stripe.accounts.retrieve(accountId),
      stripe.balance.retrieve(opts),
      stripe.payouts.list({ limit: 10 }, opts),
      stripe.balanceTransactions.list({ created: { gte: monthStart }, limit: 100 }, opts),
    ])

    const currency = (balance.available[0]?.currency || 'gbp').toLowerCase()
    const sum = (rows: { amount: number; currency: string }[]) =>
      rows.filter((r) => r.currency.toLowerCase() === currency).reduce((a, r) => a + r.amount, 0)

    const sched = account.settings?.payouts?.schedule
    const schedule = {
      interval: sched?.interval || 'daily',
      delayDays: sched?.delay_days ?? 0,
      weeklyAnchor: sched?.weekly_anchor,
      monthlyAnchor: sched?.monthly_anchor,
    }

    const rows: PayoutRow[] = payouts.data.map((p) => ({
      id: p.id,
      arrivalDate: iso(p.arrival_date),
      amountPence: p.amount,
      status: p.status,
    }))
    const upcoming = rows
      .filter((r) => r.status === 'pending' || r.status === 'in_transit')
      .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))
    const recent = rows.filter((r) => r.status === 'paid').slice(0, 3)

    // This month's money, from the academy's own ledger. Fees are split by
    // what Stripe reports: processing fee vs our platform fee.
    let grossPence = 0, stripeFeePence = 0, platformFeePence = 0, refundedPence = 0, count = 0
    for (const t of txns.data) {
      if (t.currency.toLowerCase() !== currency) continue
      if (t.type === 'charge' || t.type === 'payment') {
        grossPence += t.amount
        count += 1
        for (const f of t.fee_details || []) {
          if (f.type === 'application_fee') platformFeePence += f.amount
          else stripeFeePence += f.amount
        }
      } else if (t.type === 'refund' || t.type === 'payment_refund') {
        refundedPence += -t.amount
      } else if (t.type === 'application_fee') {
        // Some Connect shapes post our fee as its own line rather than inside fee_details.
        platformFeePence += -t.amount
      }
    }

    return {
      currency,
      availablePence: sum(balance.available),
      pendingPence: sum(balance.pending),
      schedule,
      next: upcoming[0] || null,
      recent,
      month: {
        label: now.toLocaleString('en-GB', { month: 'long', timeZone: 'Europe/London' }),
        grossPence,
        stripeFeePence,
        platformFeePence,
        refundedPence,
        netPence: grossPence - stripeFeePence - platformFeePence - refundedPence,
        count,
      },
    }
  } catch {
    return null
  }
}

/** "daily, 3 days after each payment" / "every Friday" / "on the 1st" */
export function describeSchedule(s: PayoutSnapshot['schedule']): string {
  if (s.interval === 'manual') return 'when you send them from Stripe'
  if (s.interval === 'daily') return s.delayDays ? `daily, ${s.delayDays} working days after each payment` : 'daily'
  if (s.interval === 'weekly') return `every ${s.weeklyAnchor ? s.weeklyAnchor[0].toUpperCase() + s.weeklyAnchor.slice(1) : 'week'}`
  if (s.interval === 'monthly') return `monthly on the ${ordinal(s.monthlyAnchor || 1)}`
  return 'on your Stripe schedule'
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
