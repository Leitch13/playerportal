import { describe, it, expect } from 'vitest'
import { isAlreadyRegistered, safeBookingReturn } from './already-registered'
import { authLinkUrl } from './auth-email-links'

describe('already registered', () => {
  it('spots the login system saying the email has an account', () => {
    expect(isAlreadyRegistered({ message: 'User already registered' })).toBe(true)
    expect(isAlreadyRegistered({ code: 'user_already_exists', message: 'x' })).toBe(true)
    expect(isAlreadyRegistered({ message: 'A user with this email address has already been registered' })).toBe(true)
    expect(isAlreadyRegistered(null, { identities: [] })).toBe(true)
  })
  it('leaves every other error alone', () => {
    expect(isAlreadyRegistered({ message: 'Password should be at least 6 characters' })).toBe(false)
    expect(isAlreadyRegistered({ message: 'Database error saving new user' })).toBe(false)
    expect(isAlreadyRegistered(null, { identities: [{}] })).toBe(false)
    expect(isAlreadyRegistered(null, null)).toBe(false)
  })
})

describe('login link back to a booking page', () => {
  it('only allows booking pages on this site', () => {
    expect(safeBookingReturn('/book/profootballcoachingni/class/abc-123/quick-book')).toBe('/book/profootballcoachingni/class/abc-123/quick-book')
    expect(safeBookingReturn('//evil.com')).toBe(null)
    expect(safeBookingReturn('https://evil.com/book/x')).toBe(null)
    expect(safeBookingReturn('/dashboard/settings')).toBe(null)
    expect(safeBookingReturn('/book/x/../../admin')).toBe(null)
    expect(safeBookingReturn('/book/x?next=//evil.com')).toBe(null)
    expect(safeBookingReturn('/book/x\\evil.com')).toBe(null)
    expect(safeBookingReturn(undefined)).toBe(null)
  })
  it('sign-in links still go to the dashboard unless a booking page is given', () => {
    expect(authLinkUrl('https://a.net', 'h', 'signin')).toContain('next=%2Fdashboard')
    expect(authLinkUrl('https://a.net', 'h', 'reset')).toContain('next=%2Fauth%2Freset-password')
    expect(authLinkUrl('https://a.net', 'h', 'signin', '/book/x/class/y/quick-book')).toContain('next=%2Fbook%2Fx%2Fclass%2Fy%2Fquick-book')
    expect(authLinkUrl('https://a.net', 'h', 'reset', '/book/x')).toContain('next=%2Fauth%2Freset-password')
    expect(authLinkUrl('https://a.net', 'h', 'signin', '//evil.com')).toContain('next=%2Fdashboard')
  })
})
