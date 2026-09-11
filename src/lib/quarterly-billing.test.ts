import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isQuarterlyEnabledForOrg, isQuarterlyEnabledForOrgPublic } from './quarterly-billing'

describe('quarterly — same rule for every academy, governed only by the academy toggle', () => {
  const org = '00000000-0000-0000-0000-000000000001'
  it('on when the academy toggle is on', () => expect(isQuarterlyEnabledForOrg(org, true)).toBe(true))
  it('on when the academy left it blank', () => {
    expect(isQuarterlyEnabledForOrg(org, null)).toBe(true)
    expect(isQuarterlyEnabledForOrg(org, undefined)).toBe(true)
  })
  it('off only when the academy switched it off', () => expect(isQuarterlyEnabledForOrg(org, false)).toBe(false))
  it('never on without an academy', () => expect(isQuarterlyEnabledForOrg(null, true)).toBe(false))
  it('client helper is identical', () => {
    for (const f of [true, false, null, undefined]) expect(isQuarterlyEnabledForOrgPublic(org, f)).toBe(isQuarterlyEnabledForOrg(org, f))
  })
  it('the gate reads no environment switch at all', () => {
    expect(readFileSync(new URL('./quarterly-billing.ts', import.meta.url), 'utf8')).not.toMatch(/process\.env/)
  })
})
