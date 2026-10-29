import { redirect } from 'next/navigation'
import { adminClient } from '@/lib/one-to-one/db'
import { payNowUrl } from '@/lib/one-to-one/money'
import { CheckoutBlocked } from '@/lib/one-to-one/checkout'
import PayMessage from '../../message'

export const dynamic = 'force-dynamic'

/**
 * "Pay now" for a 1-2-1 month that didn't go through on the card. Emailed link that never runs out:
 * each time it's opened it makes a fresh Stripe page (and closes the previous one, so nobody pays twice).
 */
export default async function PayNowLinkPage({ params, searchParams }: { params: Promise<{ chargeId: string }>; searchParams: Promise<{ paid?: string; cancelled?: string }> }) {
  const { chargeId } = await params
  const sp = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(chargeId)) return <PayMessage title="This link isn't right" text="Please use the button in your email, or ask the academy for a new link." />
  const admin = adminClient()
  const { data: charge } = await admin.from('coaching_charges').select('id, status, organisation_id, amount_pence').eq('id', chargeId).maybeSingle()
  if (!charge) return <PayMessage title="This link isn't right" text="Please use the button in your email, or ask the academy for a new link." />
  const { data: org } = await admin.from('organisations').select('name').eq('id', charge.organisation_id).single()
  const academy = (org?.name as string) || 'the academy'
  if (['paid_online', 'paid_cash', 'waived'].includes(charge.status as string)) return <PayMessage academy={academy} title="Already paid" text="This month is paid. Thank you." />
  if (charge.status === 'refunded') return <PayMessage academy={academy} title="Nothing to pay" text={`This month was refunded. Please contact ${academy} with any questions.`} />
  // Back from Stripe: never open another payment page here (the webhook may not have marked it paid yet).
  if (sp.paid) return <PayMessage academy={academy} title="Thank you, that's paid" text="We've emailed you a receipt. Your card is saved, so next month comes off automatically on the 1st." />
  if (sp.cancelled) return <PayMessage academy={academy} title="Not paid yet" text="No money was taken. Open the link in your email again whenever you're ready." />
  let url: string
  try {
    url = await payNowUrl(admin, charge.organisation_id as string, chargeId)
  } catch (e) {
    const msg = e instanceof CheckoutBlocked ? e.message : 'Something went wrong opening the payment page.'
    return <PayMessage academy={academy} title="We couldn't open the payment page" text={`${msg} Please try again, or contact ${academy}.`} />
  }
  redirect(url)
}
