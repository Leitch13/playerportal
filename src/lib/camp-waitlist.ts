/**
 * Camp waiting list — the simple version.
 *
 * A parent who finds a camp full leaves their details; the academy sees who
 * is waiting on that camp and can email them the booking link when a place
 * opens. Entries are rows in the existing `leads` table (someone who wanted a
 * place and couldn't get one is a lead), tagged with the camp they asked for,
 * so no new table is needed and they also show on the academy's Leads page.
 *
 * It deliberately does NOT hold a place, take payment, or let anyone book a
 * full camp. Capacity and checkout are untouched.
 */

export const CAMP_WAITLIST_SOURCE = 'camp_waitlist'
/** How many people one camp's list will take, so a public form can't be used to flood an academy. */
export const CAMP_WAITLIST_MAX = 100

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

/** The tag stored in a lead's notes that ties it to one camp. */
export const campMarker = (campId: string) => `[camp:${campId}]`

export function waitlistNote(campName: string, campId: string, startDate?: string | null): string {
  const when = startDate ? ` (starts ${startDate})` : ''
  return `Waiting list for ${campName}${when}. ${campMarker(campId)}`
}

export interface WaitlistInput {
  campId: string
  firstName: string
  lastName: string | null
  email: string
  phone: string | null
  childName: string
  childAge: number | null
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Validate and tidy what the public form sent. Returns the reason in plain words when it can't be used. */
export function parseWaitlistInput(body: Record<string, unknown>): { ok: true; value: WaitlistInput } | { ok: false; error: string } {
  if (!isUuid(body.campId)) return { ok: false, error: 'That camp could not be found.' }
  const name = clean(body.parentName, 80)
  if (name.length < 2) return { ok: false, error: 'Please enter your name.' }
  const email = clean(body.email, 120).toLowerCase()
  if (!EMAIL.test(email)) return { ok: false, error: 'Please enter a valid email address.' }
  const childName = clean(body.childName, 80)
  if (childName.length < 2) return { ok: false, error: 'Please enter your child’s name.' }
  const phone = clean(body.phone, 30) || null
  const ageNum = Number(body.childAge)
  const childAge = Number.isInteger(ageNum) && ageNum >= 1 && ageNum <= 18 ? ageNum : null
  const [firstName, ...rest] = name.split(' ')
  return { ok: true, value: { campId: body.campId, firstName, lastName: rest.join(' ') || null, email, phone, childName, childAge } }
}

/** Count waiting-list entries per camp from a set of leads (each carries its camp tag in notes). */
export function waitingByCamp(leads: Array<{ notes: string | null }>): Map<string, number> {
  const out = new Map<string, number>()
  for (const l of leads) {
    const m = /\[camp:([0-9a-f-]{36})\]/i.exec(l.notes || '')
    if (m) out.set(m[1], (out.get(m[1]) || 0) + 1)
  }
  return out
}
