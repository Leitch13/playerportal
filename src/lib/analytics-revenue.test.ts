import { describe, it, expect } from 'vitest'
import { oneToOneByMonth, oneToOnePaidOn } from './analytics-revenue'

const label = (d: Date) => d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
const SEP = label(new Date('2026-09-15T12:00:00Z')), OCT = label(new Date('2026-10-15T12:00:00Z'))
const months = [SEP, OCT]
const row = (o: Partial<Parameters<typeof oneToOnePaidOn>[0]>) => ({ status: 'paid_online', amount_pence: 7000, cash_received_at: null, updated_at: '2026-10-02T09:00:00Z', created_at: '2026-09-28T09:00:00Z', ...o })

describe('1-2-1 money on Analytics (No.1 GK, 15 Oct 2026)', () => {
  it('a card-paid charge counts in the month it was paid', () => {
    expect(oneToOneByMonth([row({})], label, months).get(OCT)).toBe(70)
  })
  it('cash counts on the day it was marked received', () => {
    const m = oneToOneByMonth([row({ status: 'paid_cash', cash_received_at: '2026-09-30T18:00:00Z' })], label, months)
    expect(m.get(SEP)).toBe(70)
    expect(m.get(OCT)).toBe(0)
  })
  it('unpaid, failed, waived and refunded charges are not revenue', () => {
    const m = oneToOneByMonth(['pending', 'failed', 'waived', 'refunded', 'cancelled'].map((status) => row({ status })), label, months)
    expect(m.get(OCT)).toBe(0)
  })
  it('a month outside the chart is ignored', () => {
    expect([...oneToOneByMonth([row({ updated_at: '2026-01-05T09:00:00Z' })], label, months).values()]).toEqual([0, 0])
  })
})
