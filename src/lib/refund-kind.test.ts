import { describe, it, expect } from 'vitest'
import { refundKind, canRefund } from './refund-kind'

describe('which payments can be refunded from the app (15 Oct 2026)', () => {
  it('names each kind', () => {
    expect(refundKind('Camp: October Edinburgh Camps — Blythe S')).toBe('camp')
    expect(refundKind('First session — Academy/ Accelerator Membership')).toBe('bridge')
    expect(refundKind('Sessions this month — Elite Academy 2016 – 2017')).toBe('bridge')
    expect(refundKind('Elite Academy — subscription')).toBe('subscription')
    expect(refundKind('Subscription payment')).toBe('subscription')
  })
  it('a payment-link or requested payment is refundable too, as a one-off', () => {
    expect(refundKind('Elite Academy 2 kids')).toBe('one_off')
    expect(refundKind(null)).toBe('one_off')
  })
  it('only card payments that are paid get the button', () => {
    expect(canRefund({ status: 'paid', stripe_session_id: 'cs_live_abc' })).toBe(true)
    expect(canRefund({ status: 'paid', stripe_session_id: 'in_123' })).toBe(true)
    expect(canRefund({ status: 'paid', stripe_session_id: 'sub_123' })).toBe(false)
    expect(canRefund({ status: 'paid', stripe_session_id: null })).toBe(false)
    expect(canRefund({ status: 'refunded', stripe_session_id: 'cs_live_abc' })).toBe(false)
    expect(canRefund({ status: 'unpaid', stripe_session_id: 'cs_live_abc' })).toBe(false)
  })
})
