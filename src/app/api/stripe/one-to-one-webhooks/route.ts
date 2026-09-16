import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { shouldProcessEvent, markEventSuccess, markEventError } from '@/lib/stripe-events'
import { adminClient, getCoaches, getVenues } from '@/lib/one-to-one/db'
import { ONE_TO_ONE_MODULE } from '@/lib/one-to-one/checkout'
import { sendAdhocReceipt } from '@/lib/one-to-one/emails'

export const dynamic = 'force-dynamic'

/**
 * 1-2-1 Slots · its own Stripe webhook endpoint, its own signing secret.
 *
 * The class-billing handler never sees these events and this handler never
 * sees class events: Stripe only sends each endpoint what it subscribed to,
 * and every event is also checked for pp_module = 'one_to_one' before it
 * touches a row. Idempotent through the shared stripe_events ledger under
 * the handler name 'one_to_one'.
 */

const HANDLER = 'one_to_one'

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_ONE_TO_ONE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  const sig = req.headers.get('stripe-signature') || ''
  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 })
  }

  const admin = adminClient()
  // Stripe delivers the same event to BOTH endpoints (the class endpoint also
  // subscribes to checkout.session.completed and charge.refunded). The ledger is
  // keyed by event id, so this handler keys its rows as "<event>:one_to_one" —
  // otherwise whichever endpoint logged first would make the other skip.
  const ledgerId = `${event.id}:${HANDLER}`
  const decision = await shouldProcessEvent(admin, { id: ledgerId, type: event.type, livemode: event.livemode }, HANDLER)
  if (!decision.proceed) return NextResponse.json({ received: true, skipped: decision.reason }, { status: decision.retryStripe ? 500 : 200 })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const cs = event.data.object as Stripe.Checkout.Session
        if (cs.metadata?.pp_module !== ONE_TO_ONE_MODULE) break
        const sessionId = cs.metadata.coaching_session_id
        const { data: s } = await admin.from('coaching_sessions').select('*').eq('id', sessionId).maybeSingle()
        if (!s) break
        if (s.status === 'scheduled' && s.charge_state === 'paid_online') break // already done
        const paymentIntent = typeof cs.payment_intent === 'string' ? cs.payment_intent : cs.payment_intent?.id
        // Paid: the hold becomes a real session. If the hold had expired and the
        // time was re-sold in between, the unique index would have stopped the
        // resale while this row was 'held' — so this is safe to confirm.
        const { error } = await admin.from('coaching_sessions').update({
          status: 'scheduled', charge_state: 'paid_online', hold_token: null, hold_expires_at: null,
          stripe_payment_intent_id: paymentIntent || null, stripe_checkout_session_id: cs.id,
          guest_email: s.guest_email || cs.customer_details?.email || null,
        }).eq('id', s.id)
        if (error) throw error
        // Remember the card for a future regular (phase 4). Stored on the session row's
        // customer only via Stripe; nothing charged.
        const [coaches, venues, org] = await Promise.all([
          getCoaches(admin, s.organisation_id), getVenues(admin, s.organisation_id),
          admin.from('organisations').select('name').eq('id', s.organisation_id).single(),
        ])
        const venue = venues.find((v) => v.id === s.venue_id)
        const to = s.guest_email || cs.customer_details?.email
        if (to) {
          await sendAdhocReceipt({
            academy: (org.data?.name as string) || 'Your academy', to, parentName: s.guest_name, childName: s.guest_child_name || 'Your child',
            date: s.session_date, startMinutes: s.start_minutes, durationMinutes: s.duration_minutes,
            coach: coaches.find((c) => c.id === s.coach_id)?.full_name?.split(' ')[0] || 'your coach',
            venue: venue?.name || 'the venue', venueAddress: venue?.address, pricePence: s.price_pence,
          }).catch((e) => console.error('one-to-one receipt failed', e))
        }
        break
      }

      case 'checkout.session.expired': {
        const cs = event.data.object as Stripe.Checkout.Session
        if (cs.metadata?.pp_module !== ONE_TO_ONE_MODULE) break
        // Only ever removes a row that is still a hold. A paid row is untouched.
        await admin.from('coaching_sessions').delete().eq('id', cs.metadata.coaching_session_id).eq('status', 'held')
        break
      }

      case 'charge.refunded': {
        const ch = event.data.object as Stripe.Charge
        if (ch.metadata?.pp_module !== ONE_TO_ONE_MODULE) break
        const sessionId = ch.metadata.coaching_session_id
        if (!sessionId) break
        // A full refund cancels the session and frees the time. A partial one is a note.
        if (ch.amount_refunded >= ch.amount) {
          await admin.from('coaching_sessions').update({ status: 'cancelled', charge_state: 'waived', note: 'refunded' }).eq('id', sessionId)
        } else {
          await admin.from('coaching_sessions').update({ note: `partly refunded £${(ch.amount_refunded / 100).toFixed(2)}` }).eq('id', sessionId)
        }
        break
      }

      default:
        break
    }
    await markEventSuccess(admin, ledgerId)
    return NextResponse.json({ received: true })
  } catch (err) {
    await markEventError(admin, ledgerId, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
