import { describe, it, expect } from 'vitest'
import { classRunsOn, ukDateFromNow } from './term-window'

describe('classRunsOn — the Gold & Gray October gap (14 Oct 2026)', () => {
  const autumn = { start_date: '2026-08-17', end_date: '2026-10-11' }
  const winter = { start_date: '2026-10-26', end_date: '2026-12-19' }

  it('a class between blocks is not on', () => {
    expect(classRunsOn('2026-10-15', winter)).toBe(false)
    expect(classRunsOn('2026-10-15', autumn)).toBe(false)
  })
  it('the first and last days of a block are on', () => {
    expect(classRunsOn('2026-10-26', winter)).toBe(true)
    expect(classRunsOn('2026-12-19', winter)).toBe(true)
    expect(classRunsOn('2026-08-17', autumn)).toBe(true)
  })
  it('a class with no block runs every week, as before', () => {
    expect(classRunsOn('2026-10-15', null)).toBe(true)
    expect(classRunsOn('2026-10-15', undefined)).toBe(true)
  })
  it('a block with a missing date is open on that side', () => {
    expect(classRunsOn('2030-01-01', { start_date: '2026-08-17', end_date: null })).toBe(true)
    expect(classRunsOn('2020-01-01', { start_date: null, end_date: '2026-12-19' })).toBe(true)
  })
})

describe('ukDateFromNow', () => {
  it('tomorrow from the 6pm UK run is the next calendar day', () => {
    expect(ukDateFromNow(1, new Date('2026-10-14T17:00:00Z'))).toBe('2026-10-15')
  })
  it('uses UK time, not UTC, just after midnight in summer time', () => {
    expect(ukDateFromNow(0, new Date('2026-10-14T23:30:00Z'))).toBe('2026-10-15')
  })
})
