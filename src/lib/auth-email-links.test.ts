import { describe, it, expect } from 'vitest'
import { authLinkUrl, emailKey } from './auth-email-links'

// WLFA parent, 19 Oct 2026: reset links only worked in the browser that asked for them.
describe('login links work on any device', () => {
  it('a reset link carries a one-time token and lands on the set-password page', () => {
    expect(authLinkUrl('https://www.theplayerportal.net/', 'abc123', 'reset'))
      .toBe('https://www.theplayerportal.net/auth/confirm?token_hash=abc123&type=recovery&next=%2Fauth%2Freset-password')
  })
  it('a login link lands on the dashboard', () => {
    expect(authLinkUrl('https://www.theplayerportal.net', 'abc', 'signin')).toContain('type=magiclink&next=%2Fdashboard')
  })
  it('the address is never stored, only a fixed uuid-shaped key', () => {
    expect(emailKey(' Steven@AIM-ltd.uk ')).toBe(emailKey('steven@aim-ltd.uk'))
    expect(emailKey('a@b.co')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})
