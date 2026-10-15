import { describe, it, expect } from 'vitest'
import { classOutstanding } from './class-outstanding'

// John, 15 Oct 2026: a red box with what's outstanding next to the child, like ClassForKids.
describe('class register red outstanding box', () => {
  it('an unpaid or part-paid payment shows what is left', () => {
    expect(classOutstanding({ payments: [{ status: 'unpaid', amount: 40, amount_paid: 0 }], subs: [{ status: 'active', planAmount: 36 }] })).toBe('£40.00 outstanding')
    expect(classOutstanding({ payments: [{ status: 'partial', amount: 50, amount_paid: 20 }, { status: 'overdue', amount: 36, amount_paid: null }], subs: [] })).toBe('£66.00 outstanding')
  })
  it('a membership whose payment failed or was never finished shows the month owed', () => {
    expect(classOutstanding({ payments: [], subs: [{ status: 'past_due', planAmount: 36 }] })).toBe('£36.00 outstanding')
    expect(classOutstanding({ payments: [], subs: [{ status: 'incomplete', planAmount: '45' }] })).toBe('£45.00 outstanding')
  })
  it('no membership at all is flagged, unless on a trial', () => {
    expect(classOutstanding({ payments: [], subs: [] })).toBe('No membership')
    expect(classOutstanding({ payments: [], subs: [{ status: 'canceled', planAmount: 36 }] })).toBe('No membership')
    expect(classOutstanding({ payments: [], subs: [], isTrial: true })).toBeNull()
  })
  it('a paying child has nothing', () => {
    expect(classOutstanding({ payments: [], subs: [{ status: 'active', planAmount: 36 }] })).toBeNull()
    expect(classOutstanding({ payments: [{ status: 'paid', amount: 36, amount_paid: 36 }], subs: [{ status: 'active', planAmount: 36 }] })).toBeNull()
  })
})
