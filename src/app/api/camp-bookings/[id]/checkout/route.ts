import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkCampLink, openCampCheckout } from '@/lib/camp-payment-link'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/camp-bookings/[id]/checkout — the parent taps "Pay" on /pay/camp/[id].
// No login: the booking id is an unguessable bearer capability, the same model as
// /pay/[id] for invoices. It can only open a payment for this one booking.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'This payment link is invalid.' }, { status: 404 })
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const c = await checkCampLink(svc, id)
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status })
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
    return NextResponse.json({ url: await openCampCheckout(svc, c, origin) })
  } catch (e) {
    console.error('[camp-bookings/checkout] failed', id, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Payment could not be started. Please try again in a minute.' }, { status: 502 })
  }
}
