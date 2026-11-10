import { describe, it, expect } from 'vitest'
import { describeUnconfirmed, unconfirmedDueToday, type UnconfirmedRow } from './parent-unconfirmed'

const row = (over: Partial<UnconfirmedRow> = {}): UnconfirmedRow => ({
  id: 's1',
  invite_token: 'tok_1234567890',
  migration_billing_starts_at: null,
  player: { first_name: 'Jacob', enrolments: [{ status: 'active', training_groups: { day_of_week: 'Monday' } }] },
  plan: { name: 'Academy Membership', amount: 41.99 },
  ...over,
})

describe('describeUnconfirmed (Tim Shek, 10 Nov 2026)', () => {
  it('shows what confirming takes today, the monthly price and the confirm link', () => {
    // Tue 10 Nov 2026: Mondays left this month are 16, 23, 30 → 3 × £41.99/4 = £31.49
    const m = describeUnconfirmed(row(), new Date('2026-11-10T15:00:00Z'))!
    expect(m.childFirstName).toBe('Jacob')
    expect(m.todayAmount).toBeCloseTo(31.49, 1)
    expect(m.todayLabel).toBe('3 sessions this month')
    expect(m.monthly).toBe(41.99)
    expect(m.monthlyFrom).toBe('1 December')
    expect(m.href).toBe('/confirm-subscription/tok_1234567890')
  })
  it('a membership already paid another way until a later date takes nothing today', () => {
    const m = describeUnconfirmed(row({ migration_billing_starts_at: '2026-12-01T00:00:00Z' }), new Date('2026-11-10T15:00:00Z'))!
    expect(m.todayAmount).toBe(0)
    expect(m.todayLabel).toMatch(/^Nothing today, first payment 1 December/)
  })
  it('no invite link means nothing to show', () => {
    expect(describeUnconfirmed(row({ invite_token: null }))).toBeNull()
  })
  it('adds up what is due today', () => {
    const now = new Date('2026-11-10T15:00:00Z')
    const a = describeUnconfirmed(row(), now)!
    const b = describeUnconfirmed(row({ id: 's2', migration_billing_starts_at: '2026-12-01T00:00:00Z' }), now)!
    expect(unconfirmedDueToday([a, b])).toBeCloseTo(a.todayAmount, 2)
  })
})
