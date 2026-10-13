import { describe, it, expect } from 'vitest'
import { checkedInNow, checkinKey, dateDayId, datesBetween, CHECKED_IN_ACTION as IN, CHECK_IN_UNDONE_ACTION as OUT } from './camp-checkin'

const row = (action: string, booking: string, day: string, at: string) => ({ action, entity_id: booking, created_at: at, details: { camp_day_id: day } })

describe('who is ticked in on a camp day', () => {
  it('a tick counts for that child on that day only', () => {
    const now = checkedInNow([row(IN, 'b1', 'tue', '2026-10-13T09:00:00Z')])
    expect(now.has(checkinKey('b1', 'tue'))).toBe(true)
    expect(now.has(checkinKey('b1', 'thu'))).toBe(false)
    expect(now.has(checkinKey('b2', 'tue'))).toBe(false)
  })
  it('the last press wins: ticked, unticked, ticked again', () => {
    const rows = [row(IN, 'b1', 'tue', '2026-10-13T09:00:00Z'), row(OUT, 'b1', 'tue', '2026-10-13T09:01:00Z')]
    expect(checkedInNow(rows).size).toBe(0)
    expect(checkedInNow([...rows, row(IN, 'b1', 'tue', '2026-10-13T09:02:00Z')]).has(checkinKey('b1', 'tue'))).toBe(true)
  })
  it('does not depend on the order the rows arrive in', () => {
    const rows = [row(OUT, 'b1', 'tue', '2026-10-13T09:01:00Z'), row(IN, 'b1', 'tue', '2026-10-13T09:00:00Z')]
    expect(checkedInNow(rows).size).toBe(0)
  })
  it('ignores a row with no child or no day', () => {
    expect(checkedInNow([{ action: IN, entity_id: null, created_at: 'x', details: { camp_day_id: 'tue' } }, { action: IN, entity_id: 'b1', created_at: 'x', details: null }]).size).toBe(0)
  })
})

describe('a whole-week camp keeps its register by date', () => {
  it('a tick with only a date counts for that date', () => {
    const now = checkedInNow([{ action: IN, entity_id: 'b1', created_at: '2026-10-19T09:00:00Z', details: { date: '2026-10-19' } }])
    expect(now.has(checkinKey('b1', dateDayId('2026-10-19')))).toBe(true)
    expect(now.has(checkinKey('b1', dateDayId('2026-10-20')))).toBe(false)
  })
  it('a by-the-day camp still goes by its day row, even though it records the date too', () => {
    const now = checkedInNow([{ action: IN, entity_id: 'b1', created_at: 'x', details: { camp_day_id: 'tue', date: '2026-10-13' } }])
    expect(now.has(checkinKey('b1', 'tue'))).toBe(true)
    expect(now.has(checkinKey('b1', dateDayId('2026-10-13')))).toBe(false)
  })
  it('lists each day of the camp', () => {
    expect(datesBetween('2026-10-19', '2026-10-22')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'])
    expect(datesBetween('2026-10-19', null)).toEqual(['2026-10-19'])
    expect(datesBetween('2026-10-23', '2026-10-23')).toEqual(['2026-10-23'])
  })
  it('copes with missing or backwards dates, and never runs away', () => {
    expect(datesBetween(null, '2026-10-22')).toEqual([])
    expect(datesBetween('2026-10-22', '2026-10-19')).toEqual(['2026-10-22'])
    expect(datesBetween('2026-01-01', '2027-01-01')).toHaveLength(31)
  })
})
