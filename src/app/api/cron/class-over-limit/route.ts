import { NextRequest, NextResponse } from 'next/server'
import { alertOverLimitDays, placesDb } from '@/lib/class-places'
import { sendEmail } from '@/lib/email'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

/**
 * Hourly: tell the academy about any class day in the next two weeks where members +
 * trials are over the limit (a class that filled after trials were booked). Each class,
 * day and head-count is told once. John, 19 Oct 2026 (CFC INTRO, 7 for 6 places).
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const alerted = await alertOverLimitDays(placesDb(), today, sendEmail)
  return NextResponse.json({ alerted })
}
