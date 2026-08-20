import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { checkLeadEmail } from '@/lib/lead-email-checks'
import { addToAscendAudience } from '@/lib/ascend-audience'

/**
 * ASCEND mentorship APPLICATION capture.
 *
 * Posted to by the Wix-embedded mentorship sales page (previously pointed
 * at Formspree — applications bypassed John's systems entirely). Served
 * cross-origin from Wix, hence the permissive CORS headers: it's a public,
 * rate-limited, email-only endpoint just like /api/ascend/lead.
 *
 * An application is the hottest ASCEND lead there is — it also goes into
 * the "ASCEND Leads" audience so applicants get future broadcasts.
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
  const { success } = rateLimit(`ascend-apply:${ip}`, 5, 3600000)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: CORS })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: CORS })
  }

  const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const name = str(body.name, 120)
  const email = str(body.email, 200).toLowerCase()
  const whatsapp = str(body.whatsapp, 60)
  const academy = str(body.academy, 200)
  const players = str(body.players_per_week, 80)
  const problem = str(body.biggest_problem)
  const why = str(body.why_now)

  if (!name || !email || !whatsapp) {
    return NextResponse.json({ error: 'Name, email and WhatsApp number are required.' }, { status: 400, headers: CORS })
  }
  const emailProblem = await checkLeadEmail(email, 'John’s reply')
  if (emailProblem) {
    return NextResponse.json({ error: emailProblem }, { status: 400, headers: CORS })
  }

  const to =
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    'john.leitch@playitloveit.com'

  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c))
  const row = (label: string, value: string) =>
    value ? `<tr><td style="padding:6px 0;color:#888;width:170px;vertical-align:top;">${label}</td><td style="color:#111;">${esc(value)}</td></tr>` : ''

  const alertHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="padding:20px 24px;background:#10161C;color:#F2B441;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:18px;font-weight:800;">🔥 ASCEND APPLICATION — ${esc(name)}</h1>
  </div>
  <div style="padding:22px 24px;background:#fff;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;">
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      ${row('Name', name)}
      ${row('Email', email)}
      ${row('WhatsApp', whatsapp)}
      ${row('Academy / base', academy)}
      ${row('Players per week', players)}
      ${row('Biggest problem', problem)}
      ${row('Why now', why)}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#666;">They’ve been told: “if it’s a fit you’ll hear from me on WhatsApp within a day or two.” Reply here or WhatsApp them.</p>
  </div>
</div>`

  const alert = await sendEmail({
    to,
    subject: `ASCEND APPLICATION: ${name}${academy ? ` — ${academy}` : ''}`,
    html: alertHtml,
    replyTo: email,
  })

  if (!alert.success) {
    return NextResponse.json(
      { error: 'Something glitched — WhatsApp John instead on 07595 426746.' },
      { status: 502, headers: CORS }
    )
  }

  await addToAscendAudience(email, name)

  return NextResponse.json({ ok: true }, { headers: CORS })
}
