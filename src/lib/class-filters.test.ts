import { describe, it, expect } from 'vitest'
import { classFilterOptions, matchesClassFilters, activeFilterCount } from './class-filters'

const classes = [
  { day_of_week: 'Saturday', age_group: 'U6', location: 'Aberdeen Sports Village', coachName: 'Matty' },
  { day_of_week: 'Tuesday', age_group: 'U9', location: 'Aberdeen Sports Village ', coachName: 'John' },
  { day_of_week: 'Monday', age_group: 'U14', location: 'Hazlehead Park 3G', coachName: 'John' },
  { day_of_week: 'Tuesday', age_group: 'U11', location: 'hazlehead park 3g', coachName: null },
  { day_of_week: null, age_group: null, location: null, coachName: null },
]

describe('what the filters offer', () => {
  const o = classFilterOptions(classes)
  it('days in week order, with a count', () => { expect(o.days).toEqual([{ label: 'Monday', count: 1 }, { label: 'Tuesday', count: 2 }, { label: 'Saturday', count: 1 }]) })
  it('age groups youngest first: U6, U9, U11, U14', () => { expect(o.ages.map((a) => a.label)).toEqual(['U6', 'U9', 'U11', 'U14']) })
  it('treats a venue typed with different capitals or a trailing space as one venue', () => { expect(o.venues).toEqual([{ label: 'Aberdeen Sports Village', count: 2 }, { label: 'Hazlehead Park 3G', count: 2 }]) })
  it('leaves out a class with nothing set, and a coach nobody is assigned as', () => { expect(o.coaches).toEqual([{ label: 'John', count: 2 }, { label: 'Matty', count: 1 }]) })
})

describe('narrowing the list', () => {
  it('no filters shows everything', () => { expect(classes.filter((c) => matchesClassFilters(c, {}))).toHaveLength(5) })
  it('one filter', () => { expect(classes.filter((c) => matchesClassFilters(c, { day: 'Tuesday' }))).toHaveLength(2) })
  it('two filters must both match', () => { expect(classes.filter((c) => matchesClassFilters(c, { day: 'Tuesday', venue: 'Hazlehead Park 3G' }))).toHaveLength(1) })
  it('a class with no coach is not shown under a coach', () => { expect(classes.filter((c) => matchesClassFilters(c, { coach: 'John' }))).toHaveLength(2) })
  it('counts how many are switched on', () => { expect(activeFilterCount({ day: 'Monday', age: '', venue: ' ', coach: 'John' })).toBe(2) })
})
