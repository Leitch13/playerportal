import { describe, it, expect } from 'vitest'
import { hashToken, newToken, linkExpired, datePassed, confirmUrl } from './trial-email-confirm'

describe('free trial confirm by email', () => {
  it('stores only a hash, and the hash matches the token', () => {
    const { token, hash } = newToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(hash).toBe(hashToken(token))
    expect(hash).not.toContain(token)
  })
  it('links last 7 days', () => {
    const now = new Date('2026-11-12T12:00:00Z')
    expect(linkExpired('2026-11-06T12:00:00Z', now)).toBe(false)
    expect(linkExpired('2026-11-05T11:00:00Z', now)).toBe(true)
  })
  it('a trial date before today (UK) has passed; today and later have not', () => {
    const now = new Date('2026-11-05T23:30:00Z') // 23:30 in London, still 5 Nov
    expect(datePassed('2026-11-04', now)).toBe(true)
    expect(datePassed('2026-11-05', now)).toBe(false)
    expect(datePassed(null, now)).toBe(false)
  })
  it('the email link opens the confirm page on the academy booking page', () => {
    expect(confirmUrl('https://www.theplayerportal.net/', 'granite-city', 'abc')).toBe('https://www.theplayerportal.net/book/granite-city/trial/confirm/abc')
  })
})
