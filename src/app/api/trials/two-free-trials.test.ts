/**
 * Two free trials (John, 16 Nov 2026, option "a"), tested through the real
 * booking and confirm routes against an in-memory database. No real parents,
 * emails or academy alerts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── in-memory database ─────────────────────────────────────────────────────
type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
let orgHasColumn = true
let fullDays = new Set<string>()
let idSeq = 0

function builder(table: string) {
  const filters: ((r: Row) => boolean)[] = []
  let mode: 'select' | 'insert' = 'select'
  let inserted: Row | null = null
  let headCount = false
  let cols = '*'
  let err: { message: string } | null = null
  const rows = () => (tables[table] ||= [])
  const result = () => {
    if (err) return { data: null, error: err, count: null }
    if (mode === 'insert') return { data: inserted, error: null }
    const out = rows().filter((r) => filters.every((f) => f(r)))
    if (table === 'organisations' && cols.includes('free_trial_sessions') && !orgHasColumn) {
      return { data: null, error: { message: 'column organisations.free_trial_sessions does not exist' }, count: null }
    }
    return { data: headCount ? null : out, error: null, count: out.length }
  }
  const b: Record<string, unknown> = {
    select(c?: string, opts?: { head?: boolean }) { if (mode === 'select') { cols = c || '*'; headCount = !!opts?.head } return b },
    eq(k: string, v: unknown) { filters.push((r) => String(k.includes('->>') ? (r.details as Row)?.[k.split('->>')[1]] : r[k]) === String(v)); return b },
    ilike(k: string, v: string) { filters.push((r) => String(r[k] ?? '').toLowerCase() === String(v).toLowerCase()); return b },
    in(k: string, vs: unknown[]) { filters.push((r) => vs.includes(r[k])); return b },
    gte(k: string, v: string) { filters.push((r) => String(r[k] ?? '') >= v); return b },
    not() { return b },
    order() { return b },
    limit() { return b },
    insert(row: Row) {
      mode = 'insert'
      if (table === 'trial_bookings' && fullDays.has(String(row.preferred_date))) { err = { message: 'class_full' }; return b }
      inserted = { id: `id-${++idSeq}`, status: table === 'trial_bookings' ? 'pending' : undefined, created_at: new Date(Date.now() + idSeq).toISOString(), ...row }
      rows().push(inserted)
      return b
    },
    async maybeSingle() { const r = result(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error } },
    async single() { const r = result(); return { data: Array.isArray(r.data) ? r.data[0] : r.data, error: r.error } },
    then(res: (v: unknown) => unknown) { return Promise.resolve(result()).then(res) },
  }
  return b
}
const fakeDb = { from: (t: string) => builder(t) }

vi.mock('@supabase/supabase-js', () => ({ createClient: () => fakeDb }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => ({ success: true }) }))
vi.mock('@/lib/lead-email-checks', () => ({ checkLeadEmail: async () => null }))
vi.mock('@/lib/ip-reputation', () => ({ checkParentIp: async () => ({ block: false }) }))
const sentEmails: { to: string; subject?: string; html?: string }[] = []
vi.mock('@/lib/email', () => ({ sendEmail: async (e: { to: string }) => { sentEmails.push(e); return { success: true } } }))
const alerts: string[] = []
vi.mock('@/lib/trial-alerts', () => ({ alertAcademyOfTrial: async (_sb: unknown, id: string) => { alerts.push(id) } }))

const { POST: book } = await import('./book/route')
const { POST: confirm } = await import('./confirm/route')
const { hashToken } = await import('@/lib/trial-email-confirm')

// ── helpers ────────────────────────────────────────────────────────────────
const ORG = '11111111-1111-4111-8111-111111111111'
const GROUP = '22222222-2222-4222-8222-222222222222'
const day = (n: number) => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10) }
const D1 = day(5), D2 = day(12), D3 = day(19)

function req(body: unknown) {
  return new Request('http://test/api', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '81.2.69.160' }, body: JSON.stringify(body) }) as never
}
const form = (extra: Record<string, unknown> = {}) => ({
  orgId: ORG, groupId: GROUP, parentName: 'Sarah Kerr', parentEmail: 'sarah.kerr@outlook.com', phone: '07700 900123',
  childName: 'Mia', childAge: 4, sessionDate: D1, agreedToTerms: true, ...extra,
})
/** Book, then tap the confirm link, the way a parent does. */
async function bookAndConfirm(extra: Record<string, unknown> = {}) {
  const r = await book(req(form(extra)))
  const j = await r.json()
  if (r.status !== 200) return { bookStatus: r.status, bookError: j.error as string }
  const mail = sentEmails[sentEmails.length - 1]
  const token = /trial\/confirm\/([A-Za-z0-9_-]+)/.exec(String(mail.html))?.[1]
  expect(token, 'confirm link in the email').toBeTruthy()
  const c = await confirm(req({ token }))
  return { bookStatus: 200, confirm: await c.json() }
}
const trials = () => (tables.trial_bookings || []).filter((t) => t.child_name === 'Mia')

