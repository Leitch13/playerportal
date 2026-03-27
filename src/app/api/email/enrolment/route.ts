import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { enrolmentConfirmationEmail } from '@/lib/email-templates'

export async function POST(request: NextRequest) {
  try {
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
