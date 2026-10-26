import { describe, it, expect } from 'vitest'
import { trialPaymentDescription } from './trial-payment-record'

// 26 Oct 2026: paid trials never appeared on Payments. Each now gets a clear line.
describe('paid trial on Payments', () => {
  it('says it is a trial, the class, the day and the child', () => {
    expect(trialPaymentDescription('CFC INTRO', '2026-11-02', 'Kylan Bamford')).toBe('Trial · CFC INTRO · Mon 2 Nov · Kylan Bamford')
  })
  it('still reads well with no class or date', () => {
    expect(trialPaymentDescription(null, null, 'Sam')).toBe('Trial · Sam')
  })
})
