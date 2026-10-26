import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { alertAcademiesNotPaying } from '@/lib/not-paying-alert'
import { sendEmail } from '@/lib/email'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * Every morning: each academy with a child on a register who isn't paying is told, with names and
 * amounts, only when someone new is on its list. John's rule, 26 Oct 2026. See src/lib/not-paying-alert.ts.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const sent = await alertAcademiesNotPaying(db, today, sendEmail)
  return NextResponse.json({ sent })
}
