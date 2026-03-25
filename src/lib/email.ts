import { Resend } from 'resend'

const FROM_EMAIL = process.env.FROM_EMAIL || 'Player Portal <noreply@playerportal.app>'

interface EmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL SKIPPED] To: ${to}, Subject: ${subject}`)
    return { success: true, skipped: true }
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })
    if (error) {
      console.error('[EMAIL ERROR]', error)
      return { success: false, error }
    }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('[EMAIL ERROR]', err)
    return { success: false, error: err }
  }
}
