import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { checkLeadEmail } from '@/lib/lead-email-checks'
import { addToAscendAudience } from '@/lib/ascend-audience'

/**
 * ASCEND mentorship lead capture (/ascend live calculator, content guide, Offers Bank).
 *
 * Sources: 'calculator' (default, carries the visitor's live numbers),
 * 'content-guide' (mentorship site), 'offers-bank' (Meta instant form via Zapier).
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
  const rawSource = str(body.source, 40)
  const source: 'calculator' | 'content-guide' | 'offers-bank' =
    rawSource === 'content-guide' || rawSource === 'offers-bank' ? rawSource : 'calculator'

  // The live calculator sends the visitor's verdict so John replies to a real
  // figure. Whitelisted keys, short strings, nothing else gets through.
  const NUMBER_KEYS = ['hourly', 'band', 'price', 'players', 'sessions', 'profit', 'margin', 'recPrice', 'gapMonth'] as const
  const rawNumbers = body.numbers && typeof body.numbers === 'object' ? (body.numbers as Record<string, unknown>) : null
  const numbers: Partial<Record<(typeof NUMBER_KEYS)[number], string>> = {}
  if (rawNumbers) {
    for (const k of NUMBER_KEYS) {
      const v = str(rawNumbers[k], 40)
      if (v) numbers[k] = v
    }
  }
  const hasNumbers = Object.keys(numbers).length > 0

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

  const DELIVERABLE = { calculator: 'calculator guide', 'content-guide': 'content guide', 'offers-bank': 'Offers Bank PDF' } as const

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
      ${row('Source', source)}
    </table>
    ${hasNumbers ? `
    <p style="margin:18px 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#888;">Their calculator numbers</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      ${row('Real hourly rate', numbers.hourly ? `£${numbers.hourly}/hr${numbers.band ? ` — ${numbers.band}` : ''}` : '')}
      ${row('Charging now', numbers.price ? `£${numbers.price} per player · ${numbers.players || '?'} players · ${numbers.sessions || '?'} sessions/wk` : '')}
      ${row('Profit / session', numbers.profit ? `£${numbers.profit} (${numbers.margin || '?'}% margin)` : '')}
      ${row('Should charge', numbers.recPrice ? `£${numbers.recPrice}` : '')}
      ${row('Monthly gap', numbers.gapMonth ? `£${numbers.gapMonth} a month` : '')}
    </table>` : ''}
    <p style="margin:20px 0 0;font-size:13px;color:#666;">Added to the “ASCEND Leads” audience in Resend. They’ve been sent the ${DELIVERABLE[source]}. Reply straight to this email to reach them.</p>
  </div>
</div>`

  const alert = await sendEmail({
    to,
    subject: `ASCEND lead: ${name}${numbers.gapMonth ? ` — £${numbers.gapMonth}/mo gap` : ''}${stage ? ` (${stage})` : ''}`,
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

  const calcUrl = 'https://www.theplayerportal.net/ascend#calculator'
  const pricingGuideUrl = 'https://www.theplayerportal.net/ascend/pricing-calculator-guide.pdf'
  const guideUrl = 'https://www.theplayerportal.net/ascend/what-specific-content-to-post.pdf'
  const offersUrl = 'https://www.theplayerportal.net/ascend/offers-bank.pdf'
  const mentorshipUrl = 'https://ascend-mentorship-site.vercel.app'
  const first = esc(name.split(' ')[0])

  const numbersBlock = hasNumbers ? `
    <div style="margin:0 0 18px;padding:14px 16px;background:#F6F7F9;border:1px solid #E6E9EE;border-radius:10px;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7E8C99;font-weight:700;">Your numbers</p>
      ${numbers.hourly ? `<p style="margin:0;">Real hourly rate: <strong>£${esc(numbers.hourly)}/hr</strong>${numbers.band ? ` — ${esc(numbers.band)}` : ''}</p>` : ''}
      ${numbers.recPrice ? `<p style="margin:4px 0 0;">Charging £${esc(numbers.price || '?')} — should be <strong>£${esc(numbers.recPrice)}</strong> for a 40% margin</p>` : ''}
      ${numbers.gapMonth ? `<p style="margin:4px 0 0;">The gap: <strong>£${esc(numbers.gapMonth)} a month</strong></p>` : ''}
    </div>` : ''

  const calculatorReplyHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1d2530;">
  <div style="padding:24px;background:#10161C;border-radius:12px 12px 0 0;">
    <p style="margin:0;font-size:11px;letter-spacing:0.2em;color:#F2B441;font-weight:700;">ASCEND · BY JOHN LEITCH COACHING</p>
    <h1 style="margin:10px 0 0;font-size:20px;font-weight:800;color:#fff;">Your guide, ${first} 👇</h1>
  </div>
  <div style="padding:24px;background:#fff;border:1px solid #e6e9ee;border-top:0;border-radius:0 0 12px 12px;font-size:15px;line-height:1.6;">
    ${numbersBlock}
    <p style="margin:0 0 16px;">Here&rsquo;s the <strong>Pricing Calculator guide</strong> — the model behind the calculator, with a full worked example, so you can set a price and defend it to any parent:</p>
    <p style="margin:0 0 20px;"><a href="${pricingGuideUrl}" style="display:inline-block;background:#F2B441;color:#10161C;font-weight:800;padding:13px 26px;border-radius:999px;text-decoration:none;">Open the guide →</a></p>
    <p style="margin:0 0 14px;">Want to run it again with different numbers? The <a href="${calcUrl}" style="color:#0B6E7C;">calculator</a> is always open, no email needed.</p>
    <p style="margin:0 0 14px;">Most coaches find the gap is &pound;1,000+ a month — not because they coach badly, but because nobody ever taught them the business side. I ran a grassroots academy to 350 players a week, built it into a real business, and sold it. Now I mentor academy owners doing the same climb — that&rsquo;s <a href="${mentorshipUrl}" style="color:#0B6E7C;">ASCEND</a>.</p>
    <p style="margin:0;">Do one thing for me: <strong>reply to this email with one line about your academy and the number above.</strong> I read every reply and I&rsquo;ll tell you the first thing I&rsquo;d fix.</p>
    <p style="margin:18px 0 0;">— John Leitch</p>
  </div>
</div>`

  const guideReplyHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1d2530;">
  <div style="padding:24px;background:#10161C;border-radius:12px 12px 0 0;">
    <p style="margin:0;font-size:11px;letter-spacing:0.2em;color:#F2B441;font-weight:700;">ASCEND · BY JOHN LEITCH COACHING</p>
    <h1 style="margin:10px 0 0;font-size:20px;font-weight:800;color:#fff;">Your guide, ${first} 👇</h1>
  </div>
  <div style="padding:24px;background:#fff;border:1px solid #e6e9ee;border-top:0;border-radius:0 0 12px 12px;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 16px;">Here&rsquo;s <strong>What Specific Content To Post</strong> — the exact fifteen-slot weekly plan I ran at my own academy, with the templates for every carousel, reel and story slot:</p>
    <p style="margin:0 0 20px;"><a href="${guideUrl}" style="display:inline-block;background:#F2B441;color:#10161C;font-weight:800;padding:13px 26px;border-radius:999px;text-decoration:none;">Download the guide →</a></p>
    <p style="margin:0 0 14px;">Marketing is one of the six stages every academy owner has to get right — most either post nothing consistent, or post the wrong things to the wrong people. This fixes both.</p>
    <p style="margin:0 0 14px;">I built this from what actually filled sessions at my own academy — 350 players a week across six venues, before I sold it.</p>
    <p style="margin:0;">Do one thing for me: <strong>pick one slot from the guide and post it this week, then reply and tell me how it landed.</strong> I read every reply.</p>
    <p style="margin:18px 0 0;">— John Leitch</p>
  </div>
</div>`

  const offersReplyHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1d2530;">
  <div style="padding:24px;background:#10161C;border-radius:12px 12px 0 0;">
    <p style="margin:0;font-size:11px;letter-spacing:0.2em;color:#F2B441;font-weight:700;">ASCEND · BY JOHN LEITCH COACHING</p>
    <h1 style="margin:10px 0 0;font-size:20px;font-weight:800;color:#fff;">The Offers Bank, ${first} 👇</h1>
  </div>
  <div style="padding:24px;background:#fff;border:1px solid #e6e9ee;border-top:0;border-radius:0 0 12px 12px;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 16px;">Here are the <strong>nine offers</strong> I ran building a football academy to 350 players a week — what each one is, what happened when I ran it, and the mistake that kills it:</p>
    <p style="margin:0 0 20px;"><a href="${offersUrl}" style="display:inline-block;background:#F2B441;color:#10161C;font-weight:800;padding:13px 26px;border-radius:999px;text-decoration:none;">Open the Offers Bank →</a></p>
    <p style="margin:0 0 14px;">Before you pick one: do you actually know what an hour of your coaching pays you right now? Most coaches don&rsquo;t, and the best offer in the world can&rsquo;t fix a price that&rsquo;s wrong. <a href="${calcUrl}" style="color:#0B6E7C;">The free calculator</a> tells you in two minutes — no email needed.</p>
    <p style="margin:0;">Do one thing for me: <strong>reply and tell me which offer you&rsquo;re going to run and what&rsquo;s stopping you.</strong> I read every reply and I&rsquo;ll tell you the first thing I&rsquo;d fix.</p>
    <p style="margin:18px 0 0;">— John Leitch</p>
  </div>
</div>`

  const REPLY = {
    calculator: { subject: 'Your Pricing Calculator guide (+ one question)', html: calculatorReplyHtml },
    'content-guide': { subject: 'Your Content Guide (+ one thing to try)', html: guideReplyHtml },
    'offers-bank': { subject: 'The 9 offers that built my academy (+ one question)', html: offersReplyHtml },
  } as const

  await sendEmail({
    to: email,
    subject: REPLY[source].subject,
    html: REPLY[source].html,
    fromName: 'John Leitch — ASCEND',
    replyTo: to,
  })

  return NextResponse.json({ ok: true }, { headers: CORS })
}
