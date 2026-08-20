/**
 * Adds a captured lead to the "ASCEND Leads" Resend Audience — John's real,
 * broadcastable email list (Resend dashboard → Audiences). Raw fetch rather
 * than the SDK so a version bump can't break lead capture.
 *
 * MUST never throw and never block the capture path: the alert email to
 * John is the source of truth for a lead; the audience is the marketing
 * list built alongside it. Missing env → silent no-op.
 */
export async function addToAscendAudience(email: string, fullName: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const audienceId = process.env.RESEND_ASCEND_AUDIENCE_ID
  if (!apiKey || !audienceId) return
  const [firstName, ...rest] = fullName.trim().split(/\s+/)
  try {
    await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        first_name: firstName || '',
        last_name: rest.join(' '),
        unsubscribed: false,
      }),
    })
  } catch {
    /* list-building is best-effort; the lead is already captured via email */
  }
}
