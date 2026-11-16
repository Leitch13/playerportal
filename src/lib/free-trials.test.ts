import { describe, it, expect } from 'vitest'
import { freeTrialsFrom, secondDateOk, canBook, trialDatesLabel } from './free-trials'

describe('free trial sessions (John, 16 Nov 2026)', () => {
  it('is 1 unless the academy chose 2', () => {
    expect(freeTrialsFrom(undefined)).toBe(1)
    expect(freeTrialsFrom(null)).toBe(1)
    expect(freeTrialsFrom(1)).toBe(1)
    expect(freeTrialsFrom(2)).toBe(2)
    expect(freeTrialsFrom('2')).toBe(2)
    expect(freeTrialsFrom(5)).toBe(1)
  })
  it('second date must come after the first', () => {
    expect(secondDateOk('2026-11-21', '2026-11-28')).toBe(true)
    expect(secondDateOk('2026-11-21', '2026-11-21')).toBe(false)
    expect(secondDateOk('2026-11-28', '2026-11-21')).toBe(false)
    expect(secondDateOk(null, '2026-11-28')).toBe(false)
    expect(secondDateOk('2026-11-21', 'nope')).toBe(false)
  })
  it('never more free sessions than the academy allows', () => {
    expect(canBook(0, 1, 1)).toBe(true)
    expect(canBook(1, 1, 1)).toBe(false) // one-trial academies: unchanged
    expect(canBook(0, 2, 1)).toBe(false)
    expect(canBook(0, 2, 2)).toBe(true)
    expect(canBook(1, 1, 2)).toBe(true) // came back for the second
    expect(canBook(1, 2, 2)).toBe(false)
    expect(canBook(2, 1, 2)).toBe(false)
  })
  it('labels one or two dates', () => {
    expect(trialDatesLabel('2026-11-21', null)).toBe('Saturday 21 November')
    expect(trialDatesLabel('2026-11-21', '2026-11-28')).toBe('Saturday 21 November and Saturday 28 November')
    expect(trialDatesLabel(null, null)).toBe(null)
  })
})
