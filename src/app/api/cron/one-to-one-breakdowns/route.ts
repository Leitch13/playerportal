import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { breakdownsDue, sendFamilyMonth } from '@/lib/one-to-one/family-month-send'
import { todayLondon } from '@/lib/one-to-one/time'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * Every evening: a family whose 1-2-1 month was changed by the academy today and
 * hasn't been sent its updated breakdown gets one email for that month. The academy
 * can send it straight away from Regulars → More; this makes sure nobody is missed.
 * John, 18 Oct 2026. Same for every academy. Past months are never re-sent.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const thisMonth = todayLondon().slice(0, 7) + '-01'
  const due = (await breakdownsDue(admin)).filter((d) => d.month >= thisMonth)
  let sent = 0
  const skipped: string[] = []
  for (const d of due) {
    try {
      const r = await sendFamilyMonth(admin, d.orgId, d.parentId, d.month, null)
      if (r.sentTo) sent++; else skipped.push(r.reason || 'not sent')
    } catch (e) { skipped.push(e instanceof Error ? e.message : 'failed') }
  }
  return NextResponse.json({ due: due.length, sent, skipped })
}
