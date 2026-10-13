import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emailPack, loadAllPacks } from '@/lib/welcome-pack-server'

/**
 * Every morning: email each welcome pack to families who have joined one of its
 * classes since the pack was added and have not had it yet. See src/lib/welcome-pack.ts.
 *
 * Families already in the class when a pack is added are emailed at that moment, not here,
 * so the first run of this job cannot send a backlog. One pack failing does not stop the rest.
 */
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const dryRun = request.nextUrl.searchParams.get('dry') === '1'
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const packs = await loadAllPacks(service)
  let sent = 0, asked = 0
  for (const pack of packs) {
    const r = await emailPack(service, pack, { mode: 'new_joiners', dryRun, limit: 200 })
    sent += r.sent; asked += r.asked
  }
  return NextResponse.json({ ok: true, packs: packs.length, asked, sent, dryRun })
}
