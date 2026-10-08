import { describe, it, expect } from 'vitest'
import { classForPayment, classesForPlan, classLabel } from './class-for-payment'
import { firstChargeFor } from './billing/sessions'

describe('classForPayment — which class a payment is for', () => {
  it('uses the class the page sent', () => {
    expect(classForPayment({ sent: 'c1', planClassId: 'c2', childClassIds: ['c3'] })).toBe('c1')
  })
  it('falls back to the class the plan belongs to', () => {
    expect(classForPayment({ sent: null, planClassId: 'c2', childClassIds: ['c3'] })).toBe('c2')
  })
  it("falls back to the child's class when they are in exactly one", () => {
    expect(classForPayment({ childClassIds: ['c3'] })).toBe('c3')
    expect(classForPayment({ childClassIds: ['c3', 'c3'] })).toBe('c3')
  })
  it('never guesses between two classes, and never invents one', () => {
    expect(classForPayment({ childClassIds: ['c3', 'c4'] })).toBeNull()
    expect(classForPayment({})).toBeNull()
  })
})

describe('classesForPlan — what the parent is offered', () => {
  const classes = [
    { id: 'elite', name: 'Elite Academy 2018/19', class_type: 'elite', day_of_week: 'Sunday', time_slot: '10:00' },
    { id: 'skills', name: 'Sunday Skills School', class_type: 'skills', day_of_week: 'Sunday', time_slot: '11:00' },
    { id: 'open', name: 'Open session', class_type: null, day_of_week: 'Friday', time_slot: null },
  ]
  const plans = [
    { id: 'p-elite', training_group_id: 'elite', class_type: 'elite' },
    { id: 'p-skills', training_group_id: null, class_type: 'skills' },
    { id: 'p-any', training_group_id: null, class_type: null },
  ]
  it('a plan tied to one class offers only that class', () => {
    expect(classesForPlan(plans[0], plans, classes).map((c) => c.id)).toEqual(['elite'])
  })
  it('a class-type plan offers the classes of that type', () => {
    expect(classesForPlan(plans[1], plans, classes).map((c) => c.id)).toEqual(['skills'])
  })
  it('an any-class plan offers the classes with no plan of their own', () => {
    expect(classesForPlan(plans[2], plans, classes).map((c) => c.id)).toEqual(['open'])
  })
  it('a plan that fits nothing is offered every class, never none', () => {
    const orphan = { id: 'p-x', training_group_id: 'gone', class_type: null }
    expect(classesForPlan(orphan, [...plans, orphan], classes)).toHaveLength(3)
  })
  it('labels a class with its day and time', () => {
    expect(classLabel(classes[0])).toBe('Elite Academy 2018/19 · Sunday 10:00')
    expect(classLabel({ id: 'x', name: 'Holiday club' })).toBe('Holiday club')
  })
})

describe('the overcharge this stops (Alana Porter, PFC, 8 Oct 2026)', () => {
  it('£40 Sunday plan joined 8 Oct: £30 with the class, £40 without', () => {
    expect(firstChargeFor(40, '2026-10-08', '2026-11-01', 'Sunday').pence).toBe(3000)
    expect(firstChargeFor(40, '2026-10-08', '2026-11-01', null).pence).toBe(4000)
  })
})
