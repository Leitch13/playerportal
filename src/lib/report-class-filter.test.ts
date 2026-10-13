import { describe, it, expect } from 'vitest'
import { playersInClass, reportCoverage, classOptionLabel } from './report-class-filter'

const places = [
  { player_id: 'ava', group_id: 'u9' }, { player_id: 'ben', group_id: 'u9' }, { player_id: 'ben', group_id: 'u9' },
  { player_id: 'cal', group_id: 'u11' }, { player_id: 'ava', group_id: 'u11' },
]

describe('who is in a class', () => {
  it('lists each child once', () => { expect(playersInClass(places, 'u9')).toEqual(['ava', 'ben']) })
  it('a child in two classes shows under both', () => { expect(playersInClass(places, 'u11')).toEqual(['cal', 'ava']) })
  it('an unknown class has nobody', () => { expect(playersInClass(places, 'nope')).toEqual([]) })
})

describe('who still needs a report', () => {
  it('counts reports only for children in the class', () => {
    expect(reportCoverage(['ava', 'ben'], ['ava', 'cal'])).toEqual({ total: 2, withReport: 1, missing: ['ben'] })
  })
  it('everyone done', () => { expect(reportCoverage(['ava'], ['ava'])).toEqual({ total: 1, withReport: 1, missing: [] }) })
  it('an empty class', () => { expect(reportCoverage([], ['ava'])).toEqual({ total: 0, withReport: 0, missing: [] }) })
})

describe('naming a class', () => {
  it('adds the day', () => { expect(classOptionLabel({ name: 'Mini Kickers', day_of_week: 'Saturday' })).toBe('Mini Kickers · Saturday') })
  it('does not repeat a day already in the name', () => { expect(classOptionLabel({ name: 'Saturday 9am Tots', day_of_week: 'Saturday' })).toBe('Saturday 9am Tots') })
  it('copes with no day', () => { expect(classOptionLabel({ name: 'Goalkeepers', day_of_week: null })).toBe('Goalkeepers') })
})
