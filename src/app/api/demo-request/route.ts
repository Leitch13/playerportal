import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'

/**
 * Public "Book a demo / Talk to us" capture for the marketing site.
 *
 * Emails John (ADMIN_NOTIFICATION_EMAIL chain, same as new-academy alerts)
 * so a warm academy-owner lead lands in the same inbox as every other
 * signal. Intentionally email-only — no schema, no dashboard surface, no
 * billing/auth touch. Rate-limited to blunt form spam. A failed send
 * returns 502 so the form can tell the user to email directly rather than
 * silently swallowing a lead.
 */
export async function POST(request: NextRequest) {
  const ip =
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const { success } = rateLimit(`demo-request:${ip}`, 5, 3600000)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests — please email us directly.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const name = str(body.name, 120)
  const academy = str(body.academy, 160)
  const email = str(body.email, 200)
  const phone = str(body.phone, 60)
  const currentTool = str(body.currentTool, 160)
  const message = str(body.message, 2000)

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const to =
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    'john.leitch@playitloveit.com'

  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c))
  const row = (label: string, value: string) =>
    value ? `<tr><td style="padding:6px 0;color:#888;width:150px;">${label}</td><td style="color:#111;">${esc(value)}</td></tr>` : ''

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="padding:20px 24px;background:#4ecde6;color:#0a0a0a;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:18px;font-weight:800;">New demo request</h1>
  </div>
  <div style="padding:22px 24px;background:#fff;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;">
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      ${row('Name', name)}
      ${row('Academy', academy)}
      ${row('Email', email)}
      ${row('Phone', phone)}
      ${row('Currently using', currentTool)}
      ${message ? `<tr><td style="padding:10px 0 0;color:#888;vertical-align:top;">Message</td><td style="padding:10px 0 0;color:#111;">${esc(message)}</td></tr>` : ''}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#666;">Reply straight to this email to reach them — reply-to is set to their address.</p>
  </div>
</div>`

  const sent = await sendEmail({
    to,
    subject: `Demo request — ${name}${academy ? ` (${academy})` : ''}`,
    html,
    replyTo: email,
  })

  if (!sent.success || ('skipped' in sent && sent.skipped)) {
    // Email not configured or send failed — tell the client so the lead
    // isn't silently lost; the form shows a "email us directly" fallback.
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
