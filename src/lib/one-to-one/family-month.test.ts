import { describe, it, expect } from 'vitest'
import { buildFamilyMonth, offReason, type FamilySessionRow } from './family-month'

const r = (o: Partial<FamilySessionRow>): FamilySessionRow => ({ id: o.id || Math.random().toString(36).slice(2), session_date: '2026-11-04', start_minutes: 1020, coach_id: 'c', venue_id: 'v', price_pence: 4000, status: 'scheduled', decline_tier: null, charge_state: 'unpaid', note: null, regular_slot_id: 's1', source: 'regular', player_id: 'p', ...o })

// John, 18 Oct 2026: "if they can't make the 18th of November that is now missing from the invoice"
describe("a family's month: what's on, what's off and why, and the bill", () => {
  const nov = [r({ session_date: '2026-11-04' }), r({ session_date: '2026-11-11' }), r({ session_date: '2026-11-18', status: 'declined', decline_tier: 'full' }), r({ session_date: '2026-11-25' })]
  it("a date they can't make comes off the bill and says why", () => {
    const m = buildFamilyMonth(nov, null, 0)
    expect(m.on.map((l) => l.date)).toEqual(['2026-11-04', '2026-11-11', '2026-11-25'])
    expect(m.off[0].why).toBe("you couldn't make it · not charged")
    expect([m.sessionsPence, m.toPayPence, m.state]).toEqual([12000, 12000, 'due'])
  })
  it('credit comes off, as on the 1st', () => {
    expect(buildFamilyMonth(nov, null, 2000).toPayPence).toBe(10000)
    expect(buildFamilyMonth(nov, null, 50000)).toMatchObject({ toPayPence: 0, state: 'covered' })
  })
  it('under 48 hours stays on the bill, marked', () => {
    const m = buildFamilyMonth([r({ status: 'declined', decline_tier: 'none' })], null, 0)
    expect(m.on[0].tag).toBe('released late · still charged')
    expect(m.toPayPence).toBe(4000)
  })
  it('moved, cancelled and paused dates say so', () => {
    expect(offReason({ status: 'cancelled', decline_tier: null, note: 'moved to 2026-11-19 17:00', charge_state: 'unpaid' })).toBe('moved to Thu 19 Nov 17:00')
    expect(offReason({ status: 'cancelled', decline_tier: null, note: 'Pitch closed', charge_state: 'credited' })).toBe('cancelled by the academy · credited')
    expect(offReason({ status: 'cancelled', decline_tier: null, note: 'slot paused', charge_state: 'unpaid' })).toBe('paused')
    expect(offReason({ status: 'declined', decline_tier: 'half', note: null, charge_state: 'unpaid' })).toContain('half charged')
  })
  it('a month already paid says so and charges nothing more', () => {
    const m = buildFamilyMonth(nov, { status: 'paid_online', amount_pence: 16000, credit_applied_pence: 0, sessions_pence: 16000 }, 4000)
    expect([m.state, m.toPayPence]).toEqual(['paid', 0])
  })
  it("a slot the parent hasn't set up shows its held dates but isn't on this bill", () => {
    const m = buildFamilyMonth(nov, null, 0, new Set(['s1']))
    expect(m.on.map((l) => l.tag)).toEqual(['held · not set up yet', 'held · not set up yet', 'held · not set up yet'])
    expect([m.sessionsPence, m.toPayPence, m.setUpPence]).toEqual([0, 0, 12000])
  })
  it('a family with one live and one held regular: only the live dates are billed', () => {
    const live = [r({ regular_slot_id: 'live', session_date: '2026-11-02' }), r({ regular_slot_id: 'live', session_date: '2026-11-09' })]
    const held = [r({ regular_slot_id: 'held', session_date: '2026-11-04' })]
    const m = buildFamilyMonth([...live, ...held], null, 0, new Set(['held']))
    expect(m.on.filter((l) => !l.tag?.startsWith('held')).length).toBe(2)
    expect([m.sessionsPence, m.toPayPence, m.setUpPence]).toEqual([8000, 8000, 4000])
  })
})
