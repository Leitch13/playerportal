import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { startMembershipPayment } from '@/lib/membership-pay-link'

export const dynamic = 'force-dynamic'

// POST /api/memberships/[id]/pay — the parent taps "Pay" on /pay/membership/[id]. No login: the
// membership id is an unguessable bearer capability, the same model as /pay/camp/[id]. It can only
// open Stripe's page for this membership's bill that is still open.
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'This payment link is invalid.' }, { status: 404 })
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  try {
    const r = await startMembershipPayment(svc, id)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ url: r.url })
  } catch (e) {
    console.error('[memberships/pay] failed', id, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Payment could not be started. Please try again in a minute.' }, { status: 502 })
  }
}
