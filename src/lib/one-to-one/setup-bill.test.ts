import { describe, it, expect, vi, beforeEach } from 'vitest'

// 1-2-1 set-up bills, rehearsed on a fake database (audit 26 Oct 2026, No.1 Goalkeeping):
// a set-up bill must cover every unpaid date on every slot the family has, up to the end of
// this month, minus credit. Before this, Joshua Logan's link asked £0 and October was never billed.

const expired: string[] = []
vi.mock('@/lib/stripe', () => ({ stripe: { checkout: { sessions: { retrieve: async (id: string) => ({ id, status: 'open' }), expire: async (id: string) => { expired.push(id) } } } } }))
const emailsSent: string[] = []
vi.mock('./emails', () => ({ sendPaymentFailed: async () => { emailsSent.push('payment failed') }, sendMonthReceipt: async () => { emailsSent.push('receipt') } }))
vi.mock('./coach-notify', () => ({ coachNewRegular: async () => {}, coachSessionChange: async () => {} }))
vi.mock('./db', () => ({ getCoaches: async () => [], getVenues: async () => [], getSettings: async () => ({ cash_allowed: true }), hhmm: () => '', fmtDate: (d: string) => d, DAY: {}, rollAhead: async () => {} }))
vi.mock('./checkout', () => ({ ONE_TO_ONE_MODULE: 'one_to_one', platformFeeRate: async () => ({ rate: 0, stripeAccountId: 'acct' }), CheckoutBlocked: class extends Error {} }))

import { prepareSetupCharge, familyOwedUpToNow, chargeParentMonth, CASH_DUE } from './money'

type Row = Record<string, unknown>
let db: Record<string, Row[]>
let seq = 0

/** Just enough of the Supabase query builder for money.ts. */
function table(name: string) {
  const filters: ((r: Row) => boolean)[] = []
  let op: 'select' | 'update' | 'delete' | 'upsert' | 'insert' = 'select'
  let payload: Row | Row[] | null = null
  let conflict: string[] = []
  const rows = () => (db[name] ||= [])
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q },
    neq: (k: string, v: unknown) => { filters.push((r) => r[k] !== v); return q },
    in: (k: string, v: unknown[]) => { filters.push((r) => v.includes(r[k])); return q },
    lte: (k: string, v: string) => { filters.push((r) => String(r[k]) <= v); return q },
    gte: (k: string, v: string) => { filters.push((r) => String(r[k]) >= v); return q },
    lt: (k: string, v: string) => { filters.push((r) => String(r[k]) < v); return q },
    not: () => q, order: () => q, limit: () => q,
    update: (p: Row) => { op = 'update'; payload = p; return q },
    delete: () => { op = 'delete'; return q },
    insert: (p: Row | Row[]) => { op = 'insert'; payload = p; return q },
    upsert: (p: Row, o: { onConflict: string }) => { op = 'upsert'; payload = p; conflict = o.onConflict.split(','); return q },
    run: () => {
      const match = (r: Row) => filters.every((f) => f(r))
      if (op === 'insert') { const list = Array.isArray(payload) ? payload : [payload!]; for (const p of list) rows().push({ id: `id${++seq}`, ...p }); return list }
      if (op === 'update') { const hit = rows().filter(match); hit.forEach((r) => Object.assign(r, payload)); return hit }
      if (op === 'delete') { db[name] = rows().filter((r) => !match(r)); return [] }
      if (op === 'upsert') {
        const p = payload as Row
        const hit = rows().find((r) => conflict.every((k) => r[k] === p[k]))
        if (hit) { Object.assign(hit, p); return [hit] }
        const row = { id: `id${++seq}`, ...p }; rows().push(row); return [row]
      }
      return rows().filter(match)
    },
    single: async () => ({ data: q.run()[0] ?? null, error: null }),
    maybeSingle: async () => ({ data: q.run()[0] ?? null, error: null }),
    then: (res: (v: { data: Row[]; error: null }) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: q.run(), error: null }).then(res, rej),
  }
  return q
}
const admin = { from: (n: string) => table(n) } as never

const ORG = 'org', DAD = 'kenneth'
const session = (id: string, date: string, extra: Row = {}) => ({ id, organisation_id: ORG, parent_id: DAD, regular_slot_id: 'slotA', session_date: date, price_pence: 4000, status: 'scheduled', decline_tier: null, charge_state: 'unpaid', source: 'regular', ...extra })
const slotA = { id: 'slotA', organisation_id: ORG, parent_id: DAD, status: 'pending', starts_on: '2026-09-28' }

beforeEach(() => {
  expired.length = 0; emailsSent.length = 0; seq = 0
  db = {
    regular_slots: [{ ...slotA }],
    coaching_sessions: ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'].map((d, i) => session(`s${i}`, d)),
    coaching_charges: [{ id: 'oldSept', organisation_id: ORG, parent_id: DAD, billing_month: '2026-09-01', status: 'pending', amount_pence: 0, sessions_pence: 0, credit_applied_pence: 0, breakdown: [], stripe_checkout_session_id: 'cs_old' }],
    coaching_credits: [{ id: 'c1', organisation_id: ORG, parent_id: DAD, amount_pence: 13100 }],
  }
})

