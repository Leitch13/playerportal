import { describe, it, expect } from 'vitest'
import { earliestStart, firstClassDayOnOrAfter, termNotStarted, latestStartIso, bookAheadDays, trialDatesFrom } from './class-start'

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

// John, 13 Nov 2026: Caolan's new group starting Sunday 3 January must be bookable now.
describe('how far ahead a start can be booked', () => {
  it('a term not started yet can be booked up to 60 days ahead', () => {
    expect(bookAheadDays('2026-11-13', '2027-01-03')).toBe(60)
    expect(latestStartIso('2026-11-13', '2027-01-03')).toBe('2027-01-12')
    expect(earliestStart('2026-11-13', '2027-01-03', 'Sunday') <= latestStartIso('2026-11-13', '2027-01-03')).toBe(true)
  })
  it('a running class, or no term, stays at 28 days', () => {
    expect(bookAheadDays('2026-11-13', '2026-09-01')).toBe(28)
    expect(latestStartIso('2026-11-13', null)).toBe('2026-12-11')
    expect(latestStartIso('2026-11-13', '2026-11-13')).toBe('2026-12-11')
  })
  it('a term more than 60 days away is not bookable yet', () => {
    expect(earliestStart('2026-11-13', '2027-02-01', 'Monday') > latestStartIso('2026-11-13', '2027-02-01')).toBe(true)
  })
})

describe('trial dates start from the term', () => {
  it('a term not started yet: counting starts the day before the term', () => {
    const d = trialDatesFrom(new Date(2026, 10, 13, 15), '2027-01-03')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 0, 2])
  })
  it('a running class, or no term: counting starts now', () => {
    const now = new Date(2026, 10, 13, 15)
    expect(trialDatesFrom(now, '2026-09-01')).toBe(now)
    expect(trialDatesFrom(now, null)).toBe(now)
  })
})
