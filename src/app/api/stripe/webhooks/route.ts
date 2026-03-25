import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
let stripe: Stripe = null as any
let supabase: any = null

function ensureClients() {
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
  if (!supabase) supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Insert a row into the notifications table */
async function createNotification(params: {
  profileId: string
  organisationId: string | null
  type: string
  title: string
  body: string
  link?: string
}) {
  const { error } = await supabase.from('notifications').insert({
    profile_id: params.profileId,
    organisation_id: params.organisationId,
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link ?? null,
    is_read: false,
  })
  if (error) {
    console.error('[WEBHOOK] Failed to create notification:', error)
  }
}

/** Attempt to send a payment receipt email. Email module is optional. */
async function trySendReceiptEmail(params: {
  email: string
  parentName: string
  amount: string
  planName: string
  date: string
  receiptId: string
  academyName: string
}) {
  try {
    const { sendEmail } = await import('@/lib/email')
    const { paymentReceiptEmail } = await import('@/lib/email-templates')
    const { subject, html } = paymentReceiptEmail({
      parentName: params.parentName,
      amount: params.amount,
      planName: params.planName,
      date: params.date,
      receiptId: params.receiptId,
      academyName: params.academyName,
    })
    await sendEmail({ to: params.email, subject, html })
  } catch {
    // Email module is optional — log and continue
    console.log('[WEBHOOK] Email module unavailable, skipping receipt email')
  }
}

/** Resolve profile + plan metadata from a Stripe checkout session */
async function resolveSessionContext(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id ?? null
  const planId = session.metadata?.supabase_plan_id ?? null
  const playerId = session.metadata?.supabase_player_id ?? null

  let profile: {
    id: string
    full_name: string | null
    email: string | null
    organisation_id: string | null
    stripe_customer_id: string | null
  } | null = null

  let plan: {
    id: string
    name: string
    organisation_id: string | null
  } | null = null

  let organisationName: string | null = null

  if (userId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, organisation_id, stripe_customer_id')
      .eq('id', userId)
      .single()
    profile = data
  }

  if (planId) {
    const { data } = await supabase
      .from('subscription_plans')
      .select('id, name, organisation_id')
      .eq('id', planId)
      .single()
    plan = data
  }

  const orgId = profile?.organisation_id ?? plan?.organisation_id ?? null

  if (orgId) {
    const { data } = await supabase
      .from('organisations')
      .select('name')
      .eq('id', orgId)
      .single()
    organisationName = data?.name ?? null
  }

  return { userId, planId, playerId, profile, plan, orgId, organisationName }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const ctx = await resolveSessionContext(session)
  const amountPaid = (session.amount_total ?? 0) / 100
  const now = new Date().toISOString()

  // 1. Record / update payment
  if (ctx.userId && ctx.planId) {
    await supabase.from('payments').insert({
      profile_id: ctx.userId,
      organisation_id: ctx.orgId,
      amount: amountPaid,
      status: 'paid',
      stripe_session_id: session.id,
      subscription_plan_id: ctx.planId,
      created_at: now,
    })
    console.log(`[WEBHOOK] Payment recorded for user ${ctx.userId}, amount: ${amountPaid}`)
  }

  // 2. Create / update enrolment for subscription checkouts
  if (session.mode === 'subscription' && session.subscription && ctx.userId && ctx.planId) {
    const stripeSub = await stripe.subscriptions.retrieve(
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id
    ) as Stripe.Subscription & { current_period_start: number; current_period_end: number }

    // Upsert enrolment via subscriptions table
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', stripeSub.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('subscriptions')
        .update({
          status: stripeSub.status,
          current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
          updated_at: now,
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('subscriptions').insert({
        parent_id: ctx.userId,
        player_id: ctx.playerId || null,
        plan_id: ctx.planId,
        status: stripeSub.status || 'active',
        stripe_subscription_id: stripeSub.id,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
        organisation_id: ctx.orgId,
        current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
      })
    }

    console.log(`[WEBHOOK] Enrolment upserted for subscription ${stripeSub.id}`)
  }

  // 3. In-app notification
  if (ctx.userId) {
    await createNotification({
      profileId: ctx.userId,
      organisationId: ctx.orgId,
      type: 'payment',
      title: 'Payment confirmed',
      body: `Your payment of \u00a3${amountPaid.toFixed(2)}${ctx.plan ? ` for ${ctx.plan.name}` : ''} has been received.`,
      link: '/dashboard/payments',
    })
  }

  // 4. Receipt email
  if (ctx.profile?.email) {
    await trySendReceiptEmail({
      email: ctx.profile.email,
      parentName: ctx.profile.full_name ?? 'Parent',
      amount: `\u00a3${amountPaid.toFixed(2)}`,
      planName: ctx.plan?.name ?? 'Subscription',
      date: new Date().toLocaleDateString('en-GB'),
      receiptId: session.id,
      academyName: ctx.organisationName ?? 'Your Academy',
    })
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id ?? null

  if (!subscriptionId) return

  const amountPaid = (invoice.amount_paid ?? 0) / 100
  const now = new Date().toISOString()

  // Look up local subscription to find profile
  const { data: localSub } = await supabase
    .from('subscriptions')
    .select('id, parent_id, plan_id, organisation_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  // Update subscription status to active
  if (localSub) {
    await supabase
      .from('subscriptions')
      .update({ status: 'active', updated_at: now })
      .eq('id', localSub.id)
  }

  // Record payment
  if (localSub?.parent_id) {
    await supabase.from('payments').insert({
      profile_id: localSub.parent_id,
      organisation_id: localSub.organisation_id,
      amount: amountPaid,
      status: 'paid',
      stripe_session_id: invoice.id,
      subscription_plan_id: localSub.plan_id,
      created_at: now,
    })

    // Fetch profile + plan for notification and email
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, organisation_id')
      .eq('id', localSub.parent_id)
      .single()

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('name')
      .eq('id', localSub.plan_id)
      .maybeSingle()

    let organisationName: string | null = null
    if (localSub.organisation_id) {
      const { data: org } = await supabase
        .from('organisations')
        .select('name')
        .eq('id', localSub.organisation_id)
        .single()
      organisationName = org?.name ?? null
    }

    // In-app notification
    await createNotification({
      profileId: localSub.parent_id,
      organisationId: localSub.organisation_id,
      type: 'payment',
      title: 'Subscription payment received',
      body: `Your recurring payment of \u00a3${amountPaid.toFixed(2)}${plan ? ` for ${plan.name}` : ''} was successful.`,
      link: '/dashboard/payments',
    })

    // Receipt email
    if (profile?.email) {
      await trySendReceiptEmail({
        email: profile.email,
        parentName: profile.full_name ?? 'Parent',
        amount: `\u00a3${amountPaid.toFixed(2)}`,
        planName: plan?.name ?? 'Subscription',
        date: new Date().toLocaleDateString('en-GB'),
        receiptId: invoice.id ?? 'N/A',
        academyName: organisationName ?? 'Your Academy',
      })
    }
  }

  console.log(`[WEBHOOK] Invoice payment succeeded for subscription ${subscriptionId}`)
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id ?? null

  if (!subscriptionId) return

  const now = new Date().toISOString()

  // Mark subscription as past_due
  const { data: localSub } = await supabase
    .from('subscriptions')
    .select('id, parent_id, plan_id, organisation_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  if (localSub) {
    await supabase
      .from('subscriptions')
      .update({ status: 'past_due', updated_at: now })
      .eq('id', localSub.id)
  }

  // Mark any pending payment as overdue
  if (localSub?.parent_id && localSub.plan_id) {
    await supabase
      .from('payments')
      .update({ status: 'overdue', updated_at: now })
      .eq('profile_id', localSub.parent_id)
      .eq('subscription_plan_id', localSub.plan_id)
      .eq('status', 'pending')
  }

  // Notify parent
  if (localSub?.parent_id) {
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('name')
      .eq('id', localSub.plan_id)
      .maybeSingle()

    await createNotification({
      profileId: localSub.parent_id,
      organisationId: localSub.organisation_id,
      type: 'payment',
      title: 'Payment failed',
      body: `Your payment${plan ? ` for ${plan.name}` : ''} could not be processed. Please update your payment method to avoid losing your place.`,
      link: '/dashboard/payments',
    })
  }

  console.log(`[WEBHOOK] Invoice payment failed for subscription ${subscriptionId}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const stripeSubId = subscription.id
  const now = new Date().toISOString()

  const { data: localSub } = await supabase
    .from('subscriptions')
    .select('id, parent_id, plan_id, organisation_id')
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle()

  // Mark as cancelled
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: now,
      updated_at: now,
    })
    .eq('stripe_subscription_id', stripeSubId)

  // Notify parent
  if (localSub?.parent_id) {
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('name')
      .eq('id', localSub.plan_id)
      .maybeSingle()

    await createNotification({
      profileId: localSub.parent_id,
      organisationId: localSub.organisation_id,
      type: 'subscription',
      title: 'Subscription cancelled',
      body: `Your subscription${plan ? ` to ${plan.name}` : ''} has been cancelled. You can resubscribe at any time from your dashboard.`,
      link: '/dashboard/payments',
    })
  }

  console.log(`[WEBHOOK] Subscription ${stripeSubId} cancelled`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const stripeSubId = subscription.id
  const now = new Date().toISOString()

  // Cast to access period fields that vary by Stripe API version
  const sub = subscription as Stripe.Subscription & {
    current_period_start: number
    current_period_end: number
  }

  await supabase
    .from('subscriptions')
    .update({
      status: sub.status,
      current_period_start: sub.current_period_start
        ? new Date(sub.current_period_start * 1000).toISOString()
        : undefined,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : undefined,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      canceled_at: sub.canceled_at
        ? new Date(sub.canceled_at * 1000).toISOString()
        : null,
      updated_at: now,
    })
    .eq('stripe_subscription_id', stripeSubId)

  console.log(`[WEBHOOK] Subscription ${stripeSubId} updated: status=${sub.status}`)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  ensureClients()
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    console.error('[WEBHOOK] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[WEBHOOK] Signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[WEBHOOK] Received event: ${event.type} (${event.id})`)

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[WEBHOOK] Error handling ${event.type}:`, message)
    // Return 200 to prevent Stripe from retrying on application errors
    // The event was received and signature verified; the processing error is ours
    return NextResponse.json({ received: true, error: message }, { status: 200 })
  }

  return NextResponse.json({ received: true })
}
