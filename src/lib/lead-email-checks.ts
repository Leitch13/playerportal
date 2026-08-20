import { promises as dns } from 'dns'

/**
 * Shared email-quality checks for public lead-capture endpoints
 * (/api/funnel/lead, /api/ascend/lead). Three layers, zero friction for
 * real leads: disposable-inbox blocklist, fat-finger domain suggestions,
 * and an MX lookup that fail-opens on DNS noise.
 */

// Throwaway-inbox domains — a "lead" from one of these can never receive
// what we send them, so it's pure ad-spend waste.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', '10minutemail.com',
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'yopmail.com', 'trashmail.com',
  'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'fakeinbox.com',
  'throwawaymail.com', 'mintemail.com', 'mohmal.com', 'tempinbox.com', 'spamgourmet.com',
  'mailnesia.com', 'mytemp.email', 'burnermail.io', 'emailondeck.com',
])

// Fat-finger domains that ARE registered (usually by squatters, so an MX
// check alone won't catch them) but are never what the person meant.
const TYPO_SUGGESTIONS: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.co': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloook.com': 'outlook.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com', 'live.co': 'live.com',
}

/**
 * Does the email's domain actually accept mail? Resolves MX records with a
 * 2.5s guard. Fail-OPEN on timeout/DNS blips — never lose a real lead to
 * infrastructure noise; only reject on a definitive "domain doesn't exist /
 * has no mail server" answer.
 */
async function domainAcceptsMail(domain: string): Promise<boolean> {
  try {
    const mx = await Promise.race([
      dns.resolveMx(domain),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ])
    if (mx === null) return true // timed out — fail open
    return mx.length > 0
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOTFOUND' || code === 'ENODATA') return false
    return true // transient resolver errors — fail open
  }
}

/**
 * Full check for a lead email. Returns null when acceptable, or a
 * user-facing error string when the lead should be rejected.
 * `deliverableName` personalises the message ("your booking page",
 * "the calculator").
 */
export async function checkLeadEmail(email: string, deliverableName: string): Promise<string | null> {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return 'Please enter a valid email address.'
  }
  const domain = email.split('@')[1].toLowerCase()
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return `Please use your real email — that’s where we send ${deliverableName}.`
  }
  const suggestion = TYPO_SUGGESTIONS[domain]
  if (suggestion) {
    return `Did you mean @${suggestion}? Double-check your email — it’s where ${deliverableName} gets sent.`
  }
  if (!(await domainAcceptsMail(domain))) {
    return `That email domain doesn’t seem to exist — double-check the spelling. It’s where we send ${deliverableName}.`
  }
  return null
}
