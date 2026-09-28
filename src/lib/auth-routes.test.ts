import { describe, expect, it } from 'vitest'
import { signedInMayStayOnAuthRoute } from './auth-routes'

const p = (q = '') => new URLSearchParams(q)

describe('signedInMayStayOnAuthRoute', () => {
  it('lets a signed-in user reach the set-password page (every emailed link ends here)', () => {
    expect(signedInMayStayOnAuthRoute('/auth/reset-password', p())).toBe(true)
  })

  it('lets a signed-in user through the email-link bridge', () => {
    expect(signedInMayStayOnAuthRoute('/auth/confirm', p('code=abc'))).toBe(true)
    expect(signedInMayStayOnAuthRoute('/auth/confirm', p('token_hash=abc&type=recovery'))).toBe(true)
  })

  it('keeps the existing exceptions', () => {
    expect(signedInMayStayOnAuthRoute('/auth/signout', p())).toBe(true)
    expect(signedInMayStayOnAuthRoute('/auth/signin', p('email=a@b.com'))).toBe(true)
    expect(signedInMayStayOnAuthRoute('/auth/signup', p('org=granite'))).toBe(true)
  })

  it('still sends a signed-in user away from sign-in, sign-up and forgot-password', () => {
    expect(signedInMayStayOnAuthRoute('/auth/signin', p())).toBe(false)
    expect(signedInMayStayOnAuthRoute('/auth/signup', p())).toBe(false)
    expect(signedInMayStayOnAuthRoute('/auth/forgot-password', p())).toBe(false)
  })
})
