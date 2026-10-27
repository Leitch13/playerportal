/**
 * Discounts, the same for every academy (John, 27 Oct 2026: "a discount like ClassForKids").
 *
 *   • Codes (promo_codes) a parent types in: memberships, trials, camps.
 *   • A discount the academy gives one child's membership (Give a discount on the child page).
 *   • Sibling discount, now also for invited families (confirm-checkout), not only the booking page.
 *
 * On a membership a discount comes off the monthly payments on the 1st, never the part-month
 * paid today, so "first month" means the first full monthly payment. It is put on the Stripe
 * subscription itself (alongside any sibling discount), so every renewal shows it and Stripe
 * stops it on its own after the months chosen. 1-2-1s use the family's credit (the 1-2-1 module's
 * own ledger); a trial or camp code comes off the one-off price.
 */

import type Stripe from 'stripe'

export type DiscountType = 'percentage' | 'fixed'
/** How long a membership discount lasts: the next monthly payment, 3 or 6 payments, or until removed. */
export type DiscountDuration = 'once' | 'repeating_3' | 'repeating_6' | 'forever'

export const DURATIONS: DiscountDuration[] = ['once', 'repeating_3', 'repeating_6', 'forever']

/** Stripe's lowest card charge. A trial code may not take a paid trial below it. */
export const MIN_CHARGE_PENCE = 30

export interface DiscountSpec {
  type: DiscountType
  /** percent 1–100, or pence for fixed */
  value: number
  duration: DiscountDuration
}

export function isDuration(x: unknown): x is DiscountDuration {
  return typeof x === 'string' && (DURATIONS as string[]).includes(x)
}

/** Refuse nonsense before anything reaches Stripe. Returns a parent/academy-readable reason or null. */
export function specProblem(s: { type?: unknown; value?: unknown; duration?: unknown }): string | null {
  if (s.type !== 'percentage' && s.type !== 'fixed') return 'Choose % off or £ off'
  const v = Number(s.value)
  if (!Number.isFinite(v) || v <= 0) return 'Enter how much off'
  if (s.type === 'percentage' && v > 100) return 'A percentage can be at most 100'
  if (s.type === 'fixed' && v > 100000) return 'That is more than £1,000 off'
  if (s.type === 'fixed' && !Number.isInteger(v)) return 'Amount must be in pence'
  if (!isDuration(s.duration)) return 'Choose how long it lasts'
  return null
}

/** Stripe coupon fields for a spec. */
export function couponDuration(d: DiscountDuration): Pick<Stripe.CouponCreateParams, 'duration' | 'duration_in_months'> {
  if (d === 'forever') return { duration: 'forever' }
  if (d === 'once') return { duration: 'once' }
  return { duration: 'repeating', duration_in_months: d === 'repeating_3' ? 3 : 6 }
}

export function couponParams(s: DiscountSpec, name: string, metadata: Record<string, string>): Stripe.CouponCreateParams {
  return {
    name: name.slice(0, 40),
    ...(s.type === 'percentage' ? { percent_off: s.value } : { amount_off: Math.round(s.value), currency: 'gbp' }),
    ...couponDuration(s.duration),
    metadata,
  }
}

/** "10% off" / "£5.00 off" */
export function amountLabel(s: Pick<DiscountSpec, 'type' | 'value'>): string {
  return s.type === 'percentage' ? `${s.value}% off` : `£${(s.value / 100).toFixed(2)} off`
}

/** "the next monthly payment" / "3 monthly payments" / "every monthly payment until removed" */
export function durationLabel(d: DiscountDuration): string {
  if (d === 'once') return 'the next monthly payment'
  if (d === 'repeating_3') return '3 monthly payments'
  if (d === 'repeating_6') return '6 monthly payments'
  return 'every monthly payment until it is removed'
}

/** Price after the discount, in pence, never below zero. */
export function discountedPence(amountPence: number, s: Pick<DiscountSpec, 'type' | 'value'>): number {
  if (s.type === 'percentage') return Math.max(0, Math.round(amountPence * (1 - Math.min(100, s.value) / 100)))
  return Math.max(0, amountPence - Math.round(s.value))
}

