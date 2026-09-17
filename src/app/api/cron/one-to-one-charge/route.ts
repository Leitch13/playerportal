import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/one-to-one/db'
import { runMonthlyCharges } from '@/lib/one-to-one/money'
import { monthStart, todayLondon } from '@/lib/one-to-one/time'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// 06:00 on the 1st, 4th and 8th. One off-session charge per parent for the
// month's sessions minus credit. Already-paid months are skipped, failed ones
// are retried only on their retry date. Never creates a subscription.
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const today = todayLondon()
  const month = request.nextUrl.searchParams.get('month') || monthStart(today)
  const result = await runMonthlyCharges(adminClient(), month, today)
  return NextResponse.json({ month, today, ...result })
}
