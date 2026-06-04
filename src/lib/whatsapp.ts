/**
 * WhatsApp deep-link helpers (Sprint 6 — Option A).
 *
 * Pure URL construction. No API calls, no Meta dependency, no per-message
 * fees. Every UI surface that wants to open WhatsApp with a fresh chat
 * to a parent/academy uses the helpers here so the phone-normalisation
 * + URL-encoding logic stays in one place.
 *
 * Phone numbers are normalised to E.164-style international format that
 * wa.me accepts — strip every non-digit, then if the result starts with
 * a UK leading zero (07…) and is 11 digits long, swap for 447….
 * Anything else passes through unchanged.
 */

/**
 * Strip non-digits and convert UK domestic 07XXXXXXXXX → 447XXXXXXXXX
 * so wa.me accepts it. Returns null when nothing reasonable comes out.
 */
export function normalisePhone(input: string | null | undefined): string | null {
  if (!input) return null
  const digits = input.replace(/[^\d]/g, '')
  if (!digits) return null
  // UK domestic 07… (11 digits starting with 07) → 447…
  if (digits.length === 11 && digits.startsWith('07')) {
    return '44' + digits.slice(1)
  }
  // Leading zeros on international-looking numbers are usually mistakes.
  if (digits.length > 11 && digits.startsWith('0')) {
    return digits.replace(/^0+/, '')
  }
  return digits
}

/**
 * Build a wa.me URL with optional pre-filled message.
 *   buildWhatsappUrl('+44 7305 365463', 'Hi Sarah') → 'https://wa.me/447305365463?text=Hi%20Sarah'
 *   buildWhatsappUrl(null)                          → null
 */
export function buildWhatsappUrl(phone: string | null | undefined, message?: string): string | null {
  const num = normalisePhone(phone)
  if (!num) return null
  const base = 'https://wa.me/' + num
  if (!message || !message.trim()) return base
  return base + '?text=' + encodeURIComponent(message.trim())
}

/**
 * Build a Click-to-Share URL (no recipient — opens the WhatsApp share
 * sheet so the parent picks who to send to). Used for referral CTAs.
 *   buildWhatsappShareUrl('Try this academy!') → 'https://wa.me/?text=Try%20this%20academy!'
 */
export function buildWhatsappShareUrl(message: string): string {
  return 'https://wa.me/?text=' + encodeURIComponent(message.trim())
}

// ─── Pre-filled message templates (server-side use) ──────────────────
// Plain strings with {placeholder} markers. Caller fills in. Strings
// are deliberately short — long pre-filled messages get truncated by
// WhatsApp on some Android builds + look spammy. Tone is: friendly,
// short, parent-edits-if-they-want.

export const WA_TEMPLATES = {
  /** Trial Manager — admin chasing a parent about an upcoming trial. */
  trialChase: (params: { parentName: string; academyName: string; childName: string }) =>
    `Hi ${params.parentName.split(' ')[0]}, this is ${params.academyName} about ${params.childName}'s trial — quick question.`,

  /** Trial follow-up — admin nudging post-attended for conversion. */
  trialFollowUp: (params: { parentName: string; academyName: string; childName: string }) =>
    `Hi ${params.parentName.split(' ')[0]}, ${params.academyName} here. Hope ${params.childName} enjoyed the trial — any questions about joining?`,

  /** Overdue payment — admin reaching out about a card issue. */
  paymentChase: (params: { parentName: string; academyName: string }) =>
    `Hi ${params.parentName.split(' ')[0]}, this is ${params.academyName}. We noticed last month's payment didn't go through — happy to help sort it out.`,

  /** Parent → academy: in-app "Contact us on WhatsApp" widget. */
  parentToAcademyHi: (params: { academyName: string; childName?: string }) =>
    params.childName
      ? `Hi ${params.academyName}, this is ${params.childName}'s parent — quick question.`
      : `Hi ${params.academyName}, quick question.`,

  /** Click-to-share referral message. */
  referralInvite: (params: { academyName: string; bookingUrl: string }) =>
    `${params.academyName} is brilliant — they're offering free trial sessions. Have a look: ${params.bookingUrl}`,
}
