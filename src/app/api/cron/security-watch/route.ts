import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
import { sendEmail } from '@/lib/email'
import { SNAPSHOT_ACTION, busyRefusers, diffSnapshots, takeSnapshot, type Snapshot } from '@/lib/security-watch'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const JOHN = 'johnleitch970@gmail.com'

function cronAllowed(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || ''
  const given = request.headers.get('authorization') || ''
  const want = `Bearer ${secret}`
  return secret.length > 0 && given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want))
}

/** Daily security watch. See src/lib/security-watch.ts. */
export async function GET(request: NextRequest) {
  if (!cronAllowed(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: last } = await db
    .from('audit_log')
    .select('details, created_at')
    .eq('action', SNAPSHOT_ACTION)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const before = ((last?.details as { snapshot?: Snapshot } | null)?.snapshot) ?? null

  const { snap, names } = await takeSnapshot(db)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const lines = [...diffSnapshots(before, snap, names), ...(await busyRefusers(db, since))]

  await db.from('audit_log').insert({ organisation_id: null, action: SNAPSHOT_ACTION, details: { snapshot: snap, changes: lines } })

  if (lines.length > 0) {
    const esc = (s: string) => s.replace(/[&<>"']/g, '')
    await sendEmail({
      to: JOHN,
      subject: `Security watch: ${lines.length} change${lines.length === 1 ? '' : 's'} to check`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:600px">
        <h2 style="margin:0 0 8px">Security watch</h2>
        <p style="color:#555">These changed since yesterday's check. Most will be normal (an academy connecting Stripe, a new owner). If you don't recognise one, tell Claude straight away.</p>
        <ul>${lines.map((l) => `<li style="margin:6px 0">${esc(l)}</li>`).join('')}</ul>
      </div>`,
    })
  }
  return NextResponse.json({ changes: lines.length, firstRun: !before })
}
