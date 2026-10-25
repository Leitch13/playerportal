import { redirect } from 'next/navigation'
import { adminClient } from '@/lib/one-to-one/db'
import { openSetupCheckout } from '@/lib/one-to-one/money'
import { CheckoutBlocked } from '@/lib/one-to-one/checkout'
import PayMessage from '../message'

export const dynamic = 'force-dynamic'

/**
 * The 1-2-1 set-up link a parent is emailed. It never runs out: each time it's opened it works
 * out what's due today and opens a fresh Stripe page (via the cancellation-policy step).
 * No.1, 25 Oct 2026: the old 24-hour Stripe links left families with "expired" and nothing to pay with.
 * No login: the slot id is the bearer link, as with /pay/camp/<booking id> and /pay/<invoice id>.
 */
export default async function SetupLinkPage({ params }: { params: Promise<{ slotId: string }> }) {
  const { slotId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(slotId)) return <PayMessage title="This link isn't right" text="Please use the button in your email, or ask the academy for a new link." />
  const admin = adminClient()
  const { data: slot } = await admin.from('regular_slots').select('id, status, organisation_id, player:players(first_name)').eq('id', slotId).maybeSingle()
  if (!slot) return <PayMessage title="This link isn't right" text="Please use the button in your email, or ask the academy for a new link." />
  const { data: org } = await admin.from('organisations').select('name').eq('id', slot.organisation_id).single()
  const academy = (org?.name as string) || 'the academy'
  const child = (slot.player as unknown as { first_name?: string } | null)?.first_name || 'Your child'
  if (slot.status === 'active' || slot.status === 'paused') return <PayMessage academy={academy} title="You're all set" text={`${child}'s sessions are already set up. Nothing to pay here: you'll be charged on the 1st for each month's sessions.`} />
  if (slot.status !== 'pending') return <PayMessage academy={academy} title="This slot has ended" text={`Please contact ${academy} if you'd like to book again.`} />
  let url: string
  try {
    url = (await openSetupCheckout(admin, slot.organisation_id as string, slotId)).url
  } catch (e) {
    const msg = e instanceof CheckoutBlocked ? e.message : 'Something went wrong opening the payment page.'
    return <PayMessage academy={academy} title="We couldn't open the payment page" text={`${msg} Please try again, or contact ${academy}.`} />
  }
  redirect(url)
}
