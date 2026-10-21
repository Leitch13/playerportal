import { describe, it, expect } from 'vitest'
import type Stripe from 'stripe'
import { subPeriod, withPeriod } from './stripe-period'

// Talent FA, 21 Oct 2026: six members paid October but still showed "next payment" in early October,
// because Stripe now puts the period dates on the subscription items, not the subscription.
const sub = (o: object) => o as unknown as Stripe.Subscription
describe('next payment date, wherever Stripe puts it', () => {
  it('reads the new place: the subscription items', () => {
    expect(subPeriod(sub({ items: { data: [{ current_period_start: 100, current_period_end: 200 }] } }))).toEqual({ start: 100, end: 200 })
  })
  it('still reads the old place', () => {
    expect(subPeriod(sub({ current_period_start: 10, current_period_end: 20, items: { data: [{}] } }))).toEqual({ start: 10, end: 20 })
  })
  it('fills the old fields so existing code saves the right date', () => {
    const s = withPeriod(sub({ items: { data: [{ current_period_start: 1761955200, current_period_end: 1764547200 }] } }))
    expect(s.current_period_end).toBe(1764547200)
  })
  it('nothing there: nothing invented', () => {
    expect(subPeriod(sub({ items: { data: [] } }))).toEqual({ start: null, end: null })
  })
})
