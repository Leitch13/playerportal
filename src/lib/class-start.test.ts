import { describe, it, expect } from 'vitest'
import { earliestStart, firstClassDayOnOrAfter, termNotStarted } from './class-start'

// CFCoaching, 17 Oct 2026: CFC INTRO (Mondays) starts Monday 2 November.
describe('a class whose term has not started can only be started from the term', () => {
  it('a Monday class with a term from 2 Nov starts no earlier than Mon 2 Nov', () => {
    expect(earliestStart('2026-10-17', '2026-11-02', 'Monday')).toBe('2026-11-02')
  })
  it('a term starting midweek starts on the first class day after it', () => {
    expect(earliestStart('2026-10-17', '2026-10-28', 'Monday')).toBe('2026-11-02')
  })
  it('a term already running, or no term, starts today as before', () => {
    expect(earliestStart('2026-10-17', '2026-09-01', 'Monday')).toBe('2026-10-17')
    expect(earliestStart('2026-10-17', null, 'Monday')).toBe('2026-10-17')
  })
  it('a class with no set day starts on the term start date itself', () => {
    expect(earliestStart('2026-10-17', '2026-11-02', null)).toBe('2026-11-02')
    expect(firstClassDayOnOrAfter('2026-10-17', null)).toBe('2026-10-17')
  })
  it('knows when the term has not started', () => {
    expect(termNotStarted('2026-10-17', '2026-11-02')).toBe(true)
    expect(termNotStarted('2026-10-17', '2026-10-17')).toBe(false)
    expect(termNotStarted('2026-10-17', null)).toBe(false)
  })
})
