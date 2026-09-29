import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/stripe', () => ({ stripe: {} }))
import { allocate, isEmptyBalanceError } from './refund-recovery'

describe('allocate', () => {
  const open = [{ id: 'a', remainingPence: 7720 }, { id: 'b', remainingPence: 3000 }]
  it('takes from the oldest first', () => {
    expect(allocate(open, 5000)).toEqual([{ recoveryId: 'a', amountPence: 5000 }])
  })
  it('spills into the next once the oldest is covered', () => {
    expect(allocate(open, 9000)).toEqual([{ recoveryId: 'a', amountPence: 7720 }, { recoveryId: 'b', amountPence: 1280 }])
  })
  it('never takes more than is owed', () => {
    expect(allocate(open, 50000).reduce((s, x) => s + x.amountPence, 0)).toBe(10720)
  })
  it('takes nothing for nothing', () => {
    expect(allocate(open, 0)).toEqual([])
  })
})

describe('isEmptyBalanceError', () => {
  it('recognises Stripe insufficient-balance errors', () => {
    expect(isEmptyBalanceError({ code: 'balance_insufficient' })).toBe(true)
    expect(isEmptyBalanceError({ raw: { code: 'insufficient_funds' } })).toBe(true)
    expect(isEmptyBalanceError({ message: 'Insufficient funds in Stripe account. In test mode, you can add funds...' })).toBe(true)
  })
  it('leaves every other failure alone', () => {
    expect(isEmptyBalanceError({ code: 'charge_already_refunded', message: 'Charge ch_1 has already been refunded.' })).toBe(false)
    expect(isEmptyBalanceError(null)).toBe(false)
  })
})
