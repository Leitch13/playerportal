import { describe, it, expect } from 'vitest'
import { nextClassDates, moveProblem, statusAfterMove, moveFromDay } from './trial-move'

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

describe('term not started yet (Rosa Sports, 25 Nov 2026)', () => {
  it('Move offers dates from the term start, not from today', () => {
    expect(moveFromDay('2026-11-25', '2027-02-01')).toBe('2027-02-01')
    expect(nextClassDates('Wednesday', moveFromDay('2026-11-25', '2027-02-01'), 2)).toEqual(['2027-02-03', '2027-02-10'])
    expect(moveFromDay('2026-11-25', '2026-09-01')).toBe('2026-11-25')
    expect(moveFromDay('2026-11-25', null)).toBe('2026-11-25')
  })
  it('the server refuses a date before the term starts', () => {
    expect(moveProblem({ status: 'confirmed' }, 'Wednesday', '2026-12-02', '2026-11-25', '2027-02-01')).toMatch(/starts on Monday 1 February/)
    expect(moveProblem({ status: 'confirmed' }, 'Wednesday', '2027-02-10', '2026-11-25', '2027-02-01')).toBeNull()
  })
})
