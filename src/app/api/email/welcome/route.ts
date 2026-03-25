import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { welcomeEmail } from '@/lib/email-templates'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { success } = rateLimit(`welcome-email:${ip}`, 5, 3600000) // 5 per hour
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { parentName, parentEmail, academyName } = await request.json()

  if (!parentEmail || !parentName) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const template = welcomeEmail({
    parentName,
    academyName: academyName || 'Player Portal',
    dashboardUrl: `${appUrl}/dashboard`,
  })

  const result = await sendEmail({ to: parentEmail, ...template })
  return NextResponse.json(result)
}
