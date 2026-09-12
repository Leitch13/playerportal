/**
 * 1-2-1 Slots · time helpers.
 *
 * The module stores a session as a local DATE + MINUTES since local midnight,
 * and applies Europe/London in exactly one place (here). A 16:30 slot is
 * 16:30 on both sides of the October clock change.
 *
 * This file is pure. No Stripe, no Supabase, no imports from src/lib/billing.
 */

export const LONDON = 'Europe/London'

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const WEEKDAY_KEYS: Record<Weekday, 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = {
  1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 7: 'sun',
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseISODate(iso: string): { y: number; m: number; d: number } {
  const m = ISO_DATE.exec(iso)
  if (!m) throw new Error(`Bad ISO date: ${iso}`)
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

export function toISODate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Days are pure calendar arithmetic (UTC-based so DST can't bite). */
export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseISODate(iso)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return toISODate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO), b = parseISODate(toISO)
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000)
}

export function isoWeekday(iso: string): Weekday {
  const { y, m, d } = parseISODate(iso)
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  return (js === 0 ? 7 : js) as Weekday
}

export function monthStart(iso: string): string {
  const { y, m } = parseISODate(iso)
  return toISODate(y, m, 1)
}

export function monthEnd(iso: string): string {
  const { y, m } = parseISODate(iso)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return toISODate(y, m, last)
}

export function nextMonthStart(iso: string): string {
  const { y, m } = parseISODate(iso)
  return m === 12 ? toISODate(y + 1, 1, 1) : toISODate(y, m + 1, 1)
}

/** "16:30" → 990 */
export function hhmmToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) throw new Error(`Bad time: ${hhmm}`)
  const h = Number(m[1]), mi = Number(m[2])
  if (h > 24 || mi > 59) throw new Error(`Bad time: ${hhmm}`)
  return h * 60 + mi
}

/** 990 → "16:30" */
export function minutesToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** Minutes London is ahead of UTC at a given instant (0 in winter, 60 in summer). */
export function londonOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const h = get('hour') % 24 // Intl can render midnight as "24"
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'))
  return Math.round((asUtc - instant.getTime()) / 60_000)
}

/** The UTC instant of a London wall-clock time. */
export function londonToInstant(iso: string, minutes: number): Date {
  const { y, m, d } = parseISODate(iso)
  const wall = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60)
  // Two passes settle the offset across a DST boundary.
  let guess = wall
  for (let i = 0; i < 2; i++) guess = wall - londonOffsetMinutes(new Date(guess)) * 60_000
  return new Date(guess)
}

/** London date + minutes for a UTC instant. */
export function instantToLondon(instant: Date): { date: string; minutes: number } {
  const shifted = new Date(instant.getTime() + londonOffsetMinutes(instant) * 60_000)
  return {
    date: toISODate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}

export function todayLondon(now: Date = new Date()): string {
  return instantToLondon(now).date
}
