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
    // notification insert failed — non-critical, continue
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
    // Email module is optional — continue
  }
}

/** Resolve profile + plan metadata from a Stripe checkout session */
async function resolveSessionContext(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id ?? null
  const planId = session.metadata?.supabase_plan_id ?? null
  const playerId = session.metadata?.supabase_player_id ?? null
  const classId = session.metadata?.supabase_class_id ?? null

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

  return { userId, planId, playerId, classId, profile, plan, orgId, organisationName }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // ─── Camp booking paid (one-off Connect payment) ───
  // Source of truth for camp payment. Previously the booking was marked paid
  // on the success-page redirect, which anyone could hit without paying — this
  // confirms it only on a verified Stripe completion.
  if (session.metadata?.camp_booking_id) {
    if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
      const { data: booking } = await supabase
        .from('camp_bookings')
        .update({ payment_status: 'paid', stripe_session_id: session.id })
        .eq('id', session.metadata.camp_booking_id)
        .select('organisation_id, parent_email, child_name, amount_paid, camp_id')
        .maybeSingle()

      // Record the camp as its own itemised line on the parent's billing page —
      // separate from any subscription. Only possible if the booker has a parent
      // account (payments.parent_id is NOT NULL); anonymous campers are skipped.
      if (booking?.parent_email && booking.organisation_id) {
        const { data: parentProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('organisation_id', booking.organisation_id)
          .ilike('email', booking.parent_email as string)
          .maybeSingle()

        if (parentProfile?.id) {
          let campName = 'Camp'
          if (booking.camp_id) {
            const { data: camp } = await supabase.from('camps').select('name').eq('id', booking.camp_id).maybeSingle()
            if (camp?.name) campName = camp.name as string
          }
          const amt = Number(booking.amount_paid ?? (session.amount_total ?? 0) / 100)
          await supabase.from('payments').insert({
            parent_id: parentProfile.id,
            organisation_id: booking.organisation_id,
            amount: amt,
            amount_paid: amt,
            status: 'paid',
            stripe_session_id: session.id,
            description: `Camp: ${campName}${booking.child_name ? ` — ${booking.child_name}` : ''}`,
            due_date: new Date().toISOString().split('T')[0],
            paid_date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString(),
          })
        }
      }
    }
    return
  }

  // ─── Platform subscription (academy paying Player Portal) ───
  // Set by /api/platform/subscribe. Activates the academy's own SaaS plan and
  // marks them published so their public booking page goes live (hybrid model).
  if (session.metadata?.type === 'platform_subscription') {
    const orgId = session.metadata.organisation_id
    const planId = session.metadata.platform_plan_id
    const subId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null
    if (orgId) {
      await supabase
        .from('organisations')
        .update({
          platform_subscription_status: 'active',
          platform_stripe_subscription_id: subId,
          ...(planId ? { platform_plan_id: planId } : {}),
          is_published: true, // hybrid: paying = academy goes live
        })
        .eq('id', orgId)
    }
    return
  }

  // ─── Bulk-migration confirmation (pending_migration sub completing first payment) ───
  // Set by /api/migration/confirm-checkout. The existing pending_migration
  // subscription row must flip to active here — the success page is only a
  // holding screen and resolveSessionContext can't see it (migration uses
  // supabase_parent_id, not supabase_user_id). Without this the parent pays
  // but stays pending_migration forever.
  if (session.metadata?.migration === 'true' && session.metadata?.supabase_subscription_id) {
    const subId = session.metadata.supabase_subscription_id
    const nowIso = new Date().toISOString()

    const { data: migSub } = await supabase
      .from('subscriptions')
      .select('id, parent_id, organisation_id, plan_id')
      .eq('id', subId)
      .maybeSingle()

    let stripeSub: (Stripe.Subscription & { current_period_start: number; current_period_end: number }) | null = null
    if (session.subscription) {
      stripeSub = await stripe.subscriptions.retrieve(
        typeof session.subscription === 'string' ? session.subscription : session.subscription.id
      ) as Stripe.Subscription & { current_period_start: number; current_period_end: number }
    }

    await supabase
      .from('subscriptions')
      .update({
        status: stripeSub?.status || 'active',
        invite_confirmed_at: nowIso,
        stripe_subscription_id: stripeSub?.id ?? null,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
        ...(stripeSub?.current_period_start ? { current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString() } : {}),
        ...(stripeSub?.current_period_end ? { current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString() } : {}),
        updated_at: nowIso,
      })
      .eq('id', subId)

    // Itemised payment row. £0 today (trial_end / prepaid migration) records
    // nothing now — the first real charge lands later via invoice.payment_succeeded.
    const amount = (session.amount_total ?? 0) / 100
    if (migSub?.parent_id && migSub.organisation_id && amount > 0) {
      let planName = 'Subscription'
      if (migSub.plan_id) {
        const { data: pl } = await supabase.from('subscription_plans').select('name').eq('id', migSub.plan_id).maybeSingle()
        if (pl?.name) planName = pl.name as string
      }
      await supabase.from('payments').insert({
        parent_id: migSub.parent_id,
        organisation_id: migSub.organisation_id,
        amount,
        amount_paid: amount,
        status: 'paid',
        stripe_session_id: session.id,
        description: `${planName} — subscription`,
        due_date: nowIso.split('T')[0],
        paid_date: nowIso.split('T')[0],
        created_at: nowIso,
      })
    }
    return
  }

  // ─── Paid trial flow — record trial_booking + skip subscription/enrolment paths ───
  // Set by /api/trial-bookings/paid. One-off Checkout, no user account required.
  if (session.metadata?.type === 'paid_trial') {
    const m = session.metadata
    const childName = `${m.child_first_name || ''} ${m.child_last_name || ''}`.trim() || 'Trial child'
    let childAge: number | null = null
    if (m.child_dob) {
      const dob = new Date(m.child_dob)
      if (!isNaN(dob.getTime())) {
        const today = new Date()
        childAge = today.getFullYear() - dob.getFullYear()
        const monthDiff = today.getMonth() - dob.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) childAge--
      }
    }
    await supabase.from('trial_bookings').insert({
      organisation_id: m.supabase_org_id,
      training_group_id: m.supabase_class_id,
      parent_name: m.parent_name || 'Parent',
      parent_email: m.parent_email || '',
      parent_phone: m.parent_phone || null,
      child_name: childName,
      child_age: childAge,
      preferred_date: m.session_date || null,
      notes: `Paid trial — £${((session.amount_total ?? 0) / 100).toFixed(2)} via Stripe (${session.id})`,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      terms_accepted_at: m.terms_accepted_at || null,
      terms_version_hash: m.terms_version_hash || null,
    })
    return
  }

  const ctx = await resolveSessionContext(session)
  const amountPaid = (session.amount_total ?? 0) / 100
  const now = new Date().toISOString()

  // 1. Record / update payment — itemised line on the parent's billing page.
  // NOTE: the payments table uses parent_id (NOT profile_id) and has no
  // subscription_plan_id column. The plan is captured in `description`.
  if (ctx.userId) {
    await supabase.from('payments').insert({
      parent_id: ctx.userId,
      player_id: ctx.playerId || null,
      organisation_id: ctx.orgId,
      amount: amountPaid,
      amount_paid: amountPaid,
      status: 'paid',
      stripe_session_id: session.id,
      description: ctx.plan?.name ? `${ctx.plan.name} — subscription` : 'Subscription payment',
      due_date: now.split('T')[0],
      paid_date: now.split('T')[0],
      created_at: now,
    })
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

    // AUTO-ENROL: if the parent came from a specific class page, enrol their
    // player in that class straight away so the admin doesn't have to do it manually.
    if (ctx.classId && ctx.playerId) {
      const { data: existingEnrolment } = await supabase
        .from('enrolments')
        .select('id')
        .eq('player_id', ctx.playerId)
        .eq('group_id', ctx.classId)
        .maybeSingle()

      if (!existingEnrolment) {
        await supabase.from('enrolments').insert({
          player_id: ctx.playerId,
          group_id: ctx.classId,
          status: 'active',
        })
      }
    }
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

  // 5. Subscription-started welcome email \u2014 only on the FIRST subscription event
  //    for a new subscription, NOT every renewal. Fires once per new subscription.
  if (session.mode === 'subscription' && ctx.profile?.email && ctx.plan && ctx.orgId) {
    try {
      // Fetch child name + next session + academy branding for a personalised email.
      let childName: string | undefined
      if (ctx.playerId) {
        const { data: player } = await supabase
          .from('players')
          .select('first_name')
          .eq('id', ctx.playerId)
          .maybeSingle()
        childName = (player?.first_name as string | undefined) || undefined
      }

      // Find the next session this player could attend
      let nextClass: { name: string; day: string; time: string; location?: string } | undefined
      if (ctx.playerId) {
        const { data: enrol } = await supabase
          .from('enrolments')
          .select('group:training_groups(name, day_of_week, time_slot, location)')
          .eq('player_id', ctx.playerId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()
        const group = (enrol?.group as unknown as { name: string; day_of_week: string | null; time_slot: string | null; location: string | null } | null) || null
        if (group?.name) {
          nextClass = {
            name: group.name,
            day: group.day_of_week || 'TBA',
            time: group.time_slot || 'TBA',
            location: group.location || undefined,
          }
        }
      }

      const { data: orgBranding } = await supabase
        .from('organisations')
        .select('logo_url, contact_email')
        .eq('id', ctx.orgId)
        .maybeSingle()

      const { subscriptionStartedEmail, firstSaleEmail } = await import('@/lib/email-templates')
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
      const template = subscriptionStartedEmail({
        parentName: ctx.profile.full_name ?? 'Parent',
        childName,
        academyName: ctx.organisationName ?? 'Your Academy',
        planName: ctx.plan.name,
        amount: `\u00a3${amountPaid.toFixed(2)}`,
        nextClass,
        dashboardUrl: `${appUrl}/dashboard`,
        academyLogoUrl: (orgBranding?.logo_url as string | undefined) || undefined,
        academyContactEmail: (orgBranding?.contact_email as string | undefined) || undefined,
      })
      const { sendEmail } = await import('@/lib/email')
      await sendEmail({ to: ctx.profile.email, ...template })

      // \u2500\u2500 PLATFORM ADMIN: notify on this academy's FIRST EVER paid subscription \u2500\u2500
      // Check if this is the only active subscription for the org. If yes, fire off
      // a one-time "first sale" email to the platform admin \u2014 celebrate the moment.
      const { count: priorSubs } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('organisation_id', ctx.orgId)
        .in('status', ['active', 'trialing'])
        .neq('stripe_subscription_id', typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? '')

      if ((priorSubs || 0) === 0) {
        const { data: orgInfo } = await supabase
          .from('organisations')
          .select('slug')
          .eq('id', ctx.orgId)
          .maybeSingle()
        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'johnleitch970@gmail.com'
        const firstSaleTemplate = firstSaleEmail({
          academyName: ctx.organisationName ?? 'Academy',
          academySlug: (orgInfo?.slug as string | undefined) || '',
          parentName: ctx.profile.full_name ?? 'Parent',
          childName,
          planName: ctx.plan.name,
          amount: `\u00a3${amountPaid.toFixed(2)}`,
          dashboardUrl: appUrl,
        })
        await sendEmail({ to: adminEmail, ...firstSaleTemplate })
      }
    } catch (err) {
      // Don't fail the webhook on email errors
      console.error('Subscription started email failed:', err)
    }
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id ?? null

  if (!subscriptionId) return

  const amountPaid = (invoice.amount_paid ?? 0) / 100
  const now = new Date().toISOString()

  // Look up local subscription to find profile + plan name (for the itemised line)
  const { data: localSub } = await supabase
    .from('subscriptions')
    .select('id, parent_id, plan_id, organisation_id, plan:subscription_plans(name)')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  // Update subscription status to active
  if (localSub) {
    await supabase
      .from('subscriptions')
      .update({ status: 'active', updated_at: now })
      .eq('id', localSub.id)
  }

  // Record payment — itemised line on the parent's billing page.
  // (payments uses parent_id, NOT profile_id, and has no subscription_plan_id.)
  if (localSub?.parent_id) {
    const renewalPlanName = (localSub.plan as unknown as { name?: string } | null)?.name
    await supabase.from('payments').insert({
      parent_id: localSub.parent_id,
      organisation_id: localSub.organisation_id,
      amount: amountPaid,
      amount_paid: amountPaid,
      status: 'paid',
      stripe_session_id: invoice.id,
      description: renewalPlanName ? `${renewalPlanName} — subscription` : 'Subscription payment',
      due_date: now.split('T')[0],
      paid_date: now.split('T')[0],
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

  // Mark any pending payment for this parent as overdue.
  // (payments uses parent_id, not profile_id; no subscription_plan_id column.)
  if (localSub?.parent_id) {
    await supabase
      .from('payments')
      .update({ status: 'overdue', updated_at: now })
      .eq('parent_id', localSub.parent_id)
      .eq('organisation_id', localSub.organisation_id)
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

    // ── ALSO: email all org admins so they can intervene before the parent churns ──
    try {
      const [{ data: parentProfile }, { data: orgInfo }, { data: admins }] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', localSub.parent_id)
          .maybeSingle(),
        supabase
          .from('organisations')
          .select('name')
          .eq('id', localSub.organisation_id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('email')
          .eq('organisation_id', localSub.organisation_id)
          .eq('role', 'admin')
      ])

      // Find a child name if the parent only has one player (best-effort context)
      const { data: kids } = await supabase
        .from('players')
        .select('first_name')
        .eq('parent_id', localSub.parent_id)
        .limit(2)
      const childName = (kids || []).length === 1 ? (kids![0].first_name as string) : undefined

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
      const { paymentFailedAdminEmail } = await import('@/lib/email-templates')
      const { sendEmail } = await import('@/lib/email')
      const amountFailed = (invoice.amount_due ?? 0) / 100
      const template = paymentFailedAdminEmail({
        academyName: (orgInfo?.name as string | undefined) || 'Academy',
        parentName: (parentProfile?.full_name as string | undefined) || 'Parent',
        parentEmail: (parentProfile?.email as string | undefined) || undefined,
        childName,
        planName: (plan?.name as string | undefined) || 'Subscription',
        amount: `£${amountFailed.toFixed(2)}`,
        dashboardUrl: appUrl,
      })

      for (const admin of admins || []) {
        const adminEmail = admin.email as string | undefined
        if (adminEmail) {
          await sendEmail({ to: adminEmail, ...template })
        }
      }
    } catch (err) {
      console.error('Payment failed admin email failed:', err)
    }
  }

}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const stripeSubId = subscription.id
  const now = new Date().toISOString()

  // ─── Platform subscription cancelled (academy stops paying Player Portal) ───
  // These live on organisations, not the subscriptions table. Mark the org
  // cancelled and clear the sub id so the dashboard gate re-locks the admin.
  // We keep is_published = true so existing parents + the booking page stay
  // live (consistent with trial-expiry: lock the admin, never the families).
  const { data: platformOrg } = await supabase
    .from('organisations')
    .select('id')
    .eq('platform_stripe_subscription_id', stripeSubId)
    .maybeSingle()
  if (platformOrg) {
    await supabase
      .from('organisations')
      .update({
        platform_subscription_status: 'cancelled',
        platform_stripe_subscription_id: null,
      })
      .eq('id', platformOrg.id)
    return
  }

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

}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const stripeSubId = subscription.id
  const now = new Date().toISOString()

  // ─── Platform subscription status change (renewal, past_due, recovery) ───
  // Keep the academy's platform_subscription_status in sync with Stripe so the
  // dashboard gate reflects reality (e.g. failed renewal → past_due → locked,
  // payment recovers → active → unlocked).
  const { data: platformOrg } = await supabase
    .from('organisations')
    .select('id')
    .eq('platform_stripe_subscription_id', stripeSubId)
    .maybeSingle()
  if (platformOrg) {
    const mapped =
      subscription.status === 'active' || subscription.status === 'trialing'
        ? 'active'
        : subscription.status === 'past_due' || subscription.status === 'unpaid'
          ? 'past_due'
          : subscription.status === 'canceled'
            ? 'cancelled'
            : subscription.status
    await supabase
      .from('organisations')
      .update({ platform_subscription_status: mapped })
      .eq('id', platformOrg.id)
    return
  }

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

}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  ensureClients()
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
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
    return NextResponse.json({ error: `Invalid signature: ${message}` }, { status: 400 })
  }

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
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Return 200 to prevent Stripe from retrying on application errors
    // The event was received and signature verified; the processing error is ours
    return NextResponse.json({ received: true, error: message }, { status: 200 })
  }

  return NextResponse.json({ received: true })
}
