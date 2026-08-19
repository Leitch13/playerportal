import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'

/**
 * ASCEND webinar registration capture (/wardrop).
 *
 * Deliberately modelled on /api/demo-request: this is John's OWN marketing
 * capture, not an academy's. It is email-only — no schema, no dashboard
 * surface, no billing/auth touch — so it stays additive and carries no
 * migration risk.
 *
 * NOT /api/leads/create: that route is tenant-scoped (requires an
 * organisation_id and fires speed-to-lead alerts at that academy's admins).
 * Pushing ASCEND webinar signups through it would pollute an academy's leads
 * pipeline and email their staff about John's webinar.
 *
 * The client awaits this call BEFORE redirecting to Stripe, so an abandoned
 * checkout still leaves a captured registration. A failure here must never
 * block checkout — the client ignores the result and redirects regardless.
 */
export async function POST(request: NextRequest) {
  const ip =
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const { success } = rateLimit(`webinar-register:${ip}`, 8, 3600000)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
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

  // All three are required on the client; re-checked here because a public
  // endpoint can be called directly.
  if (!name || !academy || !email) {
    return NextResponse.json({ error: 'Name, academy and email are all required.' }, { status: 400 })
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
  <div style="padding:20px 24px;background:#22d3ee;color:#0a0a0a;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:18px;font-weight:800;">Webinar registration — Sam Wardrop</h1>
  </div>
  <div style="padding:22px 24px;background:#fff;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;">
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      ${row('Name', name)}
      ${row('Academy', academy)}
      ${row('Email', email)}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#666;">
      Captured before the Stripe redirect — this person may or may not have completed payment.
      Cross-check against Stripe to spot abandoned checkouts.
    </p>
  </div>
</div>`

  const sent = await sendEmail({
    to,
    subject: `Webinar registration — ${name} (${academy})`,
    html,
    replyTo: email,
  })

  if (!sent.success || ('skipped' in sent && sent.skipped)) {
    // Surfaced for logging/observability only. The client deliberately ignores
    // this and still sends the visitor to checkout.
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
