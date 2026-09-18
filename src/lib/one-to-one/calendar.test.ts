import { describe, it, expect, beforeAll } from 'vitest'
import { buildIcs, calendarToken, userFromToken, icsText, foldLine } from './calendar'

const USER = '4f6a1c2e-9b3d-4e5f-8a7b-0c1d2e3f4a5b'

beforeAll(() => { process.env.ONE_TO_ONE_CALENDAR_SECRET = 'test-secret' })

describe('calendar token', () => {
  it('round-trips a user id', () => {
    expect(userFromToken(calendarToken(USER))).toBe(USER)
  })
  it('refuses a tampered signature', () => {
    const t = calendarToken(USER)
    const bad = t.slice(0, -1) + (t.endsWith('a') ? 'b' : 'a')
    expect(userFromToken(bad)).toBeNull()
  })
  it('refuses a different user with the same signature', () => {
    const [, sig] = calendarToken(USER).split('.')
    const other = Buffer.from('00000000-0000-0000-0000-000000000000').toString('base64url')
    expect(userFromToken(`${other}.${sig}`)).toBeNull()
  })
  it('refuses junk', () => {
    expect(userFromToken('')).toBeNull()
    expect(userFromToken('nodot')).toBeNull()
    expect(userFromToken('bm90LWEtdXVpZA.xxxx')).toBeNull()
  })
})

describe('ics', () => {
  it('escapes text', () => {
    expect(icsText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne')
  })
  it('folds long lines at 75 octets', () => {
    const folded = foldLine('X'.repeat(100))
    const parts = folded.split('\r\n')
    expect(parts[0].length).toBe(75)
    expect(parts[1].startsWith(' ')).toBe(true)
    expect(parts.join('').replace(/^ /gm, '')).toContain('X'.repeat(75))
  })
  it('emits a London session as UTC, across DST', () => {
    const ics = buildIcs('Test', [
      { uid: 'a', date: '2026-07-01', startMinutes: 17 * 60, durationMinutes: 30, title: 'Summer' },
      { uid: 'b', date: '2026-12-01', startMinutes: 17 * 60, durationMinutes: 30, title: 'Winter' },
    ], new Date('2026-06-01T00:00:00Z'))
    expect(ics).toContain('DTSTART:20260701T160000Z')   // BST → 16:00Z
    expect(ics).toContain('DTEND:20260701T163000Z')
    expect(ics).toContain('DTSTART:20261201T170000Z')   // GMT → 17:00Z
    expect(ics).toContain('X-WR-CALNAME:Test')
    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(2)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
  it('marks a cancelled session', () => {
    const ics = buildIcs('T', [{ uid: 'c', date: '2026-10-04', startMinutes: 420, durationMinutes: 30, title: 'x', cancelled: true }])
    expect(ics).toContain('STATUS:CANCELLED')
  })
})
