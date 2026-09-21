import { NextRequest, NextResponse } from 'next/server'
import { adminClient, rollMonth } from '@/lib/one-to-one/db'
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
  const admin = adminClient()
  // Belt and braces: make sure the month being charged has been rolled for every academy with
  // regulars, so a slot the 20th job never saw is charged for the sessions it really has.
  // Idempotent: existing sessions (declined, cancelled, attended) are left exactly as they are.
  const { data: orgs } = await admin.from('regular_slots').select('organisation_id').in('status', ['active', 'pending'])
  for (const orgId of new Set((orgs ?? []).map((r) => r.organisation_id as string))) {
    try { await rollMonth(admin, orgId, month) } catch (e) { console.error('pre-charge roll failed', orgId, e) }
  }
  const result = await runMonthlyCharges(admin, month, today)
  return NextResponse.json({ month, today, ...result })
}
