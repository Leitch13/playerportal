import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { trialConfirmationEmail } from '@/lib/email-templates'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { success } = rateLimit(`trial-email:${ip}`, 5, 3600000) // 5 per hour
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { parentName, parentEmail, childName, academyName, className, date } = await request.json()

  if (!parentEmail || !parentName || !childName || !academyName) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const template = trialConfirmationEmail({ parentName, childName, academyName, className, date })
  const result = await sendEmail({ to: parentEmail, ...template })
  return NextResponse.json(result)
}
