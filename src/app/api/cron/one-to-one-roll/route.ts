import { NextRequest, NextResponse } from 'next/server'
import { adminClient, rollMonth } from '@/lib/one-to-one/db'
import { sendMonthNotices } from '@/lib/one-to-one/money'
import { nextMonthStart, todayLondon } from '@/lib/one-to-one/time'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// The 20th, 08:00. Roll every academy's regulars into next month and tell each
// parent what's booked and what comes off their card on the 1st. A notice,
// not a menu: nothing to reply to. Safe to run again (the roll is idempotent
// and a re-sent notice is just a repeat email).
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = adminClient()
  const month = request.nextUrl.searchParams.get('month') || nextMonthStart(todayLondon())
  const { data: orgs } = await admin.from('regular_slots').select('organisation_id').in('status', ['active', 'pending'])
  const orgIds = [...new Set((orgs ?? []).map((r) => r.organisation_id as string))]
  const rolled: Record<string, number> = {}
  for (const orgId of orgIds) {
    try { rolled[orgId] = (await rollMonth(admin, orgId, month)).created } catch (e) { rolled[orgId] = -1; console.error('roll failed', orgId, e) }
  }
  const notices = request.nextUrl.searchParams.get('notify') === '0' ? { sent: 0, skipped: 0 } : await sendMonthNotices(admin, month)
  return NextResponse.json({ month, academies: orgIds.length, rolled, notices })
}
