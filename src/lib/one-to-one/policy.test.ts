import { describe, expect, it } from 'vitest'
import { academyCancelCredit, declineOutcome, splitForTier, tierForNotice } from './policy'

describe('tiers by notice', () => {
  it('is full credit above 7 days, half from 7 days to 48h, none under 48h', () => {
    expect(tierForNotice(7 * 24 + 0.01)).toBe('full')
    expect(tierForNotice(7 * 24)).toBe('half')       // exactly 7 days is the half band
    expect(tierForNotice(100)).toBe('half')
    expect(tierForNotice(48)).toBe('half')           // exactly 48h still half
    expect(tierForNotice(47.99)).toBe('none')
    expect(tierForNotice(1)).toBe('none')
  })
  it('splits £35 with the odd penny to the parent', () => {
    expect(splitForTier('full', 3500)).toEqual({ creditPence: 3500, chargedPence: 0 })
    expect(splitForTier('half', 3500)).toEqual({ creditPence: 1750, chargedPence: 1750 })
    expect(splitForTier('half', 2501)).toEqual({ creditPence: 1251, chargedPence: 1250 })
    expect(splitForTier('none', 3500)).toEqual({ creditPence: 0, chargedPence: 3500 })
  })
})

describe('declineOutcome against a real session', () => {
  const session = { sessionDate: '2026-09-25', startMinutes: 990, pricePence: 3500 } // Fri 25 Sep 16:30 BST = 15:30Z
  it('9 days out is a full credit', () => {
    const o = declineOutcome({ ...session, now: new Date('2026-09-16T10:00:00Z') })
    expect(o.tier).toBe('full'); expect(o.creditPence).toBe(3500); expect(o.chargedPence).toBe(0)
    expect(o.message).toMatch(/£35 comes off next month/)
  })
  it('3 days out is half', () => {
    const o = declineOutcome({ ...session, now: new Date('2026-09-22T15:30:00Z') })
    expect(o.tier).toBe('half'); expect(o.creditPence).toBe(1750)
  })
  it('exactly 48 hours before is still half, one minute later is charged', () => {
    expect(declineOutcome({ ...session, now: new Date('2026-09-23T15:30:00Z') }).tier).toBe('half')
    expect(declineOutcome({ ...session, now: new Date('2026-09-23T15:31:00Z') }).tier).toBe('none')
  })
  it('the day before is charged in full', () => {
    const o = declineOutcome({ ...session, now: new Date('2026-09-24T18:00:00Z') })
    expect(o.tier).toBe('none'); expect(o.chargedPence).toBe(3500); expect(o.creditPence).toBe(0)
  })
  it('after the start is charged and says so', () => {
    const o = declineOutcome({ ...session, now: new Date('2026-09-25T16:00:00Z') })
    expect(o.tier).toBe('none'); expect(o.message).toMatch(/already started/)
  })
  it('uses London time across the clock change', () => {
    // Mon 26 Oct 16:30 GMT = 16:30Z. 48h before = Sat 24 Oct 16:30Z.
    const s = { sessionDate: '2026-10-26', startMinutes: 990, pricePence: 3500 }
    expect(declineOutcome({ ...s, now: new Date('2026-10-24T16:30:00Z') }).tier).toBe('half')
    expect(declineOutcome({ ...s, now: new Date('2026-10-24T16:31:00Z') }).tier).toBe('none')
  })
})

describe('academy cancellation', () => {
  it('always credits in full', () => {
    expect(academyCancelCredit(3500)).toBe(3500)
    expect(() => academyCancelCredit(-1)).toThrow()
  })
})
