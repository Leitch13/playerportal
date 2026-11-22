import { describe, it, expect } from 'vitest'
import { upcomingClassDates, dayPlaces } from './class-places'

describe('places by date', () => {
  it('lists the class days from today, plus a far-off trial day (Rosa Sports, 3 Feb)', () => {
    const d = upcomingClassDates('2026-11-22', 'Wednesday', null, 3, ['2027-02-03', '2026-11-01'])
    expect(d).toEqual(['2026-11-25', '2026-12-02', '2026-12-09', '2027-02-03'])
  })
  it('starts at the term start when the term has not begun', () => {
    expect(upcomingClassDates('2026-11-22', 'Monday', '2027-01-05', 2)).toEqual(['2027-01-11', '2027-01-18'])
  })
  it('a class with no set day shows only its trial days', () => {
    expect(upcomingClassDates('2026-11-22', null, null, 8, ['2026-12-01'])).toEqual(['2026-12-01'])
  })
  it('counts members + trials against the limit', () => {
    const c = { capacity: 20, members: 12, trials: { '2027-02-03': [{ id: '1', child: 'Vasilis' }, { id: '2', child: 'Andy' }, { id: '3', child: 'Lucas' }, { id: '4', child: 'Rowan' }] } }
    expect(dayPlaces(c, '2027-02-03')).toMatchObject({ taken: 16, left: 4, state: 'filling', trials: ['Vasilis', 'Andy', 'Lucas', 'Rowan'] })
    expect(dayPlaces(c, '2027-02-10')).toMatchObject({ taken: 12, left: 8, state: 'open' })
    expect(dayPlaces({ capacity: 6, members: 6, trials: {} }, '2026-12-01').state).toBe('full')
    expect(dayPlaces({ capacity: 6, members: 6, trials: { x: [{ id: '1', child: 'K' }] } }, 'x')).toMatchObject({ state: 'over', left: -1 })
  })
})
