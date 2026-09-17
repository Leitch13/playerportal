import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/one-to-one/db'
import { declineByParent, payNowUrl } from '@/lib/one-to-one/money'
import { CheckoutBlocked } from '@/lib/one-to-one/checkout'

export const dynamic = 'force-dynamic'

/**
 * 1-2-1 Slots · what a parent can do from their own page.
 *
 *   decline  → give up one dated session, policy applied, slot untouched
 *   paynow   → a normal payment page for a month the saved card couldn't pay
 *
 * A parent cannot release their slot, move a session, or change anything
 * about the timetable. That is the academy's.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const admin = adminClient()
  try {
    switch (body.action) {
      case 'decline': {
        const r = await declineByParent(admin, String(body.sessionId || ''), user.id)
        return NextResponse.json({ ok: true, ...r })
      }
      case 'paynow': {
        const { data: charge } = await admin.from('coaching_charges').select('id, organisation_id, parent_id').eq('id', String(body.chargeId || '')).maybeSingle()
        if (!charge || charge.parent_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        const url = await payNowUrl(admin, charge.organisation_id, charge.id)
        return NextResponse.json({ ok: true, url })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    if (e instanceof CheckoutBlocked) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('one-to-one parent:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
