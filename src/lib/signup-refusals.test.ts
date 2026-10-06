import { describe, it, expect } from 'vitest'
import { signupRefusalRow } from './signup-refusals'

const ORG = '11111111-1111-4111-8111-111111111111', PLAN = '22222222-2222-4222-8222-222222222222', KID = '33333333-3333-4333-8333-333333333333'

describe('signupRefusalRow', () => {
  it('files the refusal under the academy and the plan, with the reason and what the parent was told', () => {
    const row = signupRefusalRow({ organisationId: ORG, userId: 'u', planId: PLAN, playerId: KID, classId: null }, 'existing_membership', 'Already has one', 400)
    expect(row).toMatchObject({ organisation_id: ORG, action: 'signup.refused', entity_type: 'plan', entity_id: PLAN })
    expect(row!.details).toMatchObject({ reason: 'existing_membership', message: 'Already has one', status: 400, player_id: KID, class_id: null })
  })
  it('records nothing when there is no academy or no real plan id', () => {
    expect(signupRefusalRow({ planId: PLAN }, 'class_full', 'x', 409)).toBeNull()
    expect(signupRefusalRow({ organisationId: ORG, planId: 'not-an-id' }, 'class_full', 'x', 409)).toBeNull()
  })
  it('never stores a malformed child or class id, and caps the message', () => {
    const row = signupRefusalRow({ organisationId: ORG, planId: PLAN, playerId: "x'; drop", classId: 'nope' }, 'checkout_error', 'm'.repeat(900), 500)
    expect(row!.details.player_id).toBeNull()
    expect(row!.details.class_id).toBeNull()
    expect((row!.details.message as string).length).toBe(400)
  })
})
