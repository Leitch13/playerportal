import { describe, it, expect } from 'vitest'
import { toMoneyRows, summarise, type ChargeIn, type OneOffIn } from './money-report'

// No.1, 19 Oct 2026: 1-2-1 money was on no Payments list, export or Analytics card.
const people = {
  parents: new Map([['p1', { name: 'Sarah Logan', email: 's@x.test' }], ['p2', { name: 'Mark Reid', email: null }]]),
  childrenByCharge: new Map([['c1', ['Kenneth Logan', 'Kenneth Logan']]]),
  childNames: new Map([['k2', 'Finn Reid']]),
}
const charge = (o: Partial<ChargeIn>): ChargeIn => ({ id: 'c1', parent_id: 'p1', billing_month: '2026-10-01', status: 'pending', amount_pence: 8000, cash_received_at: null, updated_at: '2026-10-03T09:00:00Z', created_at: '2026-09-30T10:00:00Z', ...o })

describe('1-2-1 money for Payments, Analytics and Exports', () => {
  it('a set-up link not paid is money waiting, dated by the month it is for', () => {
    const [r] = toMoneyRows([charge({})], [], people)
    expect(r.status).toBe('waiting')
    expect(r.date).toBe('2026-10-01')
    expect(r.children).toBe('Kenneth Logan')
    expect(r.what).toBe('1-2-1s · October 2026')
  })
  it('a card payment is dated the day it was paid; cash the day it was received', () => {
    const rows = toMoneyRows([charge({ status: 'paid_online' }), charge({ id: 'c2', status: 'paid_cash', cash_received_at: '2026-10-05T12:00:00Z' })], [], people)
    expect(rows.map((r) => [r.status, r.date])).toEqual([['paid_cash', '2026-10-05'], ['paid', '2026-10-03']])
  })
  it('a booked one-off shows the parent or guest and the child', () => {
    const oneOff: OneOffIn = { id: 's1', parent_id: 'p2', player_id: 'k2', session_date: '2026-10-21', start_minutes: 1020, price_pence: 4000, charge_state: 'paid_online', guest_name: null, guest_email: null, guest_child_name: null, updated_at: '2026-10-19T08:00:00Z', created_at: '2026-10-19T08:00:00Z' }
    const [r] = toMoneyRows([], [oneOff, { ...oneOff, id: 's2', parent_id: null, player_id: null, guest_name: 'Guest Dad', guest_child_name: 'Sam' }], people)
    expect(r.parentName).toBe('Mark Reid'); expect(r.children).toBe('Finn Reid'); expect(r.what).toBe('1-2-1 booked · Wed 21 Oct 17:00')
    const g = toMoneyRows([], [{ ...oneOff, parent_id: null, player_id: null, guest_name: 'Guest Dad', guest_child_name: 'Sam' }], people)[0]
    expect([g.parentName, g.children]).toEqual(['Guest Dad', 'Sam'])
  })
  it('totals: paid, waiting and card failed kept apart; £0 covered by credit is not waiting', () => {
    const s = summarise(toMoneyRows([charge({ status: 'paid_online', amount_pence: 2500 }), charge({ id: 'c2', amount_pence: 4000 }), charge({ id: 'c3', status: 'failed', amount_pence: 1000 }), charge({ id: 'c4', amount_pence: 0 })], [], people))
    expect(s).toEqual({ paidPence: 2500, waitingPence: 4000, failedPence: 1000, waitingCount: 1, failedCount: 1 })
  })
})