/**
 * Add a coupon to a live subscription, KEEPING whatever is already on it (a sibling discount,
 * another code). Stripe replaces the whole discounts list on update, so the existing ones are
 * passed back by id. Returns the new discount's id (to remove it later).
 */
export async function addCouponToSubscription(stripe: Stripe, subscriptionId: string, couponId: string): Promise<string | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const existing = (sub.discounts || []).map((d) => (typeof d === 'string' ? d : d.id))
  const updated = await stripe.subscriptions.update(subscriptionId, {
    discounts: [...existing.map((id) => ({ discount: id })), { coupon: couponId }],
    proration_behavior: 'none',
    expand: ['discounts'],
  })
  const after = (updated.discounts || []).map((d) => (typeof d === 'string' ? null : d)).filter(Boolean) as Stripe.Discount[]
  const mine = after.find((d) => couponIdOf(d) === couponId)
  return mine?.id ?? null
}

/** Take one discount off a subscription, keeping the rest. */
export async function removeDiscountFromSubscription(stripe: Stripe, subscriptionId: string, discountId: string): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const keep = (sub.discounts || []).map((d) => (typeof d === 'string' ? d : d.id)).filter((id) => id !== discountId)
  await stripe.subscriptions.update(subscriptionId, { discounts: keep.map((id) => ({ discount: id })), proration_behavior: 'none' })
}

/** Does this subscription already carry a coupon made for this code? Needs `discounts` expanded. (A retried webhook must not stack it twice.) */
export function hasCouponFor(sub: Pick<Stripe.Subscription, 'discounts'>, metaKey: string, metaValue: string): boolean {
  return (sub.discounts || []).some((d) => typeof d !== 'string' && couponMeta(d)[metaKey] === metaValue)
}

const couponIdOf = (d: Stripe.Discount): string | null => d.coupon?.id ?? null
const couponMeta = (d: Stripe.Discount): Record<string, string> => (d.coupon?.metadata as Record<string, string>) || {}

/** A promo_codes row as a spec (fixed amounts are stored in pence). Old rows without a duration last one payment. */
export function specFromPromo(row: { discount_type: DiscountType; discount_value: number; discount_duration?: string | null }): DiscountSpec {
  return { type: row.discount_type, value: Number(row.discount_value), duration: isDuration(row.discount_duration) ? row.discount_duration : 'once' }
}

/**
 * Put a code on a membership once its Stripe subscription exists (called by the webhook when the
 * parent finishes paying). Idempotent: a retried webhook finds the coupon already there.
 */
export async function redeemCodeOnSubscription(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  stripe: Stripe,
  promoId: string,
  subscriptionId: string,
): Promise<'applied' | 'already' | 'missing'> {
  const { data: promo } = await db.from('promo_codes').select('id, code, organisation_id, discount_type, discount_value, discount_duration').eq('id', promoId).maybeSingle()
  if (!promo) return 'missing'
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['discounts'] })
  if (hasCouponFor(sub, 'promo_code_id', promo.id)) return 'already'
  const spec = specFromPromo(promo)
  const coupon = await stripe.coupons.create(couponParams(spec, `${promo.code}: ${amountLabel(spec)}`, { promo_code_id: promo.id, organisation_id: promo.organisation_id, type: 'promo_code' }))
  await addCouponToSubscription(stripe, subscriptionId, coupon.id)
  await db.rpc('increment_promo_use', { p_promo_id: promo.id })
  await db.from('audit_log').insert({ organisation_id: promo.organisation_id, action: 'discount.code_used', entity_type: 'subscription', entity_id: null, details: { promo_code_id: promo.id, code: promo.code, stripe_subscription_id: subscriptionId } })
  return 'applied'
}

/** A child's discount given by the academy, as stored in audit_log (action discount.child_given). */
export interface ChildDiscountRecord {
  player_id: string
  subscription_id: string
  stripe_subscription_id: string
  discount_id: string | null
  coupon_id: string
  type: DiscountType
  value: number
  duration: DiscountDuration
  reason: string
  plan_name: string
  plan_amount: number
}

export const CHILD_DISCOUNT_GIVEN = 'discount.child_given'
export const CHILD_DISCOUNT_REMOVED = 'discount.child_removed'
