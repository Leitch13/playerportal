import { NextRequest, NextResponse } from 'next/server'
import { promises as dns } from 'dns'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'

// Throwaway-inbox domains — a "lead" from one of these can never receive
// their demo page, so it's pure ad-spend waste. Reject with a clear message.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', '10minutemail.com',
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'yopmail.com', 'trashmail.com',
  'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'fakeinbox.com',
  'throwawaymail.com', 'mintemail.com', 'mohmal.com', 'tempinbox.com', 'spamgourmet.com',
  'mailnesia.com', 'mytemp.email', 'burnermail.io', 'emailondeck.com',
])

// The handful of fat-finger domains that ARE registered (usually by
// squatters, so an MX check alone won't catch them) but are never what an
// academy owner meant to type.
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
    // Definitive "no such domain" / "no MX data" answers → reject.
    if (code === 'ENOTFOUND' || code === 'ENODATA') return false
    return true // transient resolver errors — fail open
  }
}

/**
 * Ad-funnel lead capture for /start ("we'll build your booking page free").
 *
 * Same intentionally-light pattern as /api/demo-request: email-only, no
 * schema, no auth/billing touch. Two sends per lead — an alert to John
 * (reply-to set to the lead) and an auto-reply to the lead setting the
 * 24-hour expectation. The John alert is the one that matters: if it fails
 * we return 502 so the form tells the lead to email directly instead of
 * silently losing them; the auto-reply is best-effort.
 */
export async function POST(request: NextRequest) {
  const ip =
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const { success } = rateLimit(`funnel-lead:${ip}`, 5, 3600000)
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
  const players = str(body.players, 40)

  if (!name || !academy || !email) {
    return NextResponse.json({ error: 'Name, academy and email are required.' }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const domain = email.split('@')[1].toLowerCase()
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return NextResponse.json(
      { error: 'Please use your real email — that’s where we send your finished booking page.' },
      { status: 400 }
    )
  }
  const suggestion = TYPO_SUGGESTIONS[domain]
  if (suggestion) {
    return NextResponse.json(
      { error: `Did you mean @${suggestion}? Double-check your email — it’s where your booking page gets sent.` },
      { status: 400 }
    )
  }
  if (!(await domainAcceptsMail(domain))) {
    return NextResponse.json(
      { error: 'That email domain doesn’t seem to exist — double-check the spelling. It’s where we send your booking page.' },
      { status: 400 }
    )
  }

  const to =
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    'john.leitch@playitloveit.com'

  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c))
  const row = (label: string, value: string) =>
    value ? `<tr><td style="padding:6px 0;color:#888;width:150px;">${label}</td><td style="color:#111;">${esc(value)}</td></tr>` : ''

  const alertHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="padding:20px 24px;background:#0d1b2b;color:#4ecde6;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:18px;font-weight:800;">🔥 Ad funnel lead — build their page</h1>
  </div>
  <div style="padding:22px 24px;background:#fff;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;">
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      ${row('Name', name)}
      ${row('Academy', academy)}
      ${row('Email', email)}
      ${row('Phone', phone)}
      ${row('Players', players)}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#666;">They've been told their demo booking page arrives within 24 hours. Reply straight to this email to reach them.</p>
  </div>
</div>`

  const alert = await sendEmail({
    to,
    subject: `Funnel lead: ${academy} (${name})`,
    html: alertHtml,
    replyTo: email,
  })

  if (!alert.success) {
    return NextResponse.json(
      { error: 'Something went wrong — email john@theplayerportal.net and we will sort you out.' },
      { status: 502 }
    )
  }

  // Best-effort auto-reply to the lead; a failure here never loses the lead.
  const replyHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1d2c3b;">
  <div style="padding:24px;background:linear-gradient(170deg,#12a2bd,#0b7f96);color:#fff;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:20px;font-weight:800;">We're on it, ${esc(name.split(' ')[0])} ⚽</h1>
  </div>
  <div style="padding:24px;background:#fff;border:1px solid #e3ebf0;border-top:0;border-radius:0 0 12px 12px;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 14px;">Your booking page for <strong>${esc(academy)}</strong> is being built now — you'll have it in your inbox <strong>within 24 hours</strong>.</p>
    <p style="margin:0 0 14px;">It'll have your academy's name and colours on it, with example classes so you can see exactly what parents would see. No payment details needed, no commitment — it's yours to look at.</p>
    <p style="margin:0 0 14px;">While you wait, here's what the academies already on Player Portal do with it: bookings, memberships, auto-billing, attendance, camps and parent messaging in one place. One academy moved 180+ members over in a single afternoon.</p>
    <p style="margin:0;">Got a question in the meantime? Just reply to this email — it comes straight to me.</p>
    <p style="margin:18px 0 0;">— John Leitch, founder, Player Portal</p>
  </div>
</div>`

  await sendEmail({
    to: email,
    subject: `Your ${academy} booking page is being built`,
    html: replyHtml,
    fromName: 'Player Portal',
    replyTo: to,
  })

  return NextResponse.json({ ok: true })
}
