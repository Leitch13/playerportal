import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { enrolmentConfirmationEmail } from '@/lib/email-templates'
// Sprint 13 (M1) — mirror the existing rate-limit pattern used by
// /api/email/trial-confirmation. Same library, same window, same key
// shape; only the prefix string differs so the two routes don't share
// counters.
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Sprint 13 M1 — 5 per IP per hour, mirrors trial-confirmation.
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const { success } = rateLimit(`enrolment-email:${ip}`, 5, 3600000)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { parentName, parentEmail, childName, className, dayTime, academyName } = await request.json()

    if (!parentEmail || !childName || !className) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
    const template = enrolmentConfirmationEmail({
      parentName: parentName || 'there',
      childName,
      className,
      dayTime: dayTime || 'See schedule',
      academyName: academyName || 'Your Academy',
      dashboardUrl: `${appUrl}/dashboard/schedule`,
    })

    const result = await sendEmail({ to: parentEmail, ...template })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
