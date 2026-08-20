import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { checkLeadEmail } from '@/lib/lead-email-checks'
import { addToAscendAudience } from '@/lib/ascend-audience'

/**
 * ASCEND mentorship lead capture (/ascend — "free pricing calculator").
 *
 * John's OWN marketing capture (same reasoning as /api/webinar-register:
 * NOT the tenant-scoped /api/leads/create). Email-only + Resend Audience —
 * no schema, no migration risk. Three effects per lead:
 *   1. contact added to the "ASCEND Leads" Resend Audience (the list)
 *   2. alert email to John, reply-to the lead
 *   3. auto-reply delivering the calculator link, signed John
 * The alert send is the one that must succeed; audience + auto-reply are
 * best-effort.
 *
 * CORS is permissive: the Wix-embedded ASCEND pages (calculator gate on the
 * full-page embed) post here cross-origin. Public + rate-limited anyway.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(request: NextRequest) {
  const ip =
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const { success } = rateLimit(`ascend-lead:${ip}`, 6, 3600000)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests — please try again later.' }, { status: 429, headers: CORS })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: CORS })
  }

  const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const name = str(body.name, 120)
  const email = str(body.email, 200).toLowerCase()
  const stage = str(body.stage, 80)

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400, headers: CORS })
  }
  const emailProblem = await checkLeadEmail(email, 'the calculator')
  if (emailProblem) {
    return NextResponse.json({ error: emailProblem }, { status: 400, headers: CORS })
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
  <div style="padding:20px 24px;background:#10161C;color:#F2B441;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:18px;font-weight:800;">⛰️ New ASCEND lead</h1>
  </div>
  <div style="padding:22px 24px;background:#fff;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;">
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      ${row('Name', name)}
      ${row('Email', email)}
      ${row('Where they’re at', stage)}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#666;">Added to the “ASCEND Leads” audience in Resend. They’ve been sent the calculator. Reply straight to this email to reach them.</p>
  </div>
</div>`

  const alert = await sendEmail({
    to,
    subject: `ASCEND lead: ${name}${stage ? ` (${stage})` : ''}`,
    html: alertHtml,
    replyTo: email,
  })

  if (!alert.success) {
    return NextResponse.json(
      { error: 'Something went wrong — email john.leitch@playitloveit.com and we’ll send it over.' },
      { status: 502 }
    )
  }

  // Build the list + deliver the goods — both best-effort.
  await addToAscendAudience(email, name)

  const calcUrl = 'https://www.theplayerportal.net/ascend/calculator.html'
  const replyHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1d2530;">
  <div style="padding:24px;background:#10161C;border-radius:12px 12px 0 0;">
    <p style="margin:0;font-size:11px;letter-spacing:0.2em;color:#F2B441;font-weight:700;">ASCEND · BY JOHN LEITCH COACHING</p>
    <h1 style="margin:10px 0 0;font-size:20px;font-weight:800;color:#fff;">Your calculator, ${esc(name.split(' ')[0])} 👇</h1>
  </div>
  <div style="padding:24px;background:#fff;border:1px solid #e6e9ee;border-top:0;border-radius:0 0 12px 12px;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 16px;">Here&rsquo;s the <strong>Coaching Business Calculator</strong> — put your real numbers in and it shows you what your coaching should actually be paying you, and where the gap is:</p>
    <p style="margin:0 0 20px;"><a href="${calcUrl}" style="display:inline-block;background:#F2B441;color:#10161C;font-weight:800;padding:13px 26px;border-radius:999px;text-decoration:none;">Open the calculator →</a></p>
    <p style="margin:0 0 14px;">Two minutes with honest numbers. Most coaches find the gap is £1,000+ a month — not because they coach badly, but because nobody ever taught them the business side.</p>
    <p style="margin:0 0 14px;">That gap is exactly what ASCEND exists to close: I ran a grassroots academy, built it into a real business, and sold it. Now I mentor coaches doing the same climb.</p>
    <p style="margin:0;">Do one thing for me: <strong>run your numbers, then reply to this email with the gap it shows you.</strong> I read every reply and I&rsquo;ll tell you the first thing I&rsquo;d fix.</p>
    <p style="margin:18px 0 0;">— John Leitch</p>
  </div>
</div>`

  await sendEmail({
    to: email,
    subject: 'Your Coaching Business Calculator (+ one question)',
    html: replyHtml,
    fromName: 'John Leitch — ASCEND',
    replyTo: to,
  })

  return NextResponse.json({ ok: true }, { headers: CORS })
}
