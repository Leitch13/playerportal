import { describe, it, expect } from 'vitest'
import { membershipPill, familyLookReasons, initialsOf } from './needs-a-look'

const NOW = new Date('2026-10-03T12:00:00Z').getTime()
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

describe('membershipPill', () => {
  it('a failed payment wins over everything', () => {
    expect(membershipPill(['active', 'past_due'])).toEqual({ label: 'Payment problem', tone: 'bad' })
  })
  it('active or trialing reads as Paying', () => {
    expect(membershipPill(['trialing']).label).toBe('Paying')
    expect(membershipPill(['canceled', 'active']).label).toBe('Paying')
  })
  it('paused is not shown as Cancelled', () => {
    expect(membershipPill(['paused'])).toEqual({ label: 'Paused', tone: 'off' })
  })
  it('an unconfirmed invite is named', () => {
    expect(membershipPill(['pending_migration']).label).toBe('Invite not confirmed')
  })
  it('nothing, or only ended memberships, is No membership', () => {
    expect(membershipPill([]).label).toBe('No membership')
    expect(membershipPill(['canceled', null]).label).toBe('No membership')
  })
})

describe('familyLookReasons', () => {
  const kid = (firstName: string, hasClass: boolean) => ({ firstName, hasClass })

  it('a healthy family needs no look', () => {
    expect(familyLookReasons({ subs: [{ status: 'active' }], children: [kid('Leo', true)], parentJoinedAtIso: daysAgo(200), nowMs: NOW })).toEqual([])
  })
  it('a family nobody has contacted or reviewed is NOT flagged', () => {
    expect(familyLookReasons({ subs: [], children: [kid('Leo', true)], parentJoinedAtIso: daysAgo(400), nowMs: NOW })).toEqual([])
  })
  it('flags a failed payment', () => {
    const r = familyLookReasons({ subs: [{ status: 'past_due' }], children: [kid('Leo', true)], parentJoinedAtIso: daysAgo(90), nowMs: NOW })
    expect(r.map((x) => x.key)).toEqual(['payment'])
  })
  it('flags a recent unconfirmed invite, not one ignored for months', () => {
    const recent = familyLookReasons({ subs: [{ status: 'pending_migration', inviteSentAtIso: daysAgo(6) }], children: [kid('Leo', true)], parentJoinedAtIso: daysAgo(6), nowMs: NOW })
    expect(recent.map((x) => x.key)).toEqual(['invite'])
    const old = familyLookReasons({ subs: [{ status: 'pending_migration', inviteSentAtIso: daysAgo(70) }], children: [kid('Leo', true)], parentJoinedAtIso: daysAgo(70), nowMs: NOW })
    expect(old).toEqual([])
  })
  it('flags a paying child with no class, and names them', () => {
    const r = familyLookReasons({ subs: [{ status: 'active' }], children: [kid('Corey', false)], parentJoinedAtIso: daysAgo(100), nowMs: NOW })
    expect(r[0].key).toBe('no_class')
    expect(r[0].todo).toContain("Corey isn't in a class but the family is paying")
  })
  it('flags a new sign-up who never booked, but not a lapsed family', () => {
    const fresh = familyLookReasons({ subs: [], children: [kid('Evie', false), kid('Oakley', false)], parentJoinedAtIso: daysAgo(4), nowMs: NOW })
    expect(fresh[0].todo).toContain("Evie and Oakley aren't booked")
    const lapsed = familyLookReasons({ subs: [{ status: 'canceled' }], children: [kid('Evie', false)], parentJoinedAtIso: daysAgo(300), nowMs: NOW })
    expect(lapsed).toEqual([])
  })
})

describe('initialsOf', () => {
  it('uses first and last name, ignoring bracketed notes', () => {
    expect(initialsOf('Sarah Evans')).toBe('SE')
    expect(initialsOf('Alan Innes (demo)')).toBe('AI')
    expect(initialsOf('Cher')).toBe('C')
    expect(initialsOf(null)).toBe('?')
  })
})
