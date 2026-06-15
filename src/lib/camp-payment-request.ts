// Camps Phase 2B — Manual payment request after a camp extension.
//
// Pure helpers + the feature flag. This is NOT a billing system: there is no
// Stripe, no payments/camp_bookings write, no balance tracking. The admin
// optionally emails affected families "we added a day — here's the extra cost
// and how to pay the academy DIRECTLY". The money is collected off-platform.
//
// Gated by its own flag, independent of CAMP_STRUCTURAL_EDIT_ENABLED, so the
// notify step can ship / roll back without touching camp editing.
//
// NEXT_PUBLIC_ prefix: the edit modal (a client component) gates on this flag
// directly, so it must be readable in the browser bundle. The route reads the
// same constant server-side. This keeps the feature to the 4 planned files (no
// page.tsx → CampActions prop passthrough). Set the env var
// NEXT_PUBLIC_CAMP_MANUAL_PAYMENT_REQUEST_ENABLED=true to activate.
export const CAMP_MANUAL_PAYMENT_REQUEST_ENABLED =
  process.env.NEXT_PUBLIC_CAMP_MANUAL_PAYMENT_REQUEST_ENABLED === 'true'

// Sane upper bound to catch fat-finger amounts (this never charges anyone —
// it's display text in an email — but a £999,999 ask would alarm parents).
export const MAX_REQUEST_AMOUNT = 10_000

// Validate the admin-entered amount. Returns an error string, or null when ok.
export function amountError(raw: string | number): string | null {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).trim())
  if (!Number.isFinite(n)) return 'Enter an amount.'
  if (n <= 0) return 'Amount must be greater than £0.'
  if (n > MAX_REQUEST_AMOUNT) return `Amount can't exceed £${MAX_REQUEST_AMOUNT.toLocaleString('en-GB')}.`
  return null
}

// Validate the payment instructions. Returns an error string, or null when ok.
export function instructionsError(raw: string): string | null {
  if (!raw || !raw.trim()) return 'Enter how families should pay (e.g. bank transfer details).'
  if (raw.trim().length > 2000) return 'Instructions are too long.'
  return null
}

// Format a numeric amount as GBP for the email + preview.
export function formatRequestAmount(raw: string | number): string {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).trim())
  return `£${(Number.isFinite(n) ? n : 0).toFixed(2)}`
}

export type CampBookingLite = {
  parent_email: string | null
  parent_name: string | null
  child_name: string | null
  payment_status: string | null
}

export type Recipient = {
  email: string
  parentName: string
  childName: string
}

// Resolve the families to email from a camp's bookings. Read-only, pure:
//  - only BOOKED families (payment_status pending|paid) — never cancelled/refunded
//  - de-duped by lowercased email (first occurrence wins)
//  - synthetic admin-added addresses (@theplayerportal.net) excluded
//  - anonymous/public bookings included (they carry a real parent_email)
export function resolveRecipients(bookings: CampBookingLite[]): Recipient[] {
  const seen = new Set<string>()
  const out: Recipient[] = []
  for (const b of bookings || []) {
    const email = (b.parent_email || '').trim()
    if (!email) continue
    if (email.toLowerCase().endsWith('@theplayerportal.net')) continue
    if (!['pending', 'paid'].includes((b.payment_status || '').toLowerCase())) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      email,
      parentName: b.parent_name || 'there',
      childName: b.child_name || 'your child',
    })
  }
  return out
}
