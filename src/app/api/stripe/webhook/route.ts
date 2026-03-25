import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (webhookSecret && signature) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } else {
    event = JSON.parse(body)
  }

  const supabase = createAdminClient()

  // ─── ONE-TIME PAYMENT COMPLETED ───
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const paymentId = session.metadata?.payment_id

    if (paymentId) {
      const { data: payment } = await supabase
        .from('payments')
        .select('amount, amount_paid')
        .eq('id', paymentId)
        .single()

      if (payment) {
        const amountDue = Number(payment.amount)
        const sessionPaid = (session.amount_total || 0) / 100
        const newAmountPaid = Number(payment.amount_paid || 0) + sessionPaid

        let newStatus = 'partial'
        if (newAmountPaid >= amountDue) newStatus = 'paid'
        else if (newAmountPaid <= 0) newStatus = 'unpaid'

        await supabase
          .from('payments')
          .update({
            amount_paid: newAmountPaid,
            status: newStatus,
            paid_date: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null,
            stripe_payment_intent_id: session.payment_intent || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentId)

        console.log(`Payment ${paymentId} updated: £${newAmountPaid} paid, status: ${newStatus}`)
      }
    }

    // Handle subscription checkout completion — create local subscription record
    if (session.mode === 'subscription' && session.subscription) {
      const planId = session.metadata?.supabase_plan_id
      const userId = session.metadata?.supabase_user_id
      const playerId = session.metadata?.supabase_player_id

      if (planId && userId) {
        // Fetch the full subscription from Stripe for period info
        const stripeSubResponse = await stripe.subscriptions.retrieve(session.subscription as string)
        // Use any to access period fields which vary by Stripe API version
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripeSub = stripeSubResponse as any

        // Get user's organisation for org-scoped insert
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('organisation_id')
          .eq('id', userId)
          .single()

        await supabase.from('subscriptions').insert({
          parent_id: userId,
          player_id: playerId || null,
          plan_id: planId,
          status: stripeSub.status || 'active',
          stripe_subscription_id: stripeSub.id,
          stripe_customer_id: session.customer as string,
          organisation_id: userProfile?.organisation_id || '00000000-0000-0000-0000-000000000001',
          current_period_start: stripeSub.current_period_start
            ? new Date(stripeSub.current_period_start * 1000).toISOString()
            : null,
          current_period_end: stripeSub.current_period_end
            ? new Date(stripeSub.current_period_end * 1000).toISOString()
            : null,
        })

        console.log(`Subscription created for user ${userId}, plan ${planId}`)
      }
    }
  }

  // ─── SUBSCRIPTION UPDATED (renewal, payment failure, plan change) ───
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object
    const stripeSubId = sub.id

    await supabase
      .from('subscriptions')
      .update({
        status: sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end || false,
        canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', stripeSubId)

    console.log(`Subscription ${stripeSubId} updated: status=${sub.status}`)
  }

  // ─── SUBSCRIPTION DELETED (fully canceled) ───
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    const stripeSubId = sub.id

    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', stripeSubId)

    console.log(`Subscription ${stripeSubId} canceled`)
  }

  // ─── INVOICE PAID (subscription renewal success) ───
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object
    if (invoice.subscription) {
      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', invoice.subscription as string)

      console.log(`Invoice paid for subscription ${invoice.subscription}`)
    }
  }

  // ─── INVOICE PAYMENT FAILED ───
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object
    if (invoice.subscription) {
      await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', invoice.subscription as string)

      console.log(`Payment failed for subscription ${invoice.subscription}`)
    }
  }

  return NextResponse.json({ received: true })
}
