import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/one-to-one/db'

export const dynamic = 'force-dynamic'

// Hourly. Anything still held after its 12 minutes is gone, and the time is
// free again. Paid rows are never touched (the function only deletes 'held').
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = adminClient()
  const { data, error } = await admin.rpc('release_expired_session_holds')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ released: data ?? 0 })
}
