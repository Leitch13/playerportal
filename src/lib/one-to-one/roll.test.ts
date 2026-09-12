import { describe, expect, it } from 'vitest'
import { monthCharge, occurrences, rollMonth, type SlotRule } from './roll'

const base: SlotRule = {
  id: 'ollie', weekday: 5, startMinutes: 990, durationMinutes: 30,
  frequency: 'weekly', startsOn: '2026-09-01', endsOn: null, status: 'active',
}

describe('occurrences', () => {
  it('weekly: every Friday in October 2026', () => {
    expect(occurrences(base, '2026-10-01', '2026-10-31')).toEqual(['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30'])
  })
  it('respects starts_on mid-month and ends_on', () => {
    expect(occurrences({ ...base, startsOn: '2026-10-10' }, '2026-10-01', '2026-10-31')).toEqual(['2026-10-16', '2026-10-23', '2026-10-30'])
    expect(occurrences({ ...base, endsOn: '2026-10-20' }, '2026-10-01', '2026-10-31')).toEqual(['2026-10-02', '2026-10-09', '2026-10-16'])
  })
  it('fortnightly counts from the first occurrence after starts_on, across months', () => {
    const f = { ...base, frequency: 'fortnightly' as const, startsOn: '2026-09-02' } // first Friday = 4 Sep
    expect(occurrences(f, '2026-09-01', '2026-09-30')).toEqual(['2026-09-04', '2026-09-18'])
    expect(occurrences(f, '2026-10-01', '2026-10-31')).toEqual(['2026-10-02', '2026-10-16', '2026-10-30'])
  })
  it('monthly is the first matching weekday in the month', () => {
    expect(occurrences({ ...base, frequency: 'monthly' }, '2026-10-01', '2026-10-31')).toEqual(['2026-10-02'])
    expect(occurrences({ ...base, frequency: 'monthly', startsOn: '2026-10-05' }, '2026-10-01', '2026-10-31')).toEqual(['2026-10-09'])
  })
  it('paused and released slots roll nothing', () => {
    expect(occurrences({ ...base, status: 'paused' }, '2026-10-01', '2026-10-31')).toEqual([])
    expect(occurrences({ ...base, status: 'released' }, '2026-10-01', '2026-10-31')).toEqual([])
  })
  it('the October clock-change week is just another Friday', () => {
    expect(occurrences(base, '2026-10-19', '2026-11-01')).toEqual(['2026-10-23', '2026-10-30'])
  })
})

describe('rollMonth', () => {
  it('is deterministic and sorted, and re-running produces the same rows', () => {
    const slots: SlotRule[] = [base, { ...base, id: 'finlay', weekday: 1, startMinutes: 1050 }]
    const a = rollMonth(slots, '2026-10-15'), b = rollMonth(slots, '2026-10-01')
    expect(a).toEqual(b)
    expect(a).toHaveLength(9)
    expect(a[0]).toEqual({ regularSlotId: 'ollie', date: '2026-10-02', startMinutes: 990, durationMinutes: 30 })
  })
})

describe('monthCharge', () => {
  it('is sessions minus credit, never below zero', () => {
    expect(monthCharge({ sessionPrices: [3500, 3500, 3500, 3500, 3500], creditBalancePence: 3500 }))
      .toEqual({ sessionsPence: 17500, creditAppliedPence: 3500, amountPence: 14000 })
    expect(monthCharge({ sessionPrices: [3500], creditBalancePence: 9000 }))
      .toEqual({ sessionsPence: 3500, creditAppliedPence: 3500, amountPence: 0 })
    expect(monthCharge({ sessionPrices: [], creditBalancePence: 0 }))
      .toEqual({ sessionsPence: 0, creditAppliedPence: 0, amountPence: 0 })
  })
})