describe('set-up bill = every unpaid date up to the end of this month, minus credit', () => {
  it('Joshua Logan: started 28 Sep, set up 26 Oct: 5 sessions £200 − £131 credit = £69', async () => {
    const { chargeId, b, month } = await prepareSetupCharge(admin, ORG, slotA, '2026-10-26')
    expect(month).toBe('2026-10-01')
    expect(b.sessionIds).toEqual(['s0', 's1', 's2', 's3', 's4'])
    expect(b.sessionsPence).toBe(20000)
    expect(b.amountPence).toBe(6900)
    const bills = db.coaching_charges
    expect(bills).toHaveLength(1) // the old £0 September bill is folded in
    expect(bills[0].id).toBe(chargeId)
    expect(bills[0].amount_pence).toBe(6900)
    expect(expired).toContain('cs_old') // its payment page is closed first
  })

  it('a second slot in the same family is on the same bill', async () => {
    db.regular_slots.push({ id: 'slotB', organisation_id: ORG, parent_id: DAD, status: 'pending', starts_on: '2026-10-16' })
    db.coaching_sessions.push(session('b1', '2026-10-16', { regular_slot_id: 'slotB', price_pence: 2500 }), session('b2', '2026-10-30', { regular_slot_id: 'slotB', price_pence: 2500 }))
    const { b } = await prepareSetupCharge(admin, ORG, slotA, '2026-10-26')
    expect(b.sessionsPence).toBe(25000)
    expect(b.amountPence).toBe(25000 - 13100)
  })

  it('cancelled and fully credited dates come off; a late (under 48h) decline stays on', async () => {
    db.coaching_sessions[1].status = 'cancelled'
    db.coaching_sessions[2].status = 'declined'; db.coaching_sessions[2].decline_tier = 'full'
    db.coaching_sessions[3].status = 'declined'; db.coaching_sessions[3].decline_tier = 'none'
    const b = await familyOwedUpToNow(admin, ORG, DAD, '2026-10-26')
    expect(b.sessionIds).toEqual(['s0', 's3', 's4'])
  })

  it('set up after the 1st: November is on the bill too (nothing falls between months)', async () => {
    const { b, month } = await prepareSetupCharge(admin, ORG, slotA, '2026-11-03')
    expect(month).toBe('2026-11-01')
    expect(b.sessionsPence).toBe(7 * 4000)
    expect(b.amountPence).toBe(7 * 4000 - 13100)
  })

  it('dates already paid are never billed again', async () => {
    db.coaching_sessions[0].charge_state = 'charged'
    const b = await familyOwedUpToNow(admin, ORG, DAD, '2026-10-26')
    expect(b.sessionIds).not.toContain('s0')
  })

  it('this month already paid (a live sibling): no new bill, the dates go on the next bill as owed', async () => {
    db.coaching_charges.push({ id: 'paidOct', organisation_id: ORG, parent_id: DAD, billing_month: '2026-10-01', status: 'paid_online', amount_pence: 5000 })
    const { chargeId } = await prepareSetupCharge(admin, ORG, slotA, '2026-10-26')
    expect(chargeId).toBeNull()
    const owed = db.coaching_credits.filter((c) => (c.amount_pence as number) < 0).reduce((a, c) => a + (c.amount_pence as number), 0)
    expect(owed).toBe(-20000)
    expect(db.coaching_sessions.filter((s) => s.charge_state === 'charged')).toHaveLength(5)
  })

  it('opening the link twice never makes two bills', async () => {
    await prepareSetupCharge(admin, ORG, slotA, '2026-10-26')
    await prepareSetupCharge(admin, ORG, slotA, '2026-10-26')
    expect(db.coaching_charges.filter((c) => ['pending', 'failed'].includes(c.status as string))).toHaveLength(1)
  })
})

describe('the 1st of the month for a family with no card (pays cash or bank transfer)', () => {
  beforeEach(() => {
    db.regular_slots = [{ ...slotA, status: 'active' }]
    db.coaching_charges = []
    db.coaching_credits = []
    db.profiles = [{ id: DAD, email: 'k@example.com', full_name: 'Kenneth' }]
    db.organisations = [{ id: ORG, name: 'No.1', slug: 'no1' }]
    for (const s of db.coaching_sessions) if ((s.session_date as string) < '2026-11-01') s.charge_state = 'charged'
  })
  it('shows as cash due: no retries and never a "payment failed" email', async () => {
    expect(await chargeParentMonth(admin, ORG, DAD, '2026-11-01', '2026-11-01')).toBe('failed')
    const bill = db.coaching_charges[0]
    expect(bill.failure_message).toBe(CASH_DUE)
    expect(bill.next_attempt_on).toBeNull()
    expect(await chargeParentMonth(admin, ORG, DAD, '2026-11-01', '2026-11-04')).toBe('skipped')
    expect(await chargeParentMonth(admin, ORG, DAD, '2026-11-01', '2026-11-08')).toBe('skipped')
    expect(emailsSent).not.toContain('payment failed')
  })
})
