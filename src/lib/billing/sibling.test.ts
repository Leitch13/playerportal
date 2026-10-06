import { describe, it, expect } from 'vitest'
import { SIBLING_QUALIFYING_STATUSES } from './sibling'

describe('sibling discount: who counts as already having a child here', () => {
  it('counts a child who is paying, and one who signed up this month and is waiting for the 1st', () => {
    expect([...SIBLING_QUALIFYING_STATUSES].sort()).toEqual(['active', 'trialing'])
  })
  it('does not count an unconfirmed invite, a failed payment, or a paused or ended membership', () => {
    for (const s of ['pending_migration', 'past_due', 'paused', 'canceled', 'cancelled', 'scheduled', 'incomplete']) {
      expect((SIBLING_QUALIFYING_STATUSES as readonly string[]).includes(s)).toBe(false)
    }
  })
})
