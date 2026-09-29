import { NextRequest, NextResponse } from 'next/server'
import { acceptPolicy } from '@/lib/one-to-one/agree'

export const dynamic = 'force-dynamic'

// POST { checkoutId, policyAccepted: true } → { url } of the Stripe payment page for a regular's set-up link.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { checkoutId?: unknown; policyAccepted?: unknown }
  if (body.policyAccepted !== true) return NextResponse.json({ error: 'Tick to accept the cancellation policy first' }, { status: 400 })
  try {
    const link = await acceptPolicy(typeof body.checkoutId === 'string' ? body.checkoutId : '')
    if (link.state === 'open') return NextResponse.json({ url: link.url })
    const error = link.state === 'paid' ? 'This link has already been paid. You\'re all set.'
      : link.state === 'expired' ? 'This link has expired. Ask the academy to send a fresh one.'
      : 'This link isn\'t right. Ask the academy to send it again.'
    return NextResponse.json({ error }, { status: 409 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Something went wrong' }, { status: 500 })
  }
}
