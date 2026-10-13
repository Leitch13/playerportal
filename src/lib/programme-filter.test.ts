import { describe, it, expect } from 'vitest'
import { classesForProgramme, programmeKey, programmeTitle } from './programme-filter'

const classes = [
  { id: 'a', name: 'Goalscorers - Wednesday Night' },
  { id: 'b', name: 'Goalscorers  Small Groups - Mondays' },
  { id: 'c', name: 'Mini Ballers - Balmaise Centre, Leven (3-5 year old)' },
  { id: 'd', name: '1-2-1' },
]

describe('a booking page for one programme', () => {
  it('shows only the classes of the programme asked for', () => {
    expect(classesForProgramme(classes, 'goalscorers')?.map(c => c.id)).toEqual(['a', 'b'])
    expect(classesForProgramme(classes, 'Mini Ballers')?.map(c => c.id)).toEqual(['c'])
    expect(classesForProgramme(classes, 'goal-scorers')?.map(c => c.id)).toEqual(['a', 'b'])
  })
  it('falls back to the full page rather than an empty one', () => {
    expect(classesForProgramme(classes, 'swimming')).toBeNull()
    expect(classesForProgramme(classes, '')).toBeNull()
    expect(classesForProgramme(classes, 'go')).toBeNull()
    expect(classesForProgramme(classes, undefined)).toBeNull()
    expect(classesForProgramme(classes, ['goalscorers'])).toBeNull()
  })
  it('names the page from the link, safely', () => {
    expect(programmeTitle('goalscorers')).toBe('Goalscorers')
    expect(programmeTitle('mini-ballers')).toBe('Mini Ballers')
    expect(programmeTitle('<script>x</script>')).toBe('Script X Script')
    expect(programmeKey('1-2-1')).toBe('121')
  })
})
