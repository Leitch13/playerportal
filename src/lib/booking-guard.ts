/**
 * The door check for public bookings (free trials, paid trials).
 *
 * Why this exists: on 5 Nov 2026 a free trial landed at Pro Football Coaching
 * from parent "A", child "A", email a@gmail.com, no phone. The trial form
 * wrote straight into the database from the browser, so nothing on our side
 * ever looked at it. John: "make sure this can't happen again."
 *
 * Every public trial now goes through a server route that runs these checks
 * before anything is saved, the academy is alerted, or a lead is created.
 * The detail checks are pure so they are tested without a network.
 */

export type BookingDetails = {
  parentName: string
  childName: string
  email: string
  phone: string
}

const LETTERS = /\p{L}/gu

function letterCount(s: string): number {
  return (s.match(LETTERS) || []).length
}

/** A name a real person would type: has letters, isn't one repeated letter or keyboard mash. */
function looksLikeAName(raw: string, minLetters: number): boolean {
  const s = raw.trim()
  if (letterCount(s) < minLetters) return false
  const letters = (s.toLowerCase().match(LETTERS) || []).join('')
  if (new Set(letters).size < 2) return false // "aaa", "AA"
  if (/^(test|testing|asdf|qwerty|xxx|abc|na|n\/a|none|fake)$/i.test(s.replace(/\s+/g, ''))) return false
  return true
}

/** Google refuses addresses shorter than 6 characters before the @. */
const MIN_LOCAL: Record<string, number> = { 'gmail.com': 6, 'googlemail.com': 6 }

/** UK and international numbers: 10 to 15 digits once spaces, dashes, brackets and + are removed. */
export function phoneLooksReal(phone: string): boolean {
  const digits = phone.replace(/[\s\-().+]/g, '')
  if (!/^\d{10,15}$/.test(digits)) return false
  if (new Set(digits).size < 3) return false // 0000000000, 0101010101
  if (/0123456789|1234567890/.test(digits)) return false
  return true
}

/**
 * Returns null when the details look like a real family, or the message to
 * show the parent. Order: the most likely mistake first.
 */
export function checkBookingDetails(d: BookingDetails): string | null {
  const parent = d.parentName.trim()
  // One word is fine: real parents type just "Courtney" or "Kieran" (Aug–Nov 2026 trials).
  if (!looksLikeAName(parent, 2) || parent.includes('@')) {
    return 'Please enter your name.'
  }
  if (!looksLikeAName(d.childName, 2)) {
    return "Please enter your child's name."
  }
  const email = d.email.trim().toLowerCase()
  const at = email.lastIndexOf('@')
  if (at < 1) return 'Please enter a valid email address.'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length < (MIN_LOCAL[domain] ?? 2)) {
    return 'Please enter your real email address. It’s where your booking confirmation goes.'
  }
  if (!phoneLooksReal(d.phone || '')) {
    return 'Please enter a mobile number so the coach can reach you on the day.'
  }
  return null
}

/** The address the request came from (first hop Vercel saw). */
export function clientIpOf(headers: Headers): string {
  return (headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
}
