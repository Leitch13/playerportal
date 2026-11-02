import { createHash } from 'node:crypto'

/**
 * The ASCEND dashboard link (John, 2 Nov 2026: "go pp link").
 *
 * An ASCEND member's dashboard asks Player Portal, each morning, which of its leads have
 * booked a trial or joined, and for the academy's monthly numbers. It sends only hashes of
 * its leads' emails and phones; we hash our own families the same way and answer for the
 * ones that match, so no list of parents ever leaves Player Portal. Read-only: nothing here
 * changes billing, and it's the same for every academy.
 */

/** Same keys on both sides: 'e:' + lower-case email, 'p:' + the last 9 digits of a phone. */
export function contactHashes(email?: string | null, phone?: string | null): string[] {
  const out: string[] = []
  const e = String(email || '').trim().toLowerCase()
  if (e.includes('@')) out.push(sha('e:' + e))
  const d = String(phone || '').replace(/\D/g, '')
  if (d.length >= 10) out.push(sha('p:' + d.slice(-9)))
  return out
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

export interface FeedMatch { trial_at?: string; joined_at?: string }

/** Earliest trial and earliest join for each hash the dashboard asked about. */
export function matchFamilies(
  asked: Set<string>,
  trials: { email?: string | null; phone?: string | null; at: string }[],
  joins: { email?: string | null; phone?: string | null; at: string }[],
): Record<string, FeedMatch> {
  const out: Record<string, FeedMatch> = {}
  const put = (rows: typeof trials, key: keyof FeedMatch) => {
    for (const r of rows) for (const h of contactHashes(r.email, r.phone)) {
      if (!asked.has(h)) continue
      const m = (out[h] ||= {})
      if (!m[key] || r.at < m[key]!) m[key] = r.at
    }
  }
  put(trials, 'trial_at'); put(joins, 'joined_at')
  return out
}

/** A plan's monthly worth (quarterly ÷ 3, yearly ÷ 12). */
export const monthlyWorth = (amount: number, interval?: string | null) =>
  /quarter/i.test(interval || '') ? amount / 3 : /year|annual/i.test(interval || '') ? amount / 12 : amount

export const LIVE = ['active', 'trialing', 'past_due']
/** Statuses that mean a family really joined at some point (not an unconfirmed invite or an abandoned checkout). */
export const EVER_JOINED = ['active', 'trialing', 'past_due', 'paused', 'canceled', 'cancelled', 'unpaid']

export interface MoneyMonth { month: string; revenue: number; new_members: number; lost_members: number; members: number }

/** The last `n` months up to this one: money taken, members at the end, joined, left. */
export function moneyMonths(
  thisMonth: string, n: number,
  payments: { amount: number; at: string }[],
  subs: { status: string; created_at: string; ended_at: string | null }[],
): MoneyMonth[] {
  const months: string[] = []
  let [y, m] = thisMonth.split('-').map(Number)
  for (let i = 0; i < n; i++) { months.unshift(`${y}-${String(m).padStart(2, '0')}`); if (--m === 0) { m = 12; y-- } }
  const joined = subs.filter((s) => EVER_JOINED.includes(s.status))
  return months.map((month) => {
    const revenue = Math.round(payments.filter((p) => p.at.slice(0, 7) === month).reduce((a, p) => a + p.amount, 0) * 100) / 100
    const end = month + '-99'
    return {
      month, revenue,
      new_members: joined.filter((s) => s.created_at.slice(0, 7) === month).length,
      lost_members: joined.filter((s) => s.ended_at && s.ended_at.slice(0, 7) === month).length,
      members: joined.filter((s) => s.created_at <= end && (!s.ended_at || s.ended_at.slice(0, 7) > month)).length,
    }
  })
}
