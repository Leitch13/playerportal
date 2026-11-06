import { describe, it, expect, beforeAll, vi } from 'vitest'
import { approvalToken, userFromApprovalToken, approvalPending, notApproved, decideAcademy } from './academy-approval'
import { emailCheckToken } from './academy-email-check'

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => ({ success: true })) }))
vi.mock('@/lib/email-templates', () => ({ adminWelcomeEmail: () => ({ subject: 's', html: 'h' }) }))

beforeAll(() => { process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret' })
const id = '0b6f1e8a-3c2d-4e5f-8a9b-1c2d3e4f5a6b'

function fakeDb(meta: Record<string, unknown>) {
  const state = { meta: { ...meta }, published: false, audit: [] as string[] }
  const chain = (table: string) => {
    const q: Record<string, unknown> = {}
    q.select = () => q; q.eq = () => q
    q.maybeSingle = async () => ({ data: table === 'profiles' ? { full_name: 'Sam Owner', organisation_id: 'org1' } : { id: 'org1', name: 'New FC', slug: 'new-fc' } })
    q.update = (v: { is_published?: boolean }) => { if (v.is_published) state.published = true; return q }
    q.insert = async (row: { action: string }) => { state.audit.push(row.action); return {} }
    return q
  }
  const db = {
    from: chain,
    auth: { admin: {
      getUserById: async () => ({ data: { user: { id, email: 'sam@newfc.co.uk', app_metadata: state.meta } }, error: null }),
      updateUserById: async (_: string, v: { app_metadata: Record<string, unknown> }) => { state.meta = v.app_metadata; return {} },
    } },
  }
  return { db: db as never, state }
}

describe('academy approval', () => {
  it('a link gives back the owner it was made for, and nothing else works', () => {
    expect(userFromApprovalToken(approvalToken(id))).toBe(id)
    expect(userFromApprovalToken('nonsense')).toBeNull()
    // The owner's own email-confirm link can't be used to approve themselves.
    expect(userFromApprovalToken(emailCheckToken(id))).toBeNull()
  })
  it('only new academies wait; older ones have no flag', () => {
    expect(approvalPending({ app_metadata: { academy_approval: 'pending' } })).toBe(true)
    expect(approvalPending({ app_metadata: {} })).toBe(false)
    expect(notApproved({ app_metadata: { academy_approval: 'rejected' } })).toBe(true)
  })
  it('Approve opens the academy and its booking page, once', async () => {
    const { db, state } = fakeDb({ academy_approval: 'pending' })
    expect(await decideAcademy(db, id, 'approve')).toMatchObject({ ok: true, state: 'approved', academy: 'New FC' })
    expect(state.meta.academy_approval).toBe('approved')
    expect(state.published).toBe(true)
    expect(state.audit).toEqual(['academy.approved'])
    expect(await decideAcademy(db, id, 'reject')).toMatchObject({ state: 'already_approved' })
  })
  it("Don't approve keeps it closed", async () => {
    const { db, state } = fakeDb({ academy_approval: 'pending' })
    expect(await decideAcademy(db, id, 'reject')).toMatchObject({ ok: true, state: 'declined' })
    expect(state.meta.academy_approval).toBe('rejected')
    expect(state.published).toBe(false)
  })
})
