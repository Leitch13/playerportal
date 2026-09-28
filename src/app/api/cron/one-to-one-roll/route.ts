import { NextRequest, NextResponse } from 'next/server'
import { adminClient, rollMonth, type RollFailure } from '@/lib/one-to-one/db'
import { sendEmail } from '@/lib/email'
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
  const problems: string[] = []
  for (const orgId of orgIds) {
    try {
      const r = await rollMonth(admin, orgId, month)
      rolled[orgId] = r.created
      r.failed.forEach((f: RollFailure) => problems.push(`${orgId}: ${f.keeper} on ${f.date}: ${f.reason}`))
    } catch (e) {
      rolled[orgId] = -1
      problems.push(`${orgId}: the whole roll failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  // Never silent again: any date that couldn't be created is emailed the same morning.
  if (problems.length) {
    const { data: names } = await admin.from('organisations').select('id, name').in('id', orgIds)
    const nameOf = (id: string) => (names ?? []).find((n) => n.id === id)?.name ?? id
    const lines = problems.map((p) => { const [id, ...rest] = p.split(': '); return `${nameOf(id)}: ${rest.join(': ')}` })
    await sendEmail({
      to: process.env.CANARY_ALERT_EMAIL || 'john@theplayerportal.net',
      subject: `1-2-1 month roll: ${lines.length} date${lines.length === 1 ? '' : 's'} not created for ${month.slice(0, 7)}`,
      html: `<p>The 1-2-1 roll for ${month.slice(0, 7)} ran, but these dates could not be created. Everything else was.</p><ul>${lines.map((l) => `<li>${l.replace(/</g, '&lt;')}</li>`).join('')}</ul>`,
    })
  }
  const notices = request.nextUrl.searchParams.get('notify') === '0' ? { sent: 0, skipped: 0 } : await sendMonthNotices(admin, month)
  return NextResponse.json({ month, academies: orgIds.length, rolled, problems, notices })
}
