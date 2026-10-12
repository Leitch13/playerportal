import { describe, it, expect } from 'vitest'
import { nextMark, ageOn, weekdayOf, latestClassDate, countMarks, registerCsv } from './class-register'

describe('marking a child', () => {
  it('goes not marked → here → away → not marked', () => {
    expect(nextMark('unmarked')).toBe('present'); expect(nextMark('present')).toBe('absent'); expect(nextMark('absent')).toBe('unmarked')
  })
  it('counts here, away and not marked', () => {
    expect(countMarks(['a', 'b', 'c', 'd'], { a: 'present', b: 'absent', c: 'present' })).toEqual({ present: 2, absent: 1, unmarked: 1 })
  })
})

describe('age from a date of birth', () => {
  it('is whole years on the day asked', () => {
    expect(ageOn('2017-05-05', '2026-10-12')).toBe(9)
    expect(ageOn('2017-10-13', '2026-10-12')).toBe(8)
    expect(ageOn('2017-10-12', '2026-10-12')).toBe(9)
  })
  it('is nothing when there is no date of birth, or a nonsense one', () => {
    expect(ageOn(null, '2026-10-12')).toBeNull(); expect(ageOn('', '2026-10-12')).toBeNull(); expect(ageOn('2030-01-01', '2026-10-12')).toBeNull()
  })
})

describe('which date the register opens on', () => {
  it('knows the weekday', () => { expect(weekdayOf('2026-10-17')).toBe('Saturday'); expect(weekdayOf('2026-10-12')).toBe('Monday') })
  it('opens on today when the class runs today', () => { expect(latestClassDate('2026-10-12', 'Monday')).toBe('2026-10-12') })
  it('otherwise opens on the last time the class ran', () => { expect(latestClassDate('2026-10-12', 'Saturday')).toBe('2026-10-10'); expect(latestClassDate('2026-10-12', 'Tuesday')).toBe('2026-10-06') })
  it('uses today when the class has no set day', () => { expect(latestClassDate('2026-10-12', null)).toBe('2026-10-12') })
})

describe('exporting a register', () => {
  it('quotes every cell and doubles any quote inside one', () => {
    expect(registerCsv([['Name', 'Medical'], ['Ava "Sparky" Reid', 'Nut allergy, EpiPen']])).toBe('"Name","Medical"\r\n"Ava ""Sparky"" Reid","Nut allergy, EpiPen"')
  })
})
