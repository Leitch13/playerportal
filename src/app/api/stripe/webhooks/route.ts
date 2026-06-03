import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { shouldProcessEvent, markEventSuccess, markEventError } from '@/lib/stripe-events'

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

/** Insert a row into the notifications table.
 *  Throws on failure so the top-level handler returns 500 and Stripe retries. */
async function createNotification(params: {
  profileId: string
  organisationId: string | null
  type: string
  title: string
  body: string
  link?: string
}) {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.profileId,
    organisation_id: params.organisationId,
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link ?? null,
    read: false,
  })
  if (error) throw new Error(`notifications.insert failed: ${error.message}`)
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

/**
 * Format a date in the style "Thu 4 June 2026". Used by parent + admin
 * billing emails so dates are unambiguous across the parent's day-week-month.
 */
function formatLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

/**
 * Returns the first day of the calendar month AFTER `iso`, formatted
 * "1 July 2026". Used as the recurring-charge anchor in billing emails.
 */
function anchorLabelFor(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return ''
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  return next.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

/**
 * Returns the day BEFORE the next-month anchor, formatted "30 June 2026".
 * Used to describe the END of the bridge coverage period in parent emails.
 */
function bridgeUntilLabelFor(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return ''
  const lastDayOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  return lastDayOfMonth.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

/**
 * Shared "new signup landed" email sender. Sends:
 *   • parent — bridge / scheduled / prorated variant of subscriptionStartedEmail
 *               OR scheduledSignupConfirmationEmail (for setup-mode signups)
 *   • org admins — newSignupAdminEmail (every signup, P1 requirement)
 *
 * Branches on `billingModel`:
 *   - 'future_session_bridge' — bridge variant (parent paid £X bridge today)
 *   - 'future_prorated'        — scheduledSignupConfirmationEmail (card saved, no charge today)
 *   - 'immediate_prorated'     — prorated variant (parent paid today, recurring from 1st)
 *
 * Idempotent at the caller layer (each webhook branch calls once after DB write).
 * Wrapped in try/catch by callers so an email failure never breaks the webhook.
 */
async function sendSignupEmails(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  args: {
    userId: string
    playerId: string | null
    classId: string | null
    orgId: string
    planId: string
    activatesOn: string
    billingModel: 'future_session_bridge' | 'future_prorated' | 'immediate_prorated'
    /** Bridge variant only — pence charged at checkout (used for parent email math) */
    bridgePence?: number
    bridgeSessionsRemaining?: number
    /** Prorated variant only — what Stripe charged today (in pounds) */
    amountPaidToday?: number
  },
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  // Parallel-load all the context we need
  const [{ data: profile }, { data: plan }, { data: org }, { data: group }] = await Promise.all([
    sb.from('profiles').select('full_name, email').eq('id', args.userId).maybeSingle(),
    sb.from('subscription_plans').select('name, amount').eq('id', args.planId).maybeSingle(),
    sb.from('organisations').select('name, logo_url, contact_email').eq('id', args.orgId).maybeSingle(),
    args.classId
      ? sb.from('training_groups').select('name').eq('id', args.classId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!profile?.email) return

  let childName: string | undefined
  if (args.playerId) {
    const { data: player } = await sb.from('players').select('first_name').eq('id', args.playerId).maybeSingle()
    childName = (player?.first_name as string | undefined) || undefined
  }

  const parentName = (profile.full_name as string | undefined) ?? 'Parent'
  const academyName = (org?.name as string | undefined) ?? 'Your Academy'
  const planName = (plan?.name as string | undefined) ?? 'Subscription'
  const monthlyAmountNum = Number((plan as { amount?: number } | null)?.amount ?? 0)
  const monthlyAmount = `£${monthlyAmountNum.toFixed(2)}`
  const className = (group as { name?: string } | null)?.name as string | undefined
  const activatesOnLabel = formatLongDate(args.activatesOn)
  const anchorLabel = anchorLabelFor(args.activatesOn)

  const { sendEmail } = await import('@/lib/email')
  const {
    subscriptionStartedEmail,
    scheduledSignupConfirmationEmail,
    newSignupAdminEmail,
  } = await import('@/lib/email-templates')

  // ── Parent email ──
  let parentEmailTpl: { subject: string; html: string } | null = null
  let billingModelLabel = ''

  if (args.billingModel === 'future_session_bridge') {
    const bridgeAmount = `£${((args.bridgePence ?? 0) / 100).toFixed(2)}`
    parentEmailTpl = subscriptionStartedEmail({
      parentName, childName, academyName, planName,
      amount: bridgeAmount,
      dashboardUrl: `${appUrl}/dashboard`,
      academyLogoUrl: (org?.logo_url as string | undefined) || undefined,
      academyContactEmail: (org?.contact_email as string | undefined) || undefined,
      billingContext: {
        kind: 'bridge',
        sessionsRemaining: args.bridgeSessionsRemaining ?? 0,
        bridgeUntilLabel: bridgeUntilLabelFor(args.activatesOn),
        anchorLabel,
        monthlyAmount,
      },
    })
    billingModelLabel = `Bridge — ${bridgeAmount} today covers ${args.bridgeSessionsRemaining ?? 0} session(s); ${monthlyAmount}/mo from ${anchorLabel}`
  } else if (args.billingModel === 'future_prorated') {
    parentEmailTpl = scheduledSignupConfirmationEmail({
      parentName, childName, academyName, planName, className,
      activatesOnLabel,
      monthlyAmount,
      anchorLabel,
      dashboardUrl: `${appUrl}/dashboard`,
      academyLogoUrl: (org?.logo_url as string | undefined) || undefined,
      academyContactEmail: (org?.contact_email as string | undefined) || undefined,
    })
    billingModelLabel = `Scheduled — card saved, first charge on ${activatesOnLabel}, ${monthlyAmount}/mo from ${anchorLabel}`
  } else if (args.billingModel === 'immediate_prorated') {
    const today = `£${(args.amountPaidToday ?? 0).toFixed(2)}`
    parentEmailTpl = subscriptionStartedEmail({
      parentName, childName, academyName, planName,
      amount: today,
      dashboardUrl: `${appUrl}/dashboard`,
      academyLogoUrl: (org?.logo_url as string | undefined) || undefined,
      academyContactEmail: (org?.contact_email as string | undefined) || undefined,
      billingContext: { kind: 'prorated', anchorLabel, monthlyAmount },
    })
    billingModelLabel = `Today — ${today} pro-rata to ${anchorLabel}, then ${monthlyAmount}/mo`
  }

  if (parentEmailTpl) {
    await sendEmail({
      to: profile.email,
      ...parentEmailTpl,
      fromName: academyName,
      replyTo: (org?.contact_email as string | undefined) || undefined,
    })
  }

  // ── Org-admin notifications (P1: every signup, not just first) ──
  const { data: admins } = await sb
    .from('profiles')
    .select('email')
    .eq('organisation_id', args.orgId)
    .eq('role', 'admin')
  const adminTpl = newSignupAdminEmail({
    academyName,
    parentName,
    parentEmail: profile.email as string,
    childName,
    planName,
    amount: monthlyAmount,
    billingModelLabel,
    activatesOnLabel,
    dashboardUrl: appUrl,
  })
  for (const a of (admins || []) as { email: string | null }[]) {
    if (a.email) {
      await sendEmail({ to: a.email, ...adminTpl, fromName: academyName })
    }
  }
}

/** Resolve profile + plan metadata from a Stripe checkout session */
async function resolveSessionContext(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id ?? null
  const planId = session.metadata?.supabase_plan_id ?? null
  const playerId = session.metadata?.supabase_player_id ?? null
  const classId = session.metadata?.supabase_class_id ?? null
  // Stage 1: chosen start date carried in metadata. Written to enrolments.activates_on
  // on insert, regardless of which billing branch fired. Defaults to today
  // if not present (legacy signups before Stage 1 deploys).
  const rawActivates = session.metadata?.activates_on ?? null
  const activatesOn: string = (() => {
    if (typeof rawActivates === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawActivates)) return rawActivates
    return new Date().toISOString().split('T')[0]
  })()

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

  return { userId, planId, playerId, classId, profile, plan, orgId, organisationName, activatesOn }
}

/**
 * Auto-convert a lead to 'enrolled' once the parent actually pays. Keeps the
 * leads pipeline honest (and the conversion-rate stat real) without an admin
 * having to drag the card across manually. Best-effort — never fails the webhook.
 */
async function convertLeadToEnrolled(orgId: string | null, email: string | null | undefined) {
  if (!orgId || !email) return
  try {
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('organisation_id', orgId)
      .ilike('email', email.trim())
      .not('status', 'in', '(enrolled,lost)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lead?.id) {
      const { error: leadErr } = await supabase
        .from('leads')
        .update({ status: 'enrolled', updated_at: new Date().toISOString() })
        .eq('id', lead.id)
      if (leadErr) throw new Error(`leads.update failed: ${leadErr.message}`)
    }
  } catch (e) {
    // Lead bookkeeping is best-effort but should surface so we can fix it.
    // Re-throw if it's a hard error; tolerate transient lookups.
    if (e instanceof Error && e.message.startsWith('leads.update failed')) throw e
    // otherwise: profile lookup failed etc — non-critical, continue
  }
}

/**
 * Capture an abandoned checkout as a lead. Fires on checkout.session.expired
 * (a session that wasn't paid). Turns otherwise-lost intent into a warm
 * follow-up. Skips platform/camp sessions, existing paying customers, and
 * duplicates. Best-effort.
 */
async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  if (session.metadata?.type === 'platform_subscription') return
  if (session.metadata?.camp_booking_id) return

  let orgId: string | null = session.metadata?.supabase_org_id || null
  let email: string | null = session.customer_email || session.metadata?.parent_email || null
  let firstName: string | null = null
  let lastName: string | null = null
  let childName: string | null = null

  if (session.metadata?.type === 'paid_trial') {
    const m = session.metadata
    const parts = (m.parent_name || '').trim().split(/\s+/).filter(Boolean)
    firstName = parts[0] || null
    lastName = parts.slice(1).join(' ') || null
    email = m.parent_email || email
    orgId = m.supabase_org_id || orgId
    childName = `${m.child_first_name || ''} ${m.child_last_name || ''}`.trim() || null
  } else if (session.metadata?.supabase_user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, organisation_id')
      .eq('id', session.metadata.supabase_user_id)
      .maybeSingle()
    if (profile) {
      orgId = orgId || profile.organisation_id
      email = email || profile.email
      const parts = (profile.full_name || '').trim().split(/\s+/).filter(Boolean)
      firstName = parts[0] || null
      lastName = parts.slice(1).join(' ') || null
    }
  }

  if (!orgId || !email) return
  const emailLc = email.trim().toLowerCase()

  // Don't demote an existing paying customer into a "lead".
  const { data: payingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('organisation_id', orgId)
    .ilike('email', emailLc)
    .maybeSingle()
  if (payingProfile?.id) {
    const { count: activeSubs } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', payingProfile.id)
      .in('status', ['active', 'trialing'])
    if ((activeSubs || 0) > 0) return
  }

  // Dedup against an existing open lead.
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('organisation_id', orgId)
    .ilike('email', emailLc)
    .not('status', 'in', '(enrolled,lost)')
    .limit(1)
    .maybeSingle()
  if (existingLead?.id) return

  const { error: leadInsErr } = await supabase.from('leads').insert({
    organisation_id: orgId,
    first_name: firstName || 'Prospect',
    last_name: lastName,
    email: emailLc,
    child_name: childName,
    source: 'abandoned_checkout',
    status: 'new',
    notes: "Started checkout but didn't complete payment — worth a friendly follow-up.",
  })
  if (leadInsErr) throw new Error(`leads.insert failed: ${leadInsErr.message}`)
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
      const { data: booking, error: campUpdErr } = await supabase
        .from('camp_bookings')
        .update({ payment_status: 'paid', stripe_session_id: session.id })
        .eq('id', session.metadata.camp_booking_id)
        .select('organisation_id, parent_email, child_name, amount_paid, camp_id')
        .maybeSingle()
      if (campUpdErr) throw new Error(`camp_bookings.update failed: ${campUpdErr.message}`)

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
          const { error: campPayErr } = await supabase.from('payments').insert({
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
          // 23505 = unique violation on stripe_session_id (partial unique
          // index from migration 069). Means a prior delivery of this same
          // Stripe event already inserted the camp payment row; treat as
          // success and continue so Stripe stops retrying. Camps remain
          // one-off `mode='payment'` charges — no subscription is involved
          // here. Same pattern as the tonight_then_sub guard.
          if (campPayErr && (campPayErr as { code?: string }).code !== '23505') {
            throw new Error(`camp payments.insert failed: ${campPayErr.message}`)
          }
        }
      }
    }
    return
  }

  // ─── Stage 3 session-bridge: bridge charged + sub trials until anchor ───
  // The subscribe route ran Checkout in mode=subscription with a one-time
  // bridge line item + trial_end=anchor. Bridge already charged at checkout.
  // Stripe will auto-transition the sub from trialing → active on the anchor
  // and fire the first full monthly invoice. We just need to insert the local
  // sub + enrolment rows; existing invoice.payment_succeeded handler picks up
  // the renewal automatically.
  if (session.metadata?.pp_flow === 'future_session_bridge' && session.mode === 'subscription') {
    const m = session.metadata
    const userId = m.supabase_user_id
    const planId = m.supabase_plan_id
    const playerId = m.supabase_player_id || null
    const classId = m.supabase_class_id || null
    const activatesOn = m.activates_on
    if (!userId || !planId || !activatesOn) {
      console.error('future_session_bridge: missing required metadata')
      return
    }

    const stripeSubId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id || null
    const customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id || null

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('organisation_id')
      .eq('id', planId)
      .single()
    const orgId = plan?.organisation_id || null
    if (!orgId) {
      console.error(`future_session_bridge: plan ${planId} has no organisation_id`)
      return
    }

    // Read the actual subscription to get its true status (trialing/active).
    let stripeSubStatus = 'trialing'
    if (stripeSubId) {
      try {
        const sub = await stripe.subscriptions.retrieve(stripeSubId)
        stripeSubStatus = sub.status
      } catch (e) {
        console.error(`future_session_bridge: could not retrieve sub ${stripeSubId}`, e instanceof Error ? e.message : e)
      }
    }

    const { error: subInsErr } = await supabase.from('subscriptions').insert({
      parent_id: userId,
      player_id: playerId,
      plan_id: planId,
      organisation_id: orgId,
      status: stripeSubStatus,
      start_date: activatesOn,
      stripe_subscription_id: stripeSubId,
      stripe_customer_id: customerId,
      ...(classId ? { training_group_id: classId } : {}),
    })
    if (subInsErr && (subInsErr as { code?: string }).code !== '23505') {
      throw new Error(`future_session_bridge subscriptions.insert failed: ${subInsErr.message}`)
    }

    // Auto-enrol with status='active'. The booking gate at
    // api/enrolments/book/route.ts enforces activates_on > today as the gate;
    // status='active' is correct here because the parent has paid the bridge
    // and made a commitment.
    if (classId && playerId) {
      const { data: existingEnrolment } = await supabase
        .from('enrolments')
        .select('id')
        .eq('player_id', playerId)
        .eq('group_id', classId)
        .maybeSingle()
      if (!existingEnrolment) {
        const { error: enrolErr } = await supabase.from('enrolments').insert({
          player_id: playerId,
          group_id: classId,
          status: 'active',
          organisation_id: orgId,
          activates_on: activatesOn,
        })
        if (enrolErr && (enrolErr as { code?: string }).code !== '23505') {
          throw new Error(`future_session_bridge enrolments.insert failed: ${enrolErr.message}`)
        }
      }
    }

    // ─── Emails: parent + org admins ───
    // Parent gets bridge-aware subscriptionStartedEmail (explains "Today you
    // paid £X for N sessions / £Y/month from the 1st"). Org admins get
    // newSignupAdminEmail. Both wrapped in try/catch so email failures
    // never break the webhook.
    try {
      await sendSignupEmails(supabase, {
        userId,
        playerId,
        classId,
        orgId,
        planId,
        activatesOn,
        billingModel: 'future_session_bridge',
        bridgePence: Number(m.bridge_pence) || 0,
        bridgeSessionsRemaining: Number(m.bridge_sessions_remaining) || 0,
      })
    } catch (e) {
      console.error('future_session_bridge: post-signup emails failed:', e instanceof Error ? e.message : e)
    }

    return
  }

  // ─── Stage 3: future-start (SetupIntent mode) ───
  // The subscribe route ran Checkout in SETUP mode (£0 today, card saved).
  // We write a subscriptions row with status='scheduled' + start_date +
  // stripe_setup_intent_id. The activation cron at
  // /api/cron/activate-scheduled-subs runs daily and creates the real Stripe
  // subscription when start_date <= today.
  if (session.metadata?.pp_flow === 'future_prorated' && session.mode === 'setup') {
    const m = session.metadata
    const userId = m.supabase_user_id
    const planId = m.supabase_plan_id
    const playerId = m.supabase_player_id || null
    const classId = m.supabase_class_id || null
    const activatesOn = m.activates_on
    if (!userId || !planId || !activatesOn) {
      console.error('future_prorated: missing required metadata')
      return
    }

    const setupIntentId = typeof session.setup_intent === 'string'
      ? session.setup_intent
      : session.setup_intent?.id || null
    const customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id || null

    // Plan + org for organisation_id
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('organisation_id')
      .eq('id', planId)
      .single()
    const orgId = plan?.organisation_id || null
    if (!orgId) {
      console.error(`future_prorated: plan ${planId} has no organisation_id`)
      return
    }

    // Subscription row in 'scheduled' state. The activation cron picks this up.
    // Idempotency: if a row already exists for this stripe_setup_intent_id
    // (e.g. Stripe retry), the partial unique index on stripe_subscription_id
    // doesn't apply (column is null), so we rely on stripe_setup_intent_id
    // uniqueness check at the DB layer (added in migration 071 if needed).
    // For now, check existing row by setup_intent_id before insert.
    if (setupIntentId) {
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_setup_intent_id', setupIntentId)
        .maybeSingle()
      if (existing) {
        // Idempotent: already recorded this signup
        return
      }
    }

    const { error: subInsErr } = await supabase.from('subscriptions').insert({
      parent_id: userId,
      player_id: playerId,
      plan_id: planId,
      organisation_id: orgId,
      status: 'scheduled',
      start_date: activatesOn,
      stripe_setup_intent_id: setupIntentId,
      stripe_customer_id: customerId,
      // Persist the class id on the sub so the activation cron can find
      // the matching pending enrolment unambiguously (a parent could have
      // multiple pending enrolments with the same activates_on).
      ...(classId ? { training_group_id: classId } : {}),
    })
    if (subInsErr && (subInsErr as { code?: string }).code !== '23505') {
      throw new Error(`future_prorated subscriptions.insert failed: ${subInsErr.message}`)
    }

    // Auto-enrol the player at the chosen class. Stage 3 writes 'pending'
    // (not 'active') so existing WHERE status='active' queries (admin
    // active-member counts, coach activity metrics, MRR widgets) correctly
    // exclude future-start customers until the cron flips them to 'active'
    // on start_date. The booking gate (/api/enrolments/book/route.ts) also
    // enforces activates_on as defense in depth.
    if (classId && playerId) {
      const { data: existingEnrolment } = await supabase
        .from('enrolments')
        .select('id')
        .eq('player_id', playerId)
        .eq('group_id', classId)
        .maybeSingle()
      if (!existingEnrolment) {
        const { error: enrolErr } = await supabase.from('enrolments').insert({
          player_id: playerId,
          group_id: classId,
          status: 'pending',
          organisation_id: orgId,
          activates_on: activatesOn,
        })
        if (enrolErr && (enrolErr as { code?: string }).code !== '23505') {
          throw new Error(`future_prorated enrolments.insert failed: ${enrolErr.message}`)
        }
      }
    }

    // ─── Emails: parent + org admins ───
    // Parent gets scheduledSignupConfirmationEmail (the new "card saved /
    // first charge on <date>" template). Stripe sends no receipt for setup
    // mode so this is the only confirmation the parent gets between checkout
    // and the cron's activation. Org admins get newSignupAdminEmail.
    try {
      await sendSignupEmails(supabase, {
        userId,
        playerId,
        classId,
        orgId,
        planId,
        activatesOn,
        billingModel: 'future_prorated',
      })
    } catch (e) {
      console.error('future_prorated: post-signup emails failed:', e instanceof Error ? e.message : e)
    }

    return
  }

  // ─── "Pay tonight + sub from 1st" — TWO-STEP MONTHLY FLOW ───
  // The subscribe route ran Checkout in PAYMENT mode for tonight's session
  // (the one-off) and saved the card via setup_future_usage. We now create
  // the recurring subscription via API with trial_end = 1st of next month so
  // the first £X charge lands then. This is the "pay tonight, term from
  // next month" model the user picked.
  if (session.metadata?.pp_flow === 'tonight_then_sub') {
    const m = session.metadata
    const userId = m.supabase_user_id
    const planId = m.supabase_plan_id
    const playerId = m.supabase_player_id || null
    const classId = m.supabase_class_id || null
    const recurringPriceId = m.stripe_recurring_price_id
    const connectedAcct = m.stripe_connected_account || null
    const platformFeePercent = Number(m.platform_fee_percent || 0)
    const trialEndUnix = Number(m.sub_trial_end_unix || 0)
    const siblingCouponId = m.sibling_coupon_id || null
    const tonightAmount = (session.amount_total ?? 0) / 100
    const nowIso = new Date().toISOString()

    if (!userId || !planId || !recurringPriceId || !trialEndUnix) {
      console.error('tonight_then_sub: missing required metadata')
      return
    }

    // Get profile + plan + org for downstream emails & sub creation
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, organisation_id, stripe_customer_id')
      .eq('id', userId)
      .single()
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('id, name, organisation_id')
      .eq('id', planId)
      .single()
    const orgId = profile?.organisation_id || plan?.organisation_id || null
    const { data: org } = orgId
      ? await supabase.from('organisations').select('name, slug, logo_url, contact_email').eq('id', orgId).single()
      : { data: null }
    const organisationName = (org?.name as string | undefined) || 'Your Academy'

    // 1. Record tonight's one-off payment
    if (tonightAmount > 0) {
      const { error: tonightPayErr } = await supabase.from('payments').insert({
        parent_id: userId,
        player_id: playerId,
        organisation_id: orgId,
        amount: tonightAmount,
        amount_paid: tonightAmount,
        status: 'paid',
        stripe_session_id: session.id,
        description: plan?.name ? `First session — ${plan.name}` : 'First session',
        due_date: nowIso.split('T')[0],
        paid_date: nowIso.split('T')[0],
        created_at: nowIso,
      })
      // 23505 = unique violation on stripe_session_id (partial unique index
      // added by migration 069). Means another delivery of this same Stripe
      // event already wrote the payment row; safe to treat as success and
      // continue. Without this guard, Stripe retries of any event whose
      // payment row was previously inserted (by an earlier successful
      // delivery, a manual replay, or a partial-success retry) throw 500
      // forever, blocking the handler from ever completing.
      if (tonightPayErr && (tonightPayErr as { code?: string }).code !== '23505') {
        throw new Error(`tonight payments.insert failed: ${tonightPayErr.message}`)
      }
    }

    // 2. Pull the saved payment method off the PaymentIntent so the upcoming
    //    subscription can charge off-session on the 1st.
    let savedPaymentMethod: string | null = null
    if (session.payment_intent) {
      try {
        const pi = await stripe.paymentIntents.retrieve(
          typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id
        )
        savedPaymentMethod = (pi.payment_method as string | null) || null
      } catch (e) {
        console.error('tonight_then_sub: could not retrieve PI for saved PM:', e)
      }
    }

    // 3. Create the actual recurring subscription with trial_end = 1st of next month
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id || profile?.stripe_customer_id
    if (!customerId) {
      console.error('tonight_then_sub: no customer id; aborting subscription create')
      return
    }

    let createdSub: Stripe.Subscription | null = null
    try {
      createdSub = await stripe.subscriptions.create(
        {
          customer: customerId,
          items: [{ price: recurringPriceId }],
          trial_end: trialEndUnix,
          ...(savedPaymentMethod ? { default_payment_method: savedPaymentMethod } : {}),
          ...(siblingCouponId ? { discounts: [{ coupon: siblingCouponId }] } : {}),
          // on_behalf_of brands future renewals with the academy's Stripe
          // account name (matches the tonight payment's Checkout branding,
          // so receipts stay consistent month-to-month).
          ...(connectedAcct
            ? {
                on_behalf_of: connectedAcct,
                ...(platformFeePercent > 0 ? { application_fee_percent: platformFeePercent } : {}),
                transfer_data: { destination: connectedAcct },
              }
            : {}),
          metadata: {
            supabase_plan_id: planId,
            supabase_user_id: userId,
            supabase_player_id: playerId || '',
            billing_model: 'tonight_then_sub',
            ...(classId ? { supabase_class_id: classId } : {}),
          },
        },
        {
          // Stripe stores this key for 24h. If the same checkout.session.completed
          // event is re-delivered (Stripe retry, or our own retry-on-500), Stripe
          // returns the EXISTING subscription instead of creating a second one
          // and double-charging the parent. Single biggest defence against
          // duplicate-charge customer harm.
          idempotencyKey: `sub_create_${session.id}`,
        }
      )
    } catch (e) {
      // The tonight payment IS in the bank — just the recurring couldn't be
      // created. Re-throw so the top-level handler returns 500 and Stripe
      // retries (idempotency key above means the retry is safe).
      console.error('tonight_then_sub: subscription create failed:', e)
      throw e
    }

    // 4. Save subscription to our DB
    if (createdSub) {
      const sub = createdSub as Stripe.Subscription & { current_period_start?: number; current_period_end?: number }
      const { error: tonightSubErr } = await supabase.from('subscriptions').insert({
        parent_id: userId,
        player_id: playerId,
        plan_id: planId,
        status: sub.status || 'trialing',
        stripe_subscription_id: sub.id,
        stripe_customer_id: customerId,
        organisation_id: orgId,
        ...(sub.current_period_start ? { current_period_start: new Date(sub.current_period_start * 1000).toISOString() } : {}),
        ...(sub.current_period_end ? { current_period_end: new Date(sub.current_period_end * 1000).toISOString() } : {}),
      })
      // 23505 = unique violation. Means another delivery beat us. Safe to ignore.
      if (tonightSubErr && (tonightSubErr as { code?: string }).code !== '23505') {
        throw new Error(`tonight subscriptions.insert failed: ${tonightSubErr.message}`)
      }

      // Auto-enrol player in the class
      if (classId && playerId) {
        const { data: existing } = await supabase
          .from('enrolments')
          .select('id')
          .eq('player_id', playerId)
          .eq('group_id', classId)
          .maybeSingle()
        if (!existing) {
          // Stage 1: capture activates_on from session metadata so the booking
          // gate can enforce it. Falls back to today if the picker wasn't on
          // the form yet (defensive — never NULL after migration 070).
          const tonightActivatesOn =
            typeof session.metadata?.activates_on === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(session.metadata.activates_on)
              ? session.metadata.activates_on
              : new Date().toISOString().split('T')[0]
          const { error: tonightEnrolErr } = await supabase.from('enrolments').insert({
            player_id: playerId,
            group_id: classId,
            status: 'active',
            organisation_id: orgId,
            activates_on: tonightActivatesOn,
          })
          if (tonightEnrolErr && (tonightEnrolErr as { code?: string }).code !== '23505') {
            throw new Error(`tonight enrolments.insert failed: ${tonightEnrolErr.message}`)
          }
        }
      }

      // Auto-convert any matching lead to 'enrolled'
      await convertLeadToEnrolled(orgId, profile?.email)
    }

    // 5. Send emails — receipt for tonight + "you're in" + first sale alert if applicable
    if (profile?.email) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
        const dateLabel = new Date().toLocaleDateString('en-GB')

        // Receipt for tonight's session
        if (tonightAmount > 0) {
          await trySendReceiptEmail({
            email: profile.email,
            parentName: profile.full_name ?? 'Parent',
            amount: `£${tonightAmount.toFixed(2)}`,
            planName: plan?.name ? `First session — ${plan.name}` : 'First session',
            date: dateLabel,
            receiptId: session.id,
            academyName: organisationName,
          })
        }

        // Subscription-started welcome — sets expectations for the 1st-of-month charge
        let childName: string | undefined
        if (playerId) {
          const { data: player } = await supabase.from('players').select('first_name').eq('id', playerId).maybeSingle()
          childName = (player?.first_name as string | undefined) || undefined
        }

        const { subscriptionStartedEmail, firstSaleEmail } = await import('@/lib/email-templates')
        const { sendEmail } = await import('@/lib/email')
        const subStartedTemplate = subscriptionStartedEmail({
          parentName: profile.full_name ?? 'Parent',
          childName,
          academyName: organisationName,
          planName: plan?.name ?? 'Subscription',
          amount: `£${Number(((plan as unknown as { amount?: number })?.amount) ?? 0).toFixed(2)}`,
          dashboardUrl: `${appUrl}/dashboard`,
          academyLogoUrl: (org?.logo_url as string | undefined) || undefined,
          academyContactEmail: (org?.contact_email as string | undefined) || undefined,
        })
        await sendEmail({
          to: profile.email,
          ...subStartedTemplate,
          fromName: organisationName,
          replyTo: (org?.contact_email as string | undefined) || undefined,
        })

        // First-sale celebration to the platform admin if this was the org's
        // first paid subscription
        if (orgId) {
          const { count: priorSubs } = await supabase
            .from('subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('organisation_id', orgId)
            .in('status', ['active', 'trialing'])
            .neq('stripe_subscription_id', createdSub?.id ?? '')
          if ((priorSubs || 0) === 0) {
            const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'johnleitch970@gmail.com'
            const firstSaleTemplate = firstSaleEmail({
              academyName: organisationName,
              academySlug: (org?.slug as string | undefined) || '',
              parentName: profile.full_name ?? 'Parent',
              childName,
              planName: plan?.name ?? 'Subscription',
              amount: `£${Number(((plan as unknown as { amount?: number })?.amount) ?? 0).toFixed(2)}`,
              dashboardUrl: appUrl,
            })
            await sendEmail({ to: adminEmail, ...firstSaleTemplate })
          }
        }
      } catch (err) {
        console.error('tonight_then_sub: post-payment emails failed:', err)
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
      const { error: platformOrgErr } = await supabase
        .from('organisations')
        .update({
          platform_subscription_status: 'active',
          platform_stripe_subscription_id: subId,
          ...(planId ? { platform_plan_id: planId } : {}),
          is_published: true, // hybrid: paying = academy goes live
        })
        .eq('id', orgId)
      if (platformOrgErr) throw new Error(`platform organisations.update failed: ${platformOrgErr.message}`)
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

    const { error: migSubErr } = await supabase
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
    if (migSubErr) throw new Error(`migration subscriptions.update failed: ${migSubErr.message}`)

    // Itemised payment row. £0 today (trial_end / prepaid migration) records
    // nothing now — the first real charge lands later via invoice.payment_succeeded.
    const amount = (session.amount_total ?? 0) / 100
    if (migSub?.parent_id && migSub.organisation_id && amount > 0) {
      let planName = 'Subscription'
      if (migSub.plan_id) {
        const { data: pl } = await supabase.from('subscription_plans').select('name').eq('id', migSub.plan_id).maybeSingle()
        if (pl?.name) planName = pl.name as string
      }
      const { error: migPayErr } = await supabase.from('payments').insert({
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
      if (migPayErr && (migPayErr as { code?: string }).code !== '23505') {
        throw new Error(`migration payments.insert failed: ${migPayErr.message}`)
      }
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
    const { error: trialBookingErr } = await supabase.from('trial_bookings').insert({
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
    if (trialBookingErr) throw new Error(`trial_bookings.insert failed: ${trialBookingErr.message}`)
    return
  }

  const ctx = await resolveSessionContext(session)
  const amountPaid = (session.amount_total ?? 0) / 100
  const now = new Date().toISOString()

  // 1. Record / update payment — itemised line on the parent's billing page.
  // NOTE: the payments table uses parent_id (NOT profile_id) and has no
  // subscription_plan_id column. The plan is captured in `description`.
  if (ctx.userId) {
    const { error: genPayErr } = await supabase.from('payments').insert({
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
    if (genPayErr && (genPayErr as { code?: string }).code !== '23505') {
      throw new Error(`generic payments.insert failed: ${genPayErr.message}`)
    }
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
      const { error: genSubUpdErr } = await supabase
        .from('subscriptions')
        .update({
          status: stripeSub.status,
          current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
          updated_at: now,
        })
        .eq('id', existing.id)
      if (genSubUpdErr) throw new Error(`generic subscriptions.update failed: ${genSubUpdErr.message}`)
    } else {
      const { error: genSubInsErr } = await supabase.from('subscriptions').insert({
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
      if (genSubInsErr && (genSubInsErr as { code?: string }).code !== '23505') {
        throw new Error(`generic subscriptions.insert failed: ${genSubInsErr.message}`)
      }
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
        const { error: genEnrolErr } = await supabase.from('enrolments').insert({
          player_id: ctx.playerId,
          group_id: ctx.classId,
          status: 'active',
          organisation_id: ctx.orgId,
          // Stage 1: parent's chosen start date. Booking gate enforces this is
          // <= the session date being booked. For immediate-prorated signups
          // this equals today; for sub_from_1st (no session this month) this
          // is also today; for future-start signups (Stage 3) this is in the
          // future and the parent cannot book anything before this date.
          activates_on: ctx.activatesOn,
        })
        if (genEnrolErr && (genEnrolErr as { code?: string }).code !== '23505') {
          throw new Error(`generic enrolments.insert failed: ${genEnrolErr.message}`)
        }
      }
    }
  }

  // 2b. Auto-convert the matching lead now that they've actually paid.
  if (session.mode === 'subscription') {
    await convertLeadToEnrolled(ctx.orgId, ctx.profile?.email)
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

      const { subscriptionStartedEmail, firstSaleEmail, newSignupAdminEmail } = await import('@/lib/email-templates')
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

      // \u2500\u2500 Bridge-aware billing context for the parent email \u2500\u2500
      // immediate_prorated => "prorated" variant ("Today you paid \u00a3X pro-rata
      // to <anchor>, then \u00a3Y/month from the 1st").
      // Other monthly subscription_modes fall through to the legacy panel.
      const billingModel = session.metadata?.billing_model
      const monthlyAmountNum = Number((ctx.plan as unknown as { amount?: number })?.amount ?? amountPaid)
      const monthlyAmount = `\u00a3${monthlyAmountNum.toFixed(2)}`
      const activatesOnIso = (session.metadata?.activates_on as string | undefined)
        || new Date().toISOString().slice(0, 10)
      const anchorLabel = anchorLabelFor(activatesOnIso)
      const billingContext = billingModel === 'immediate_prorated'
        ? { kind: 'prorated' as const, anchorLabel, monthlyAmount }
        : undefined

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
        billingContext,
      })
      const { sendEmail } = await import('@/lib/email')
      await sendEmail({ to: ctx.profile.email, ...template })

      // \u2500\u2500 ORG ADMINS: notify on EVERY signup (P1 \u2014 every signup, not just first) \u2500\u2500
      // Distinct from firstSaleEmail below, which still fires once on the
      // org's very first paid sub but goes to the PLATFORM admin.
      try {
        const { data: orgAdmins } = await supabase
          .from('profiles')
          .select('email')
          .eq('organisation_id', ctx.orgId)
          .eq('role', 'admin')
        if (orgAdmins && orgAdmins.length > 0) {
          const billingModelLabel = billingModel === 'immediate_prorated'
            ? `Today \u2014 \u00a3${amountPaid.toFixed(2)} pro-rata to ${anchorLabel}, then ${monthlyAmount}/mo`
            : `${monthlyAmount}/month subscription started`
          const adminTpl = newSignupAdminEmail({
            academyName: ctx.organisationName ?? 'Academy',
            parentName: ctx.profile.full_name ?? 'Parent',
            parentEmail: ctx.profile.email,
            childName,
            planName: ctx.plan.name,
            amount: monthlyAmount,
            billingModelLabel,
            activatesOnLabel: formatLongDate(activatesOnIso),
            dashboardUrl: appUrl,
          })
          for (const a of orgAdmins as { email: string | null }[]) {
            if (a.email) {
              await sendEmail({ to: a.email, ...adminTpl, fromName: ctx.organisationName ?? 'Player Portal' })
            }
          }
        }
      } catch (e) {
        console.error('Org-admin new-signup email failed:', e instanceof Error ? e.message : e)
      }

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
    const { error: renewalSubErr } = await supabase
      .from('subscriptions')
      .update({ status: 'active', updated_at: now })
      .eq('id', localSub.id)
    if (renewalSubErr) throw new Error(`renewal subscriptions.update failed: ${renewalSubErr.message}`)
  }

  // Record payment — itemised line on the parent's billing page.
  // (payments uses parent_id, NOT profile_id, and has no subscription_plan_id.)
  if (localSub?.parent_id) {
    const renewalPlanName = (localSub.plan as unknown as { name?: string } | null)?.name
    const { error: renewalPayErr } = await supabase.from('payments').insert({
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
    if (renewalPayErr && (renewalPayErr as { code?: string }).code !== '23505') {
      throw new Error(`renewal payments.insert failed: ${renewalPayErr.message}`)
    }

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
    const { error: pdSubErr } = await supabase
      .from('subscriptions')
      .update({ status: 'past_due', updated_at: now })
      .eq('id', localSub.id)
    if (pdSubErr) throw new Error(`past_due subscriptions.update failed: ${pdSubErr.message}`)
  }

  // Mark any pending payment for this parent as overdue.
  // (payments uses parent_id, not profile_id; no subscription_plan_id column.)
  if (localSub?.parent_id) {
    const { error: odPayErr } = await supabase
      .from('payments')
      .update({ status: 'overdue', updated_at: now })
      .eq('parent_id', localSub.parent_id)
      .eq('organisation_id', localSub.organisation_id)
      .eq('status', 'pending')
    if (odPayErr) throw new Error(`overdue payments.update failed: ${odPayErr.message}`)
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

      // ── Day 2: PARENT failed-payment recovery email ──
      // Gate on attempt_count === 1 so the parent gets ONE email per failed
      // billing period, not one per Stripe Smart-Retries attempt (which would
      // spam the same person 4 times over 7 days). Webhook-level idempotency
      // upstream prevents duplicate-event re-runs of the handler itself.
      const attemptCount = (invoice as Stripe.Invoice & { attempt_count?: number }).attempt_count ?? 1
      const parentEmail = parentProfile?.email as string | undefined
      if (attemptCount === 1 && parentEmail) {
        // Pull a recovery URL from Stripe. hosted_invoice_url goes to a
        // Stripe-hosted page where the customer updates their card and the
        // invoice auto-retries — no Player Portal auth needed. This is the
        // canonical Stripe-recommended recovery path.
        const updateUrl = (invoice as Stripe.Invoice & { hosted_invoice_url?: string | null }).hosted_invoice_url
          || `${appUrl}/dashboard/payments`

        // Pull the failure reason from the invoice's last finalization error,
        // or from the latest charge's failure_message when available. Best-effort.
        let failureReason: string | null = null
        const finErr = (invoice as Stripe.Invoice & { last_finalization_error?: { message?: string } }).last_finalization_error
        if (finErr?.message) failureReason = finErr.message
        if (!failureReason) {
          const chargeId = typeof (invoice as Stripe.Invoice & { charge?: string | Stripe.Charge }).charge === 'string'
            ? (invoice as Stripe.Invoice & { charge?: string }).charge
            : ((invoice as Stripe.Invoice & { charge?: Stripe.Charge }).charge as Stripe.Charge | undefined)?.id
          if (chargeId) {
            try {
              const charge = await stripe.charges.retrieve(chargeId)
              failureReason = charge.failure_message || charge.outcome?.seller_message || null
            } catch (chErr) {
              console.error('Failed to fetch charge for failure reason:', chErr)
            }
          }
        }

        // Brand the parent email with the academy's colour when available.
        const { data: orgBranding } = await supabase
          .from('organisations')
          .select('primary_color')
          .eq('id', localSub.organisation_id)
          .maybeSingle()
        const accentColor = (orgBranding?.primary_color as string | undefined) || '#f59e0b'

        const { paymentFailedParentEmail } = await import('@/lib/email-templates')
        const parentTpl = paymentFailedParentEmail({
          academyName: (orgInfo?.name as string | undefined) || 'your academy',
          parentName: (parentProfile?.full_name as string | undefined)?.split(' ')[0] || 'there',
          childName,
          planName: (plan?.name as string | undefined) || 'Subscription',
          amount: `£${amountFailed.toFixed(2)}`,
          failureReason,
          updatePaymentUrl: updateUrl,
          dashboardUrl: appUrl,
          accentColor,
        })

        try {
          await sendEmail({
            to: parentEmail,
            ...parentTpl,
            fromName: (orgInfo?.name as string | undefined) || undefined,
          })
        } catch (parentSendErr) {
          console.error('Payment failed PARENT email failed:', parentSendErr)
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
    const { error: platCancelErr } = await supabase
      .from('organisations')
      .update({
        platform_subscription_status: 'cancelled',
        platform_stripe_subscription_id: null,
      })
      .eq('id', platformOrg.id)
    if (platCancelErr) throw new Error(`platform cancel organisations.update failed: ${platCancelErr.message}`)
    return
  }

  const { data: localSub } = await supabase
    .from('subscriptions')
    .select('id, parent_id, plan_id, organisation_id')
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle()

  // Mark as cancelled
  const { error: cancelSubErr } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: now,
      updated_at: now,
    })
    .eq('stripe_subscription_id', stripeSubId)
  if (cancelSubErr) throw new Error(`cancel subscriptions.update failed: ${cancelSubErr.message}`)

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

    // ─── Cascade: deactivate child enrolments if this was the parent's
    // last active subscription. Without this, the child stays in the
    // attendance register and the class fill heatmap forever — but they've
    // stopped paying. We PAUSE rather than hard-cancel so the admin can
    // re-activate without losing history, and we alert every org admin
    // so they can chase / confirm.
    const { data: otherSubs } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('parent_id', localSub.parent_id)
      .in('status', ['active', 'trialing', 'past_due'])
      .neq('id', localSub.id)

    const hasOtherActiveSubs = (otherSubs?.length || 0) > 0

    if (!hasOtherActiveSubs && localSub.organisation_id) {
      const { data: kids } = await supabase
        .from('players')
        .select('id, first_name, last_name')
        .eq('parent_id', localSub.parent_id)
        .eq('organisation_id', localSub.organisation_id)

      type KidRow = { id: string; first_name: string; last_name: string }
      const kidRows = (kids as unknown as KidRow[] | null) || []
      const kidIds = kidRows.map((k) => k.id)
      if (kidIds.length > 0) {
        const { data: liveEnrolments } = await supabase
          .from('enrolments')
          .select('id, player_id, group:training_groups(name)')
          .in('player_id', kidIds)
          .eq('status', 'active')

        if ((liveEnrolments || []).length > 0) {
          const { error: pauseEnrolErr } = await supabase
            .from('enrolments')
            .update({ status: 'paused' })
            .in('player_id', kidIds)
            .eq('status', 'active')
          if (pauseEnrolErr) throw new Error(`pause enrolments.update failed: ${pauseEnrolErr.message}`)

          const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('organisation_id', localSub.organisation_id)
            .eq('role', 'admin')

          const kidsByName: Record<string, string> = {}
          for (const k of kidRows) {
            kidsByName[k.id] = `${k.first_name} ${k.last_name}`.trim()
          }
          type EnrRow = { player_id: string; group: { name?: string } | null }
          const enrolmentSummary = (liveEnrolments as unknown as EnrRow[])
            .map(e => `${kidsByName[e.player_id] || 'Child'} — ${e.group?.name || 'class'}`)
            .join('; ')

          for (const a of admins || []) {
            await createNotification({
              profileId: a.id as string,
              organisationId: localSub.organisation_id,
              type: 'subscription',
              title: 'Subscription ended — enrolments paused',
              body: `A parent's subscription ended so we paused their enrolments: ${enrolmentSummary}. Review in Enrolments to confirm.`,
              link: '/dashboard/enrolments',
            })
          }
        }
      }
    }
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
    const { error: platUpdErr } = await supabase
      .from('organisations')
      .update({ platform_subscription_status: mapped })
      .eq('id', platformOrg.id)
    if (platUpdErr) throw new Error(`platform organisations.update failed: ${platUpdErr.message}`)
    return
  }

  // Cast to access period fields that vary by Stripe API version
  const sub = subscription as Stripe.Subscription & {
    current_period_start: number
    current_period_end: number
  }

  const { error: updSubErr } = await supabase
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
  if (updSubErr) throw new Error(`update subscriptions.update failed: ${updSubErr.message}`)

}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

function handlerFor(eventType: string): string {
  return ({
    'checkout.session.completed': 'handleCheckoutCompleted',
    'checkout.session.expired': 'handleCheckoutExpired',
    'invoice.payment_succeeded': 'handleInvoicePaymentSucceeded',
    'invoice.payment_failed': 'handleInvoicePaymentFailed',
    'customer.subscription.deleted': 'handleSubscriptionDeleted',
    'customer.subscription.updated': 'handleSubscriptionUpdated',
  } as Record<string, string>)[eventType] || 'unhandled'
}

export async function POST(request: NextRequest) {
  ensureClients()

  // ─── KILL SWITCH ───
  // Emergency hatch — set STRIPE_WEBHOOK_DISABLED=true in Vercel env to make
  // the handler return 200 + skip processing. Use only to break a Stripe
  // retry loop while deploying a fix. Stripe will mark events delivered and
  // NOT retry; failures during this window must be reconciled manually.
  if (process.env.STRIPE_WEBHOOK_DISABLED === 'true') {
    console.warn('[webhook] disabled via STRIPE_WEBHOOK_DISABLED env var')
    return NextResponse.json({ received: true, disabled: true })
  }

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

  // ─── IDEMPOTENCY: short-circuit on already-processed event ───
  const handlerName = handlerFor(event.type)
  const decision = await shouldProcessEvent(supabase, event, handlerName)
  if (!decision.proceed) {
    if (decision.retryStripe) {
      // The check itself failed (transient DB issue). Return 500 so Stripe
      // retries — by the time it retries, the DB blip should be resolved
      // and the event will process normally.
      console.error(`[webhook] shouldProcessEvent failed for ${event.id} (${event.type}); returning 500 to trigger retry`)
      return NextResponse.json(
        { error: 'Idempotency check failed; will retry' },
        { status: 500 }
      )
    }
    // Already-success or race-lost. Return 200 — no processing needed.
    return NextResponse.json({
      received: true,
      idempotent: true,
      reason: decision.reason,
    })
  }

  // ─── DISPATCH ───
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'checkout.session.expired':
        await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session)
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
        // Unhandled event type — still mark success so Stripe doesn't retry
        // forever for events we explicitly don't care about.
        break
    }
    await markEventSuccess(supabase, event.id)
    return NextResponse.json({ received: true })
  } catch (err) {
    await markEventError(supabase, event.id, err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[webhook] ${event.type} (${event.id}) failed:`, message)
    // ─── KEY CHANGE FROM OLD BEHAVIOUR ───
    // Return 500 so Stripe retries with exponential backoff. Previously we
    // returned 200 here, which permanently lost every silently-failing event.
    return NextResponse.json(
      { error: 'Processing failed; will retry' },
      { status: 500 }
    )
  }
}
