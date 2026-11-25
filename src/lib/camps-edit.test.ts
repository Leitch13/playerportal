import { describe, it, expect } from 'vitest'
import { unbookedEditError, pickUnbookedCampFields, rebuildSchedule } from './camps-edit'

describe('before the first booking (WLFA, 25 Nov 2026)', () => {
  it('lets dates move either way and the price change', () => {
    expect(unbookedEditError({ start_date: '2026-12-21', end_date: '2026-12-23', price: 60 }, '2026-11-25')).toBeNull()
  })
  it('refuses an end before the start, a past start and a bad price', () => {
    expect(unbookedEditError({ start_date: '2026-12-21', end_date: '2026-11-25', price: 75 }, '2026-11-25')).toMatch(/end before it starts/)
    expect(unbookedEditError({ start_date: '2026-11-20', end_date: '2026-11-30', price: 75 }, '2026-11-25')).toMatch(/passed/)
    expect(unbookedEditError({ start_date: '2026-12-21', end_date: '2026-12-23', price: NaN }, '2026-11-25')).toMatch(/price/)
  })
  it('only lets price, dates and schedule through', () => {
    expect(Object.keys(pickUnbookedCampFields({ price: 1, start_date: 'a', end_date: 'b', schedule: [], name: 'x', is_published: true })).sort()).toEqual(['end_date', 'price', 'schedule', 'start_date'])
  })
  it('rebuilds the schedule for new dates and keeps activities for dates still in the camp', () => {
    const cur = [{ day: 'Monday', date: '2026-12-21', activities: ['Warm up'] }, { day: 'Tuesday', date: '2026-12-22', activities: [] }]
    const next = rebuildSchedule('2026-12-20', '2026-12-21', cur)
    expect(next.map((d) => d.date)).toEqual(['2026-12-20', '2026-12-21'])
    expect(next[1].activities).toEqual(['Warm up'])
  })
})
