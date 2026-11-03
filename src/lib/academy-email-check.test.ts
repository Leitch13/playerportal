import { describe, it, expect, beforeAll } from 'vitest'
import { emailCheckToken, userFromEmailCheckToken, emailCheckPending } from './academy-email-check'

beforeAll(() => { process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret' })
const id = '0b6f1e8a-3c2d-4e5f-8a9b-1c2d3e4f5a6b'

describe('academy email check', () => {
  it('a link gives back the owner it was made for', () => {
    expect(userFromEmailCheckToken(emailCheckToken(id))).toBe(id)
  })
  it('a made-up or edited link is refused', () => {
    const t = emailCheckToken(id)
    expect(userFromEmailCheckToken(t.slice(0, -1) + (t.endsWith('a') ? 'b' : 'a'))).toBeNull()
    const other = '1b6f1e8a-3c2d-4e5f-8a9b-1c2d3e4f5a6b'
    expect(userFromEmailCheckToken(`${Buffer.from(other).toString('base64url')}.${t.split('.')[1]}`)).toBeNull()
    expect(userFromEmailCheckToken('nonsense')).toBeNull()
  })
  it('only owners marked pending are held; older academies are not', () => {
    expect(emailCheckPending({ app_metadata: { academy_email_check: 'pending' } })).toBe(true)
    expect(emailCheckPending({ app_metadata: { academy_email_check: 'confirmed' } })).toBe(false)
    expect(emailCheckPending({ app_metadata: {} })).toBe(false)
  })
})
