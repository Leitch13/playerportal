import { describe, it, expect } from 'vitest'
import { orgIsClaimableByFirstAdmin } from './onboard-claim'

// Regression guard for the /api/onboard/signup tenant-takeover fix.
// If anyone weakens this so a claimed academy becomes claimable again, this
// test fails — turning the build red before it can ship.
describe('orgIsClaimableByFirstAdmin', () => {
  it('allows claiming a brand-new academy with zero admins', () => {
    expect(orgIsClaimableByFirstAdmin(0)).toBe(true)
  })

  it('blocks claiming an academy that already has an admin (takeover guard)', () => {
    expect(orgIsClaimableByFirstAdmin(1)).toBe(false)
    expect(orgIsClaimableByFirstAdmin(2)).toBe(false)
    expect(orgIsClaimableByFirstAdmin(50)).toBe(false)
  })
})
