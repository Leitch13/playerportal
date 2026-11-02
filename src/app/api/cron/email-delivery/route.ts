import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanDeliveries } from '@/lib/email-not-reaching'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

// Hourly: which families' emails didn't arrive (bounced, blocked, spam), so the academy sees them in
// red and uses WhatsApp instead. See src/lib/email-not-reaching.ts.
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ skipped: 'no RESEND_API_KEY' })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  return NextResponse.json(await scanDeliveries(db, process.env.RESEND_API_KEY))
}
