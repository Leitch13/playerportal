/**
 * 1-2-1 Slots · calendar feeds.
 *
 * A coach, a parent or the academy subscribes once and their phone calendar
 * pulls the sessions from then on. The feed is read-only and addressed by a
 * token derived from the user id, so nothing needs storing and nothing on the
 * link says who it belongs to. Times are London wall-clock, sent as UTC.
 *
 * No money in here. Nothing from class billing is imported.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { londonToInstant } from './time'

function secret(): string {
  return process.env.ONE_TO_ONE_CALENDAR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function sign(userId: string): string {
  return createHmac('sha256', secret()).update(`one-to-one-calendar:${userId}`).digest('base64url').slice(0, 32)
}

/** The token that goes in the feed URL for this user. Stable for the life of the secret. */
export function calendarToken(userId: string): string {
  return `${Buffer.from(userId, 'utf8').toString('base64url')}.${sign(userId)}`
}

/** The user a token belongs to, or null if it was made up or tampered with. */
export function userFromToken(token: string): string | null {
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const id64 = token.slice(0, dot), sig = token.slice(dot + 1)
  let userId: string
  try { userId = Buffer.from(id64, 'base64url').toString('utf8') } catch { return null }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return null
  const expect = sign(userId)
  if (sig.length !== expect.length) return null
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expect)) ? userId : null
}

export function calendarUrl(userId: string, appUrl: string): { https: string; webcal: string } {
  const base = appUrl.replace(/\/$/, '')
  const https = `${base}/api/one-to-one/calendar/${calendarToken(userId)}`
  return { https, webcal: https.replace(/^https?:\/\//, 'webcal://') }
}

export interface CalendarEvent {
  uid: string
  date: string            // YYYY-MM-DD, London
  startMinutes: number    // since London midnight
  durationMinutes: number
  title: string
  location?: string | null
  description?: string | null
  cancelled?: boolean
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** RFC 5545 text: backslash, semicolon, comma and newline are escaped. */
export function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Lines longer than 75 octets are folded with CRLF + space, per the spec. */
export function foldLine(line: string): string {
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf8')
    if (bytes + b > (out.length === 0 ? 75 : 74)) { out.push(cur); cur = ' ' + ch; bytes = 1 + b }
    else { cur += ch; bytes += b }
  }
  out.push(cur)
  return out.join('\r\n')
}

export function buildIcs(name: string, events: CalendarEvent[], now = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Player Portal//1-2-1 Slots//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(name)}`,
    'X-WR-TIMEZONE:Europe/London',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]
  const dtstamp = stamp(now)
  for (const e of events) {
    const start = londonToInstant(e.date, e.startMinutes)
    const end = new Date(start.getTime() + e.durationMinutes * 60_000)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsText(e.uid)}@theplayerportal.net`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${icsText(e.title)}`,
    )
    if (e.location) lines.push(`LOCATION:${icsText(e.location)}`)
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`)
    lines.push(`STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
