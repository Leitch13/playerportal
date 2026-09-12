import { describe, expect, it } from 'vitest'
import {
  addDays, daysBetween, hhmmToMinutes, instantToLondon, isoWeekday, londonOffsetMinutes,
  londonToInstant, minutesToHHMM, monthEnd, monthStart, nextMonthStart,
} from './time'

describe('calendar arithmetic', () => {
  it('adds days across a month end', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
    expect(daysBetween('2026-09-01', '2026-10-01')).toBe(30)
  })
  it('knows ISO weekdays', () => {
    expect(isoWeekday('2026-09-14')).toBe(1) // Monday
    expect(isoWeekday('2026-09-13')).toBe(7) // Sunday
    expect(isoWeekday('2026-10-30')).toBe(5) // Friday
  })
  it('finds month bounds', () => {
    expect(monthStart('2026-02-17')).toBe('2026-02-01')
    expect(monthEnd('2026-02-17')).toBe('2026-02-28')
    expect(monthEnd('2028-02-01')).toBe('2028-02-29')
    expect(nextMonthStart('2026-12-05')).toBe('2027-01-01')
  })
  it('converts hh:mm', () => {
    expect(hhmmToMinutes('16:30')).toBe(990)
    expect(minutesToHHMM(990)).toBe('16:30')
    expect(() => hhmmToMinutes('25:00')).toThrow()
  })
})

describe('Europe/London — the October clock change (Sun 25 Oct 2026)', () => {
  it('is BST before and GMT after', () => {
    expect(londonOffsetMinutes(new Date('2026-10-24T12:00:00Z'))).toBe(60)
    expect(londonOffsetMinutes(new Date('2026-10-26T12:00:00Z'))).toBe(0)
  })
  it('keeps a 16:30 slot at 16:30 on both sides', () => {
    expect(londonToInstant('2026-10-24', 990).toISOString()).toBe('2026-10-24T15:30:00.000Z')
    expect(londonToInstant('2026-10-26', 990).toISOString()).toBe('2026-10-26T16:30:00.000Z')
    expect(instantToLondon(new Date('2026-10-24T15:30:00Z'))).toEqual({ date: '2026-10-24', minutes: 990 })
    expect(instantToLondon(new Date('2026-10-26T16:30:00Z'))).toEqual({ date: '2026-10-26', minutes: 990 })
  })
  it('handles the March change too (Sun 29 Mar 2026)', () => {
    expect(londonToInstant('2026-03-28', 600).toISOString()).toBe('2026-03-28T10:00:00.000Z')
    expect(londonToInstant('2026-03-30', 600).toISOString()).toBe('2026-03-30T09:00:00.000Z')
  })
  it('round-trips midnight without Intl rendering hour 24', () => {
    expect(instantToLondon(new Date('2026-07-01T23:00:00Z'))).toEqual({ date: '2026-07-02', minutes: 0 })
  })
})
