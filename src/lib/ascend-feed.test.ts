import { describe, it, expect } from 'vitest'
import { contactHashes, matchFamilies, moneyMonths, monthlyWorth } from './ascend-feed'

describe('ASCEND dashboard link', () => {
  it('hashes email and phone the same however they are written', () => {
    expect(contactHashes('Jo@Example.com ', '07411 019 365')).toEqual(contactHashes('jo@example.com', '+44 7411019365'))
    expect(contactHashes(null, '123')).toEqual([])
  })

  it('answers only for families the dashboard asked about, with the earliest dates', () => {
    const [e] = contactHashes('a@x.com'), [p] = contactHashes(null, '07700900123')
    const m = matchFamilies(new Set([e, p]),
      [{ email: 'A@x.com', at: '2026-10-20' }, { email: 'a@x.com', at: '2026-10-12' }, { email: 'other@x.com', at: '2026-10-01' }],
      [{ phone: '+447700900123', at: '2026-10-25' }])
    expect(m[e]).toEqual({ trial_at: '2026-10-12' })
    expect(m[p]).toEqual({ joined_at: '2026-10-25' })
    expect(Object.keys(m)).toHaveLength(2)
  })

  it('works out money, joiners, leavers and members at the end of each month', () => {
    const months = moneyMonths('2026-11', 3,
      [{ amount: 60, at: '2026-10-01T06:00:00Z' }, { amount: 40.5, at: '2026-10-15T06:00:00Z' }, { amount: 60, at: '2026-11-01T06:00:00Z' }],
      [
        { status: 'active', created_at: '2026-09-10T00:00:00Z', ended_at: null },
        { status: 'canceled', created_at: '2026-10-02T00:00:00Z', ended_at: '2026-11-01T00:00:00Z' },
        { status: 'pending_migration', created_at: '2026-10-05T00:00:00Z', ended_at: null },
      ])
    expect(months.map((m) => m.month)).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(months[1]).toEqual({ month: '2026-10', revenue: 100.5, new_members: 1, lost_members: 0, members: 2 })
    expect(months[2]).toMatchObject({ lost_members: 1, members: 1 })
  })

  it('counts a quarterly plan as a third a month', () => {
    expect(monthlyWorth(90, 'quarter')).toBe(30)
    expect(monthlyWorth(60, 'month')).toBe(60)
  })
})
