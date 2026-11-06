import { describe, it, expect } from 'vitest'
import { diffSnapshots, type Snapshot } from './security-watch'

const base: Snapshot = {
  orgs: { o1: { name: 'Granite', stripe: 'acct_1', plan: 'pro', pilot: false, status: 'active' } },
  superAdmins: ['john'],
  admins: { o1: ['a1'] },
}

describe('security watch', () => {
  it('says nothing on the first run or when nothing changed', () => {
    expect(diffSnapshots(null, base)).toEqual([])
    expect(diffSnapshots(base, structuredClone(base))).toEqual([])
  })
  it('flags a new platform admin, payout account, plan, pilot, £35 status and admin', () => {
    const after = structuredClone(base)
    after.superAdmins.push('evil')
    after.orgs.o1 = { name: 'Granite', stripe: 'acct_evil', plan: 'cheap', pilot: true, status: 'canceled' }
    after.admins.o1.push('a2')
    const out = diffSnapshots(base, after, { evil: 'evil@x.com', a2: 'new@x.com' })
    expect(out).toContain('NEW PLATFORM ADMIN: evil@x.com')
    expect(out.some((l) => l.includes('payout Stripe account changed acct_1 → acct_evil'))).toBe(true)
    expect(out).toContain('Granite: platform plan changed')
    expect(out).toContain('Granite: free/pilot flag turned ON')
    expect(out).toContain('Granite: £35 status active → canceled')
    expect(out).toContain('Granite: new admin new@x.com')
  })
  it("doesn't flag a brand-new academy's first admin", () => {
    const after = structuredClone(base)
    after.orgs.o2 = { name: 'New FC', stripe: null, plan: 'pro', pilot: false, status: null }
    after.admins.o2 = ['owner']
    expect(diffSnapshots(base, after)).toEqual([])
  })
})
