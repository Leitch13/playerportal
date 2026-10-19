import { describe, it, expect, vi, beforeEach } from 'vitest'

// John, 19 Oct 2026: moving a whole regular must tell the coach, as moving one date does.
const sent: { to: string; subject: string; lines: string[] }[] = []
vi.mock('./emails', () => ({ sendCoachNotice: async (f: { to: string; subject: string; lines: string[] }) => { sent.push(f) } }))
vi.mock('./db', () => ({ DAY: ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], fmtDate: (d: string) => d, hhmm: (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` }))
import { coachRegularMoved } from './coach-notify'

const rows: Record<string, Record<string, unknown>> = {
  org: { name: 'No.1' }, cammy: { full_name: 'Cammy B', email: 'cammy@x.test' }, matty: { full_name: 'Matty C', email: 'matty@x.test' },
  parent: { phone: '07000' }, v1: { name: 'Pitch 1' }, kid: { first_name: 'Jamie', last_name: 'K' },
}
const admin = { from: () => { let id = ''; const q = { select: () => q, eq: (_: string, v: string) => { id = v; return q }, single: async () => ({ data: rows[id] }), maybeSingle: async () => ({ data: rows[id] ?? null }) }; return q } } as never
const was = { organisation_id: 'org', coach_id: 'cammy', venue_id: 'v1', weekday: 2, start_minutes: 1020, parent_id: 'parent', player_id: 'kid', frequency: 'weekly', session_type: 'one_to_one', status: 'active' }

describe('coach told when a whole regular moves', () => {
  beforeEach(() => { sent.length = 0 })
  it('same coach, new day: one email with was and now', async () => {
    await coachRegularMoved(admin, was, { coach_id: 'cammy', venue_id: 'v1', weekday: 4, start_minutes: 1020 }, '2026-10-22')
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe('cammy@x.test')
    expect(sent[0].lines.join(' ')).toContain('Was 1-to-1, every Tue at 17:00')
    expect(sent[0].lines.join(' ')).toContain('Now every Thu at 17:00')
  })
  it('new coach: old coach and new coach both told', async () => {
    await coachRegularMoved(admin, was, { coach_id: 'matty', venue_id: 'v1', weekday: 2, start_minutes: 1020 }, '2026-10-21')
    expect(sent.map((s) => s.to)).toEqual(['cammy@x.test', 'matty@x.test'])
  })
  it('nothing sent for a price-only change or a regular not set up yet', async () => {
    await coachRegularMoved(admin, was, { coach_id: 'cammy', venue_id: 'v1', weekday: 2, start_minutes: 1020 }, '2026-10-21')
    await coachRegularMoved(admin, { ...was, status: 'pending' }, { coach_id: 'cammy', venue_id: 'v1', weekday: 4, start_minutes: 1020 }, '2026-10-22')
    expect(sent).toHaveLength(0)
  })
})
