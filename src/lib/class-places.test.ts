import { describe, it, expect } from 'vitest'
import { hasPlace, overBy, overLine, capacityOf } from './class-places'

// CFCoaching, 19 Oct 2026: CFC INTRO, 6 places, 6 paid members + a free trial = 7 children.
describe('a trial takes a place on its day', () => {
  it('a full class has no place for a trial', () => {
    expect(hasPlace(6, 6, 0)).toBe(false)
    expect(hasPlace(6, 5, 1)).toBe(false)
    expect(hasPlace(6, 5, 0)).toBe(true)
  })
  it('a class that filled after trials were booked is over, and says by whom', () => {
    expect(overBy(6, 6, 1)).toBe(1)
    expect(overBy(6, 5, 1)).toBe(0)
    expect(overLine(6, 6, ['Kylan Bamford'])).toBe('7 for 6 places (6 members + 1 trial: Kylan Bamford)')
  })
  it('a class with no limit set counts as 20, like the booking page and sign-up check', () => {
    expect(capacityOf(null)).toBe(20)
    expect(capacityOf(0)).toBe(20)
    expect(capacityOf(6)).toBe(6)
  })
})
