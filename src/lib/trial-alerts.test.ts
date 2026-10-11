import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendEmail = vi.fn(async (_mail: { to: string; html: string }) => ({ success: true }))
vi.mock('./email', () => ({ sendEmail: (mail: { to: string; html: string }) => sendEmail(mail) }))

import { alertAcademyOfTrial, paidTrialPence, paidTrialSessionId, sameTrial, TRIAL_ALERTED_ACTION } from './trial-alerts'

describe('reading a paid trial', () => {
  it('finds the amount and the Stripe session in the note the webhook writes', () => {
    const note = 'Paid trial — £5.00 via Stripe (cs_live_a1WxpceOyVyQmDQ2KueY)'
    expect(paidTrialPence(note)).toBe(500)
    expect(paidTrialSessionId(note)).toBe('cs_live_a1WxpceOyVyQmDQ2KueY')
  })
  it('a free trial has neither', () => {
    expect(paidTrialPence('Wants to try the Friday group')).toBeNull()
    expect(paidTrialPence(null)).toBeNull()
    expect(paidTrialSessionId('')).toBeNull()
  })
})

describe('the double booking at Talent FA (9 Oct 2026)', () => {
  const first = { training_group_id: 'tots', preferred_date: '2026-10-10', parent_email: 'Amy@example.com', child_name: 'Henrique  Freitas' }
  it('is recognised as the same booking despite the spacing and capitals', () => {
    expect(sameTrial(first, { training_group_id: 'tots', preferred_date: '2026-10-10', parent_email: 'amy@example.com ', child_name: 'henrique freitas' })).toBe(true)
  })
  it('a different date, class or child is a different booking', () => {
    expect(sameTrial(first, { ...first, preferred_date: '2026-10-17' })).toBe(false)
    expect(sameTrial(first, { ...first, training_group_id: 'friday' })).toBe(false)
    expect(sameTrial(first, { ...first, child_name: 'Sofia Freitas' })).toBe(false)
  })
  it('never matches on a missing email or class', () => {
    expect(sameTrial({ ...first, parent_email: '' }, { ...first, parent_email: '' })).toBe(false)
    expect(sameTrial({ ...first, training_group_id: null }, { ...first, training_group_id: null })).toBe(false)
  })
})

/** A tiny stand-in for the database: records what is written, returns what the test sets up. */
function fakeDb(opts: { alreadyAlerted?: boolean; admins?: number; notes?: string | null; trial?: boolean }) {
  const written: { table: string; rows: unknown }[] = []
  const trial = opts.trial === false ? null : {
    id: 't1', organisation_id: 'o1', parent_name: 'Amy Freitas', parent_email: 'amy@example.com', parent_phone: null,
    child_name: 'Henrique Freitas', child_age: 2, preferred_date: '2026-10-10', notes: opts.notes ?? null,
    training_group: { name: 'Saturday 9am Tots Session', time_slot: '09:00–09:45' }, organisation: { name: 'Talent FA', contact_email: 'ryan@example.com' },
  }
  const result = (table: string) => table === 'audit_log' ? (opts.alreadyAlerted ? [{ id: 'a' }] : [])
    : table === 'profiles' ? Array.from({ length: opts.admins ?? 1 }, (_, i) => ({ id: `admin${i}` })) : trial
  const from = (table: string) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'limit']) q[m] = () => q
    q.maybeSingle = async () => ({ data: result(table) })
    q.then = (res: (v: { data: unknown }) => unknown) => res({ data: result(table) })
    q.insert = (rows: unknown) => { written.push({ table, rows }); return Promise.resolve({ error: null, count: Array.isArray(rows) ? rows.length : 1 }) }
    return q
  }
  return { sb: { from }, written }
}

describe('alertAcademyOfTrial', () => {
  beforeEach(() => sendEmail.mockClear())

  it('a paid trial: every admin gets a bell, the academy gets an email saying it is paid, and it is written down', async () => {
    const { sb, written } = fakeDb({ admins: 2, notes: 'Paid trial — £5.00 via Stripe (cs_live_x)' })
    const r = await alertAcademyOfTrial(sb, 't1')
    expect(r).toMatchObject({ ok: true, already: false, notifications: 2, emailSent: true })
    const bells = written.find((w) => w.table === 'notifications')!.rows as { body: string }[]
    expect(bells).toHaveLength(2)
    expect(bells[0].body).toContain('paid £5.00')
    const mail = sendEmail.mock.calls[0][0]
    expect(mail.to).toBe('ryan@example.com')
    expect(mail.html).toContain('Paid £5.00 online')
    const record = written.find((w) => w.table === 'audit_log')!.rows as { action: string; entity_id: string; details: { email_sent: boolean; paid_pence: number } }
    expect(record).toMatchObject({ action: TRIAL_ALERTED_ACTION, entity_id: 't1', details: { email_sent: true, paid_pence: 500 } })
  })

  it('a free trial is announced as free', async () => {
    const { sb, written } = fakeDb({ notes: null })
    await alertAcademyOfTrial(sb, 't1')
    expect((written.find((w) => w.table === 'notifications')!.rows as { body: string }[])[0].body).toContain('a free trial')
  })

  it('announces a trial once: a second call sends nothing', async () => {
    const { sb, written } = fakeDb({ alreadyAlerted: true })
    const r = await alertAcademyOfTrial(sb, 't1')
    expect(r).toMatchObject({ ok: true, already: true })
    expect(written).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('an email failure is recorded, never thrown — the booking still stands', async () => {
    sendEmail.mockResolvedValueOnce({ success: false } as never)
    const { sb, written } = fakeDb({ admins: 0, notes: 'Paid trial — £10.00 via Stripe (cs_live_y)' })
    const r = await alertAcademyOfTrial(sb, 't1')
    expect(r.ok).toBe(false)
    expect((written.find((w) => w.table === 'audit_log')!.rows as { details: { email_sent: boolean } }).details.email_sent).toBe(false)
  })

  it('a trial that does not exist reports it and writes nothing', async () => {
    const { sb, written } = fakeDb({ trial: false })
    expect((await alertAcademyOfTrial(sb, 'nope')).ok).toBe(false)
    expect(written).toHaveLength(0)
  })
})
