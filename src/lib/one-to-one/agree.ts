// 1-2-1 Slots · the cancellation-policy step in front of a regular's set-up link.
// The emailed link opens our agree page; the parent ticks the policy; we stamp the
// time on the Stripe Checkout (the record) and send them on to pay. Stripe is only read
// and its metadata written here: no charge is created, changed or taken.

import { stripe } from '@/lib/stripe'
import { ONE_TO_ONE_MODULE } from './checkout'

export type SetupLinkState =
  | { state: 'open'; url: string; organisationId: string; acceptedAt: string | null }
  | { state: 'paid' | 'expired' | 'invalid'; organisationId: string | null }

export async function setupLinkState(checkoutId: string): Promise<SetupLinkState> {
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(checkoutId)) return { state: 'invalid', organisationId: null }
  const cs = await stripe.checkout.sessions.retrieve(checkoutId).catch(() => null)
  if (!cs || cs.metadata?.pp_module !== ONE_TO_ONE_MODULE || cs.metadata?.kind !== 'setup') return { state: 'invalid', organisationId: null }
  const organisationId = cs.metadata?.organisation_id || null
  if (cs.status === 'complete') return { state: 'paid', organisationId }
  if (cs.status !== 'open' || !cs.url || !organisationId) return { state: 'expired', organisationId }
  return { state: 'open', url: cs.url, organisationId, acceptedAt: cs.metadata?.policy_accepted_at || null }
}

/** Record the tick on the Checkout and hand back where to pay. */
export async function acceptPolicy(checkoutId: string): Promise<SetupLinkState> {
  const link = await setupLinkState(checkoutId)
  if (link.state !== 'open') return link
  const at = new Date().toISOString()
  await stripe.checkout.sessions.update(checkoutId, { metadata: { policy_accepted_at: at } })
  return { ...link, acceptedAt: at }
}
