import { describe, expect, it } from 'vitest'
import { canPause, effectiveStatus } from './membership-pause'

describe('effectiveStatus', () => {
  it('is paused whenever Stripe has a pause on', () => {
    expect(effectiveStatus({ status: 'active', pause_collection: { behavior: 'void' } })).toBe('paused')
    expect(effectiveStatus({ status: 'trialing', pause_collection: { behavior: 'void' } })).toBe('paused')
  })
  it("otherwise follows Stripe's status", () => {
    expect(effectiveStatus({ status: 'active', pause_collection: null })).toBe('active')
    expect(effectiveStatus({ status: 'past_due' })).toBe('past_due')
  })
})

describe('canPause', () => {
  it('pauses paying and not-yet-charged memberships only', () => {
    expect(canPause('active')).toBe(true)
    expect(canPause('trialing')).toBe(true)
    expect(canPause('past_due')).toBe(false)
    expect(canPause('canceled')).toBe(false)
    expect(canPause('paused')).toBe(false)
  })
})
