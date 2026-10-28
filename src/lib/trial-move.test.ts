import { describe, it, expect } from 'vitest'
import { nextClassDates, moveProblem, statusAfterMove } from './trial-move'

// Move a trial (28 Oct 2026, Talent FA): Elena's Saturday trial was cancelled the night before
// and there was no way to give her the next Saturday.
describe('moving a trial', () => {
  it('offers the class’s own days, from today', () => {
    expect(nextClassDates('Saturday ', '2026-10-28', 3)).toEqual(['2026-10-31', '2026-11-07', '2026-11-14'])
    expect(nextClassDates('Wednesday', '2026-10-28', 2)).toEqual(['2026-10-28', '2026-11-04'])
    expect(nextClassDates(null, '2026-10-28')).toEqual([])
  })
  it('a cancelled paid trial can go to next Saturday and is booked again', () => {
    expect(moveProblem({ status: 'cancelled' }, 'Saturday', '2026-10-31', '2026-10-28')).toBeNull()
    expect(statusAfterMove('cancelled')).toBe('confirmed')
    expect(statusAfterMove('pending')).toBe('pending')
  })
  it('refuses a past date, the wrong day, a trial that happened, or a child who joined', () => {
    expect(moveProblem({ status: 'confirmed' }, 'Saturday', '2026-10-24', '2026-10-28')).toMatch(/gone/)
    expect(moveProblem({ status: 'confirmed' }, 'Saturday', '2026-11-01', '2026-10-28')).toMatch(/Saturdays/)
    expect(moveProblem({ status: 'attended' }, 'Saturday', '2026-10-31', '2026-10-28')).toMatch(/already happened/)
    expect(moveProblem({ status: 'confirmed', converted: true }, 'Saturday', '2026-10-31', '2026-10-28')).toMatch(/joined/)
  })
})
