// Pure evaluation of a promo_codes row — no I/O, so it's safe to unit-test and
// to share between the /api/promo/validate endpoint (UI check) and the checkout
// routes (redemption). Keeping the rules in one place means the price a parent
// is quoted and the price they're charged can never drift apart.

export type PromoContext = 'subscription' | 'one_off' | 'trial'

export interface PromoRow {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number // percent (0–100) OR a fixed amount stored in pence
  max_uses: number | null
  current_uses: number | null
  valid_from: string | null // date (yyyy-mm-dd) or ISO timestamp
  valid_until: string | null
  applies_to: 'all' | PromoContext
  active: boolean | null
}

export interface PromoResult {
  valid: boolean
  reason?: string
}

/** Decide whether a code may be used right now, in this checkout context. */
export function evaluatePromo(
  row: PromoRow | null | undefined,
  context: PromoContext,
  now: Date = new Date()
): PromoResult {
  if (!row) return { valid: false, reason: 'Code not found' }
  if (row.active === false) return { valid: false, reason: 'This code is no longer active' }
  if (row.valid_from && now < startOfDay(row.valid_from)) return { valid: false, reason: "This code isn't active yet" }
  if (row.valid_until && now > endOfDay(row.valid_until)) return { valid: false, reason: 'This code has expired' }
  if (row.max_uses != null && (row.current_uses ?? 0) >= row.max_uses) {
    return { valid: false, reason: 'This code has reached its usage limit' }
  }
  if (row.applies_to !== 'all' && row.applies_to !== context) {
    return { valid: false, reason: "This code can't be used here" }
  }
  return { valid: true }
}

/** Discounted amount in pence, never below zero. Percentage or fixed (pence). */
export function applyPromoPence(amountPence: number, row: PromoRow): number {
  if (row.discount_type === 'percentage') {
    const pct = Math.max(0, Math.min(100, row.discount_value))
    return Math.max(0, Math.round(amountPence * (1 - pct / 100)))
  }
  return Math.max(0, amountPence - Math.round(row.discount_value))
}

function startOfDay(d: string): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfDay(d: string): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
