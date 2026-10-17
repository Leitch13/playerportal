import { describe, it, expect } from 'vitest'
import { pricesForClass } from './class-prices'

const plans = [
  { id: 'core', name: 'CORE', amount: 48, training_group_id: null, class_type: 'group', active: true },
  { id: 'old', name: 'Old', amount: 30, training_group_id: 'intro', class_type: 'small_group', active: false },
]

// CFCoaching, 17 Oct 2026: CFC INTRO (small group) had no price; CORE (£48) only fits group classes.
describe('prices shown on a class page', () => {
  it('a class with nothing on sale for it has no prices', () => {
    expect(pricesForClass(plans, { id: 'intro', class_type: 'small_group' }).prices).toEqual([])
  })
  it('a group class shows the group price', () => {
    expect(pricesForClass(plans, { id: 'core-class', class_type: 'group' }).prices.map((p) => p.name)).toEqual(['CORE'])
  })
  it("a class's own price wins and is marked as its own", () => {
    const own = { id: 'intro30', name: 'INTRO', amount: 30, training_group_id: 'intro', class_type: 'small_group', active: true }
    const r = pricesForClass([...plans, own], { id: 'intro', class_type: 'small_group' })
    expect(r.prices.map((p) => p.name)).toEqual(['INTRO'])
    expect(r.own).toBe(true)
  })
})
