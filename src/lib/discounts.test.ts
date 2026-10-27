import { describe, it, expect } from 'vitest'
import { specProblem, couponParams, discountedPence, amountLabel, addCouponToSubscription, removeDiscountFromSubscription, redeemCodeOnSubscription, specFromPromo } from './discounts'

// Discounts (27 Oct 2026): a membership discount sits on the Stripe subscription next to any
// sibling discount, comes off the monthly payments, and a retried webhook never stacks a code twice.

describe('the rules', () => {
  it('refuses nonsense before Stripe sees it', () => {
    expect(specProblem({ type: 'percentage', value: 120, duration: 'once' })).toMatch(/at most 100/)
    expect(specProblem({ type: 'fixed', value: 0, duration: 'once' })).toMatch(/how much/)
    expect(specProblem({ type: 'percentage', value: 10, duration: 'weekly' })).toMatch(/how long/)
    expect(specProblem({ type: 'fixed', value: 500, duration: 'forever' })).toBeNull()
  })
  it('turns a spec into the right Stripe coupon', () => {
    expect(couponParams({ type: 'percentage', value: 50, duration: 'forever' }, 'x', {})).toMatchObject({ percent_off: 50, duration: 'forever' })
    expect(couponParams({ type: 'fixed', value: 1000, duration: 'repeating_3' }, 'x', {})).toMatchObject({ amount_off: 1000, currency: 'gbp', duration: 'repeating', duration_in_months: 3 })
    expect(couponParams({ type: 'percentage', value: 10, duration: 'once' }, 'x', {})).toMatchObject({ duration: 'once' })
  })
  it('works out the new price and never goes below £0', () => {
    expect(discountedPence(4199, { type: 'percentage', value: 50 })).toBe(2100)
    expect(discountedPence(3900, { type: 'fixed', value: 500 })).toBe(3400)
    expect(discountedPence(3900, { type: 'fixed', value: 5000 })).toBe(0)
    expect(amountLabel({ type: 'fixed', value: 500 })).toBe('£5.00 off')
  })
  it('old codes without a length last one payment', () => {
    expect(specFromPromo({ discount_type: 'percentage', discount_value: 10, discount_duration: null }).duration).toBe('once')
  })
})

/** A fake Stripe that keeps one subscription's discounts. */
function fakeStripe() {
  const coupons: Record<string, { id: string; metadata: Record<string, string> }> = {}
  let discounts: { id: string; coupon: { id: string; metadata: Record<string, string> } }[] = [{ id: 'di_sibling', coupon: { id: 'co_sibling', metadata: { type: 'sibling_discount' } } }]
  let n = 0
  const view = (expand: boolean) => ({ id: 'sub_1', discounts: expand ? discounts : discounts.map((d) => d.id) })
  const stripe = {
    coupons: { create: async (p: { metadata: Record<string, string> }) => { const id = `co_${++n}`; coupons[id] = { id, metadata: p.metadata }; return coupons[id] } },
    subscriptions: {
      retrieve: async (_id: string, o?: { expand?: string[] }) => view(!!o?.expand),
      update: async (_id: string, p: { discounts: ({ discount: string } | { coupon: string })[]; expand?: string[] }) => {
        discounts = p.discounts.map((d) => ('discount' in d ? discounts.find((x) => x.id === d.discount)! : { id: `di_${++n}`, coupon: coupons[d.coupon] }))
        return view(!!p.expand)
      },
    },
  }
  return { stripe: stripe as never, get discounts() { return discounts } }
}

describe('on a live membership', () => {
  it('a new discount keeps the sibling discount already there, and can be taken off on its own', async () => {
    const f = fakeStripe()
    const coupon = await (f.stripe as { coupons: { create: (p: unknown) => Promise<{ id: string }> } }).coupons.create({ metadata: { type: 'child_discount' } })
    const id = await addCouponToSubscription(f.stripe, 'sub_1', coupon.id)
    expect(f.discounts.map((d) => d.coupon.id)).toEqual(['co_sibling', coupon.id])
    await removeDiscountFromSubscription(f.stripe, 'sub_1', id!)
    expect(f.discounts.map((d) => d.id)).toEqual(['di_sibling'])
  })

  it('a code typed at sign-up goes on once, however many times Stripe sends the webhook', async () => {
    const f = fakeStripe()
    const rpc: string[] = []
    const db = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'promo1', code: 'XMAS10', organisation_id: 'org', discount_type: 'percentage', discount_value: 10, discount_duration: 'once' } }) }) }), insert: async () => ({}) }),
      rpc: async (n: string) => { rpc.push(n); return {} },
    }
    expect(await redeemCodeOnSubscription(db, f.stripe, 'promo1', 'sub_1')).toBe('applied')
    expect(await redeemCodeOnSubscription(db, f.stripe, 'promo1', 'sub_1')).toBe('already')
    expect(f.discounts).toHaveLength(2)
    expect(rpc).toEqual(['increment_promo_use'])
  })
})
