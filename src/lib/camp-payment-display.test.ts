import { describe, it, expect } from 'vitest'
import { outstanding, paidAmount } from './camp-payment-display'

// WLFA, 15 Oct 2026: unpaid children showed their camp price in green and looked paid.
describe('camp register: unpaid children get a red outstanding box, never a paid amount', () => {
  it('an unpaid booking shows what is outstanding', () => {
    expect(outstanding('pending', 80)).toBe('£80.00 outstanding')
    expect(outstanding('pending', '100')).toBe('£100.00 outstanding')
    expect(outstanding('pending', 0)).toBe('Not paid')
  })
  it('a paid, cancelled or refunded booking has nothing outstanding', () => {
    expect(outstanding('paid', 80)).toBeNull()
    expect(outstanding('cancelled', 80)).toBeNull()
    expect(outstanding('refunded', 80)).toBeNull()
  })
  it('only a paid booking counts as money received', () => {
    expect(paidAmount('paid', 80)).toBe(80)
    expect(paidAmount('pending', 80)).toBe(0)
    expect(paidAmount('cancelled', 80)).toBe(0)
  })
})
