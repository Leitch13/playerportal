/**
 * Who counts as "already has a child here" for the sibling discount.
 *
 * A membership is `trialing` from the moment a parent signs up and pays for
 * this month's sessions until its first full monthly payment on the 1st.
 * Counting only `active` meant two children signed up in the same month got
 * no discount on the second child's first payment (found 5 Oct 2026: one
 * parent, two children two minutes apart, both charged full price).
 *
 * Not counted: an invite that hasn't been confirmed, a failed payment, a
 * paused or ended membership. Same for every academy.
 * John's written decision 6 Oct 2026.
 */
export const SIBLING_QUALIFYING_STATUSES = ['active', 'trialing'] as const

/**
 * The academy's sibling coupon for this parent, or null when they don't qualify (no other child
 * paying or signed up here, or the academy has it switched off). Same check the booking page's
 * subscribe route makes, now also used when an invited family confirms (27 Oct 2026: invited
 * families with two children were paying full price for both).
 */
export async function siblingCouponFor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  stripe: import('stripe').default,
  orgId: string,
  parentId: string,
): Promise<{ couponId: string; percent: number } | null> {
  const { data: org } = await db.from('organisations').select('sibling_discount_enabled, sibling_discount_percent, stripe_sibling_coupon_id').eq('id', orgId).single()
  const percent = Number(org?.sibling_discount_percent || 0)
  if (!org?.sibling_discount_enabled || percent <= 0) return null
  const { count } = await db.from('subscriptions').select('id', { count: 'exact', head: true })
    .eq('parent_id', parentId).eq('organisation_id', orgId).in('status', [...SIBLING_QUALIFYING_STATUSES])
  if (!count) return null
  let couponId = org.stripe_sibling_coupon_id as string | null
  if (!couponId) {
    const coupon = await stripe.coupons.create({ name: `${percent}% sibling discount`, percent_off: percent, duration: 'forever', metadata: { organisation_id: orgId, type: 'sibling_discount' } })
    couponId = coupon.id
    await db.from('organisations').update({ stripe_sibling_coupon_id: couponId }).eq('id', orgId)
  }
  return { couponId, percent }
}
