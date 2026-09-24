import { describe, it, expect } from 'vitest'
import { ageRange } from './GroupedClassList'

describe('ageRange (real programme names from busy academies)', () => {
  it.each([
    ['Intensity (11-13 yrs)', [], [11, 13]],
    ['Academy Class 7-9 yrs', [], [7, 9]],
    ['Little Ballers (3-5 yrs) 12:15', [], [3, 5]],
    ['Mini Ballers (18mths - 3yrs)', [], [0, 3]],
    ['Buzzing Ballers (5-7 yrs)', ['U8'], [5, 7]],
    ['Girls Accelerator (11-13 yrs)', ['U14'], [11, 13]],
  ] as [string, string[], [number, number]][])('%s → %j', (name, groups, want) => {
    expect(ageRange(name, groups)).toEqual(want)
  })
  it('falls back to the age group when the name has no ages', () => {
    expect(ageRange('Goalkeeper Class', ['U10'])).toEqual([7, 9])
  })
  it('unknown → null (shown under every age)', () => {
    expect(ageRange('1-2-1', ['MIXED'])).toBeNull()
    expect(ageRange('1-2-1 Balmoral Stadium, Cove', [])).toBeNull()
  })
  it('reads birth years as ages (2026)', () => {
    const y = new Date().getUTCFullYear()
    expect(ageRange('2015 - 2017 Friday Night Group', ['U11'])).toEqual([y - 2017 - 1, y - 2015])
    expect(ageRange('Thursday - 2016-2018 Session', [])).toEqual([y - 2018 - 1, y - 2016])
  })
  it('a time like 12:15 is not an age', () => {
    expect(ageRange('Tots 12:15', [])).toBeNull()
  })
})
