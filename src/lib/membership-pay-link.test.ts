import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/stripe', () => ({ stripe: {} }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))
import { chaseKind } from './membership-pay-link'

describe('chaseKind', () => {
  it('a failed card comes first', () => {
    expect(chaseKind(['pending_migration', 'past_due'])).toBe('card')
    expect(chaseKind(['unpaid'])).toBe('card')
  })
  it('an unconfirmed invite', () => expect(chaseKind(['canceled', 'pending_migration'])).toBe('invite'))
  it('nothing to chase', () => {
    expect(chaseKind(['active'])).toBeNull()
    expect(chaseKind([])).toBeNull()
  })
})
