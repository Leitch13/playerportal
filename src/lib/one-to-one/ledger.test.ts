import { describe, expect, it } from 'vitest'
import { chargeBreakdown, declineEffect, isChargeable, nextAttemptOn } from './ledger'

const s = (id: string, status: string, declineTier: string | null = null) => ({ id, pricePence: 3500, status, declineTier })

describe('what counts in a month', () => {
  it('scheduled, attended and no-show count; cancelled, held and declined do not', () => {
    expect(isChargeable(s('a', 'scheduled'))).toBe(true)
    expect(isChargeable(s('b', 'attended'))).toBe(true)
    expect(isChargeable(s('c', 'no_show'))).toBe(true)
    expect(isChargeable(s('d', 'cancelled'))).toBe(false)
    expect(isChargeable(s('e', 'held'))).toBe(false)
    expect(isChargeable(s('f', 'declined', 'full'))).toBe(false)
    expect(isChargeable(s('g', 'declined', 'half'))).toBe(false)
  })
  it('a date declined under 48h before the charge still counts', () => {
    expect(isChargeable(s('h', 'declined', 'none'))).toBe(true)
  })
})

describe('chargeBreakdown', () => {
  it('five Fridays minus a £35 credit is £140', () => {
    const b = chargeBreakdown([s('1', 'scheduled'), s('2', 'scheduled'), s('3', 'scheduled'), s('4', 'scheduled'), s('5', 'scheduled')], 3500)
    expect(b).toEqual({ sessionIds: ['1', '2', '3', '4', '5'], sessionsPence: 17500, creditAvailablePence: 3500, creditAppliedPence: 3500, amountPence: 14000 })
  })
  it('credit never takes the charge below zero and only uses what it needs', () => {
    const b = chargeBreakdown([s('1', 'scheduled')], 9000)
    expect(b.creditAppliedPence).toBe(3500); expect(b.amountPence).toBe(0)
  })
  it('a debit on the ledger adds to the charge', () => {
    const b = chargeBreakdown([s('1', 'scheduled'), s('2', 'scheduled')], -1750)
    expect(b.creditAppliedPence).toBe(-1750); expect(b.amountPence).toBe(8750)
  })
  it('an empty month is £0 and applies no credit', () => {
    expect(chargeBreakdown([], 3500)).toEqual({ sessionIds: [], sessionsPence: 0, creditAvailablePence: 3500, creditAppliedPence: 0, amountPence: 0 })
  })
})

describe('declineEffect', () => {
  it('already paid: full credit, half credit, or nothing', () => {
    expect(declineEffect('full', 3500, true)).toMatchObject({ ledgerPence: 3500, stillChargeable: false })
    expect(declineEffect('half', 3500, true)).toMatchObject({ ledgerPence: 1750, stillChargeable: false })
    expect(declineEffect('none', 3500, true)).toMatchObject({ ledgerPence: 0, stillChargeable: false })
  })
  it('not yet paid: drops out, half leaves a debit, none stays chargeable', () => {
    expect(declineEffect('full', 3500, false)).toMatchObject({ ledgerPence: 0, stillChargeable: false })
    expect(declineEffect('half', 3500, false)).toMatchObject({ ledgerPence: -1750, stillChargeable: false })
    expect(declineEffect('none', 3500, false)).toMatchObject({ ledgerPence: 0, stillChargeable: true })
  })
})

describe('retry calendar', () => {
  it('goes 1st → 4th → 8th → a human', () => {
    expect(nextAttemptOn('2026-10-01', 1)).toBe('2026-10-04')
    expect(nextAttemptOn('2026-10-01', 2)).toBe('2026-10-08')
    expect(nextAttemptOn('2026-10-01', 3)).toBeNull()
  })
})
