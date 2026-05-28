import { Resend } from 'resend'

const FROM_EMAIL = process.env.FROM_EMAIL || 'Player Portal <noreply@playerportal.app>'

// Pull just the address out of FROM_EMAIL, e.g. "noreply@theplayerportal.net"
// from "Player Portal <noreply@theplayerportal.net>". We keep this verified
// platform address as the actual sender (so deliverability/SPF/DKIM hold), and
// only swap the DISPLAY NAME per academy.
function senderAddress(): string {
  const m = FROM_EMAIL.match(/<([^>]+)>/)
  return m ? m[1].trim() : FROM_EMAIL.trim()
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  // Optional academy display name — shown as the sender, e.g. "JSI Sports".
  // Falls back to the platform default when not provided.
  fromName?: string
  // Optional reply-to (e.g. the academy's contact email) so parent replies
  // land with the academy rather than the no-reply inbox.
  replyTo?: string
}

export async function sendEmail({ to, subject, html, fromName, replyTo }: EmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    return { success: true, skipped: true }
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    // Build the From line. With a fromName we present the academy's name on the
    // verified platform address; without it we use FROM_EMAIL verbatim.
    const cleanName = fromName?.replace(/[<>"]/g, '').trim()
    const from = cleanName ? `${cleanName} <${senderAddress()}>` : FROM_EMAIL
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    })
    if (error) {
      return { success: false, error }
    }
    return { success: true, id: data?.id }
  } catch (err) {
    return { success: false, error: err }
  }
}
