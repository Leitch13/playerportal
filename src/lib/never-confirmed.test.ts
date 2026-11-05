import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))
import { backMonths, monthsLabel, paidAnotherWayMonths, nextMonthStart } from './never-confirmed'

describe('backMonths', () => {
  it('Hedi: billing from 1 Aug, today 2 Nov → Aug, Sep, Oct (November is paid on confirming)', () => {
    expect(backMonths('2026-08-01T00:00:00+00:00', '2026-06-30T12:17:33Z', '2026-11-02')).toEqual(['2026-08', '2026-09', '2026-10'])
  })
  it('no billing date: from the month after the invite', () => {
    expect(backMonths(null, '2026-09-14T10:00:00Z', '2026-11-02')).toEqual(['2026-10'])
  })
  it('nothing owed yet', () => {
    expect(backMonths('2026-11-01T00:00:00Z', null, '2026-11-02')).toEqual([])
    expect(backMonths('2026-12-01T00:00:00Z', null, '2026-11-02')).toEqual([])
    expect(backMonths(null, null, '2026-11-02')).toEqual([])
  })
  it('across a year end', () => expect(backMonths('2026-11-01', null, '2027-02-10')).toEqual(['2026-11', '2026-12', '2027-01']))
})

describe('monthsLabel', () => {
  it('a range', () => expect(monthsLabel(['2026-08', '2026-09', '2026-10'])).toBe('Aug–Oct 2026'))
  it('one month', () => expect(monthsLabel(['2026-10'])).toBe('October 2026'))
})

describe('paid another way', () => {
  it('covers every month owed plus this one, once each', () => {
    expect(paidAnotherWayMonths(['2026-09', '2026-10'], '2026-11-05')).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(paidAnotherWayMonths([], '2026-11-05')).toEqual(['2026-11'])
  })
  it('moves the first card payment to the 1st of next month, across the year end too', () => {
    expect(nextMonthStart('2026-11-05')).toBe('2026-12-01T00:00:00.000Z')
    expect(nextMonthStart('2026-12-31')).toBe('2027-01-01T00:00:00.000Z')
  })
})