function setAcademy(freeTrials: number) {
  tables.organisations = [{ id: ORG, name: 'Test Academy', slug: 'test-academy', primary_color: '#fbc926', is_published: true, terms_text: 'Terms', free_trial_sessions: freeTrials }]
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  tables.training_groups = [{ id: GROUP, organisation_id: ORG, name: 'Mini Ballers' }]
  orgHasColumn = true
  fullDays = new Set()
  sentEmails.length = 0
  alerts.length = 0
  setAcademy(1)
})

// ── academies on 1 (every academy today): unchanged ──────────────────────
describe('academy on 1 free session', () => {
  it('books one trial exactly as before', async () => {
    const r = await bookAndConfirm()
    expect(r.confirm.state).toBe('confirmed')
    expect(trials().map((t) => t.preferred_date)).toEqual([D1])
    expect(alerts).toHaveLength(1)
  })
  it('refuses a second date', async () => {
    const r = await bookAndConfirm({ secondSessionDate: D2 })
    expect(r.bookStatus).toBe(400)
    expect(trials()).toHaveLength(0)
  })
  it('refuses a second trial for the same child later', async () => {
    await bookAndConfirm()
    const r = await bookAndConfirm({ sessionDate: D2 })
    expect(r.bookStatus).toBe(409)
    expect(trials()).toHaveLength(1)
  })
  it('before migration 129 is applied, behaves as 1 and nothing breaks', async () => {
    orgHasColumn = false
    const ok = await bookAndConfirm()
    expect(ok.confirm.state).toBe('confirmed')
    const two = await bookAndConfirm({ sessionDate: D2, secondSessionDate: D3, childName: 'Mia' })
    expect(two.bookStatus).toBe(400)
    expect(trials()).toHaveLength(1)
  })
})

// ── academies on 2 (Jamie) ────────────────────────────────────────────────
describe('academy on 2 free sessions', () => {
  beforeEach(() => setAcademy(2))

  it('books both sessions, tells the academy twice, emails both dates', async () => {
    const r = await bookAndConfirm({ secondSessionDate: D2 })
    expect(r.confirm.state).toBe('confirmed')
    expect(trials().map((t) => t.preferred_date).sort()).toEqual([D1, D2])
    expect(alerts).toHaveLength(2)
    const booked = sentEmails[sentEmails.length - 1]
    expect(String(booked.html)).toContain(' and ')
  })
  it('the confirm-link email lists both dates', async () => {
    await book(req(form({ secondSessionDate: D2 })))
    expect(String(sentEmails[0].html)).toMatch(/ and /)
  })
  it('still allows just one date', async () => {
    const r = await bookAndConfirm()
    expect(r.confirm.state).toBe('confirmed')
    expect(trials()).toHaveLength(1)
  })
  it('lets the child come back for the second session, then no more', async () => {
    await bookAndConfirm()
    const second = await bookAndConfirm({ sessionDate: D2 })
    expect(second.confirm.state).toBe('confirmed')
    expect(trials()).toHaveLength(2)
    const third = await bookAndConfirm({ sessionDate: D3 })
    expect(third.bookStatus).toBe(409)
    expect(trials()).toHaveLength(2)
  })
  it('one already booked: asking for two more is refused with a clear message', async () => {
    await bookAndConfirm()
    const r = await bookAndConfirm({ sessionDate: D2, secondSessionDate: D3 })
    expect(r.bookStatus).toBe(409)
    expect(r.bookError).toMatch(/one more/)
  })
  it('second date must be after the first', async () => {
    expect((await bookAndConfirm({ sessionDate: D2, secondSessionDate: D1 })).bookStatus).toBe(400)
    expect((await bookAndConfirm({ secondSessionDate: D1 })).bookStatus).toBe(400)
    expect(trials()).toHaveLength(0)
  })
  it('a full second day keeps the first session and says only that date', async () => {
    fullDays.add(D2)
    const r = await bookAndConfirm({ secondSessionDate: D2 })
    expect(r.confirm.state).toBe('confirmed')
    expect(trials().map((t) => t.preferred_date)).toEqual([D1])
    expect(alerts).toHaveLength(1)
  })
  it('tapping the confirm link twice never makes extra trials', async () => {
    await book(req(form({ secondSessionDate: D2 })))
    const token = /trial\/confirm\/([A-Za-z0-9_-]+)/.exec(String(sentEmails[0].html))![1]
    await confirm(req({ token }))
    const again = await (await confirm(req({ token }))).json()
    expect(again.state).toBe('already')
    expect(trials()).toHaveLength(2)
    expect(hashToken(token)).toHaveLength(64)
  })
  it('the academy dropping back to 1 stops a waiting second session being booked', async () => {
    await book(req(form({ secondSessionDate: D2 })))
    setAcademy(1)
    const token = /trial\/confirm\/([A-Za-z0-9_-]+)/.exec(String(sentEmails[0].html))![1]
    const c = await (await confirm(req({ token }))).json()
    expect(c.state).toBe('confirmed')
    expect(trials()).toHaveLength(1)
  })
})
