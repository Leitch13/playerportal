/**
 * The top of a parent's home page: a greeting and one line about today.
 *
 * Until 14 Oct 2026 it said "Welcome back," and the first word of the account
 * name. Many accounts are named for the family ("Milne Family"), so parents
 * were greeted by their surname. The greeting now uses no name at all, and
 * the line under it says what is happening, using the child's first name.
 * Times are UK time, whatever the server's clock is set to.
 */
const UK = 'Europe/London'

// Built once: making a time-zone formatter is slow, and this runs on every home page load.
const UK_FORMAT = new Intl.DateTimeFormat('en-GB', { timeZone: UK, hour: 'numeric', hourCycle: 'h23', weekday: 'long', day: 'numeric', month: 'long' })

function ukParts(now: Date) {
  const p = Object.fromEntries(UK_FORMAT.formatToParts(now).map((x) => [x.type, x.value]))
  return { hour: Number(p.hour), date: `${p.weekday} ${p.day} ${p.month}` }
}

export function greetingFor(now: Date = new Date()): string {
  const h = ukParts(now).hour
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/** "Tuesday 14 October" in UK time. */
export const ukDateLabel = (now: Date = new Date()) => ukParts(now).date

/** One line about the next session, or null when there is nothing booked. */
export function todayLine(next: { label: string; child: string | null } | null): string | null {
  if (!next) return null
  const child = (next.child || '').trim().split(/\s+/)[0]
  const m = /^Today,\s*(\d{1,2}):(\d{2})/.exec(next.label)
  if (m) return `${child || 'Your child'} has training ${Number(m[1]) >= 17 ? 'tonight' : 'today'}.`
  return child ? `${child}'s next session is ${next.label.replace(',', ' at')}.` : `Next session: ${next.label.replace(',', ' at')}.`
}

/** A maps link for a venue, or null when there is no venue. */
export const directionsUrl = (location: string | null | undefined) => (location || '').trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((location || '').trim())}` : null
