import { plansForClass, type PlanForClass } from './plans-for-class'

/**
 * What a parent is offered on a class's booking page, for the academy to see on
 * the class page (John, 17 Oct 2026: "the plans list on the class page is not
 * clearly visible"; CFCoaching's CFC INTRO had no price and nobody noticed).
 *
 * Same cascade as the booking page (src/lib/plans-for-class.ts): the class's own
 * prices, else prices for its class type, else "any class" prices. Only plans on
 * sale (active) count. Display only.
 */
export interface PriceRow extends PlanForClass { name: string; amount: number | string; active?: boolean | null }

export function pricesForClass<P extends PriceRow>(plans: P[], cls: { id: string; class_type?: string | null }): { prices: P[]; own: boolean } {
  const onSale = plans.filter((p) => p.active !== false)
  const prices = plansForClass(onSale, cls)
  return { prices, own: prices.some((p) => p.training_group_id === cls.id) }
}
