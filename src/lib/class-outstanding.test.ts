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
  it('invited but never confirmed is not paying: red with the monthly amount (PFC, 26 Oct 2026)', () => {
    expect(classOutstanding({ payments: [], subs: [{ status: 'pending_migration', planAmount: 40 }] })).toBe('£40.00 outstanding')
  })
})

describe('invite paid up to a later month another way (5 Nov 2026)', () => {
  it('shows nothing while the first card payment is a later month', () => {
    expect(classOutstanding({ payments: [], subs: [{ status: 'pending_migration', planAmount: 40, billingStartsAt: '2026-12-01T00:00:00Z' }], today: '2026-11-05' })).toBeNull()
  })
  it('owes again once that month comes', () => {
    expect(classOutstanding({ payments: [], subs: [{ status: 'pending_migration', planAmount: 40, billingStartsAt: '2026-12-01T00:00:00Z' }], today: '2026-12-02' })).toBe('£40.00 outstanding')
  })
  it('still owes when the first payment date has passed', () => {
    expect(classOutstanding({ payments: [], subs: [{ status: 'pending_migration', planAmount: 40, billingStartsAt: '2026-11-01T00:00:00Z' }], today: '2026-11-05' })).toBe('£40.00 outstanding')
  })
})
