import type Stripe from 'stripe'

/**
 * A subscription's current period (start and end = the next payment date), wherever Stripe puts it.
 *
 * Stripe moved `current_period_start/end` from the subscription to each subscription item
 * (API 2025-03-31). Webhook payloads arrive in the endpoint's version, so the top-level fields
 * were missing and every renewal left our "next payment" date where it was: Talent FA's six
 * October payers still showed early October on 21 Oct 2026 (Ryan: "it says next payment October").
 * Reads the item first-ending period, falling back to the old top-level fields.
 * Guarded by src/lib/stripe-period.test.ts and scripts/check-feature-invariants.mjs.
 */
export function subPeriod(sub: Stripe.Subscription | null | undefined): { start: number | null; end: number | null } {
  if (!sub) return { start: null, end: null }
  const top = sub as unknown as { current_period_start?: number; current_period_end?: number }
  const items = ((sub as unknown as { items?: { data?: { current_period_start?: number; current_period_end?: number }[] } }).items?.data ?? [])
    .filter((i) => typeof i.current_period_end === 'number')
  const item = items.sort((a, b) => (a.current_period_end as number) - (b.current_period_end as number))[0]
  return {
    start: item?.current_period_start ?? top.current_period_start ?? null,
    end: item?.current_period_end ?? top.current_period_end ?? null,
  }
}

/** The subscription with `current_period_start/end` filled in at the top level, so older code reads the right dates. */
export function withPeriod<T extends Stripe.Subscription>(sub: T): T & { current_period_start: number; current_period_end: number } {
  const p = subPeriod(sub)
  return Object.assign(sub, {
    current_period_start: p.start ?? (sub as unknown as { current_period_start?: number }).current_period_start,
    current_period_end: p.end ?? (sub as unknown as { current_period_end?: number }).current_period_end,
  }) as T & { current_period_start: number; current_period_end: number }
}
