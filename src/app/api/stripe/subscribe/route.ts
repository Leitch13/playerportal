import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { mapStripeCheckoutError } from '@/lib/stripe-errors'
import { isStartDateBillingEnabled, isFutureStartBillingEnabled } from '@/lib/billing/flag'
import { isQuarterlyEnabledForOrg, QUARTERLY_UNAVAILABLE_MESSAGE } from '@/lib/quarterly-billing'
import { feePercentFromRate } from '@/lib/stripe-fee'
import { isConnectChargeReady, CONNECT_NOT_READY_MESSAGE } from '@/lib/connect-readiness'
import {
  firstOfNextMonthUnix,
  isStartInCurrentMonth,
  isStartTodayOrEarlier,
} from '@/lib/billing/anchor'

// Returns Unix timestamp for the 1st of next month at midnight UTC
function getFirstOfNextMonth(): number {
  const now = new Date()
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return Math.floor(nextMonth.getTime() / 1000)
}

// Returns Unix timestamp for the 1st of the month AFTER the given date.
// Used when a parent's first session is in a future month — the next billing anchor
// should be the month after the first session, since the first session's month is
// already paid for in the upfront charge.
function getFirstOfMonthAfter(date: Date): number {
  const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  return Math.floor(nextMonth.getTime() / 1000)
}

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Given a day-of-week label (e.g. "Monday"), returns the JS date of the next
// occurrence of that day from today, in UTC. Returns null if the label is unrecognised.
function nextOccurrenceOfDayOfWeek(dayOfWeek: string | null | undefined): Date | null {
  if (!dayOfWeek) return null
  const targetIdx = DAYS_OF_WEEK.indexOf(dayOfWeek.toLowerCase())
  if (targetIdx === -1) return null
  const now = new Date()
  const todayIdx = now.getUTCDay()
  let daysAhead = (targetIdx - todayIdx + 7) % 7
  if (daysAhead === 0) daysAhead = 7 // if today matches the target, schedule a week ahead
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead))
  return next
}

// ── Quarterly Recurring (Phase 1A) — deterministic forever coupon for the
// quarterly saving, get-or-created exactly like the sibling/retention coupons.
// Stable id keyed on the percent so the same coupon is reused across academies
// and renewals; applying it via `discounts` re-applies the % to every 3-month
// invoice. Percent-off only (no schema, no new Product). ──
function quarterlyCouponId(percent: number): string {
  return `pp-quarterly-${Math.round(percent)}pct-forever`
}
async function getOrCreateQuarterlyCoupon(percent: number, organisationId: string): Promise<string> {
  const id = quarterlyCouponId(percent)
  try {
    const existing = await stripe.coupons.retrieve(id)
    if (existing && !(existing as { deleted?: boolean }).deleted) return existing.id
  } catch (e) {
    if (e instanceof Stripe.errors.StripeError && e.code !== 'resource_missing') throw e
  }
  const coupon = await stripe.coupons.create({
    id,
    name: id,
    percent_off: percent,
    duration: 'forever',
    metadata: { organisation_id: organisationId, type: 'quarterly' },
  })
  return coupon.id
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // billingOption: 'monthly' (default) or 'quarterly' (3 months, 10% off)
    // classId (optional): if provided, the player will be auto-enrolled in that class on first payment
    // firstSessionDate (optional, ISO date string): for 1-2-1 / 2-1 / intensity, the parent's chosen
    //   first session date. If provided and falls in a future month, billing shifts to "pay full
    //   month upfront, next bill on the month after first session" instead of strict pro-rata.
    // firstBillingDate (optional, ISO date string): MIGRATION mode — for parents who've already
    //   prepaid the academy (e.g. paid for June before moving to Player Portal). The card is captured
    //   now but £0 is charged today; the first real charge lands on this date (Stripe trial_end).
    //   Takes precedence over the upfront/prorated logic. Monthly only.
    // activatesOn (optional, ISO date string): parent's chosen start date from the StartDatePicker.
    //   Stage 1 ALWAYS captures it in metadata (so it's available before Stage 2 flips on).
    //   Stage 2 (behind BILLING_FLOW_STARTDATE_ENABLED flag) uses it for the new immediate_prorated
    //   billing branch. Cap matches the picker UI: today through today+28 days. Bad input → defaults
    //   to today (the picker's safe default).
    const { planId, playerId, billingOption, classId, firstSessionDate: firstSessionDateInput, firstBillingDate: firstBillingDateInput, activatesOn: activatesOnInput } = await request.json()
    if (!planId) {
      return NextResponse.json({ error: 'Missing planId' }, { status: 400 })
    }

    // Parse activatesOn defensively. Anything we can't make sense of falls back to today.
    let activatesOnDate: Date | null = null
    if (typeof activatesOnInput === 'string' && activatesOnInput.length > 0) {
      const parsed = new Date(activatesOnInput + 'T00:00:00Z')
      if (!isNaN(parsed.getTime())) {
        const todayMidnight = new Date()
        todayMidnight.setUTCHours(0, 0, 0, 0)
        const maxMs = todayMidnight.getTime() + 28 * 86400000
        // Floor to today if earlier than today; cap at today+28d.
        const ms = parsed.getTime()
        if (ms < todayMidnight.getTime()) activatesOnDate = todayMidnight
        else if (ms > maxMs) activatesOnDate = new Date(maxMs)
        else activatesOnDate = parsed
      }
    }
    if (!activatesOnDate) {
      activatesOnDate = new Date()
      activatesOnDate.setUTCHours(0, 0, 0, 0)
    }
    const activatesOnIso = activatesOnDate.toISOString().split('T')[0]

    // Parse the migration "first billing date" if provided and in the future.
    // Cap how far out it can be (anti-tamper): the date rides in the URL, so a
    // parent could edit it to defer billing indefinitely. A genuine migration
    // never needs more than ~a term of prepaid runway, so we reject anything
    // beyond 100 days. Admin-generated links are always well within this.
    let migrationTrialEnd: number | null = null
    if (firstBillingDateInput) {
      const parsed = new Date(firstBillingDateInput)
      if (!isNaN(parsed.getTime())) {
        const ts = Math.floor(parsed.getTime() / 1000)
        const nowSec = Math.floor(Date.now() / 1000)
        const maxSec = nowSec + 100 * 86400
        if (ts > maxSec) {
          return NextResponse.json(
            { error: 'First billing date is too far in the future (max 100 days).' },
            { status: 400 }
          )
        }
        // Stripe requires trial_end to be a little in the future; guard past dates.
        if (ts > nowSec + 3600) migrationTrialEnd = ts
      }
    }

    // Migration (deferred first charge) only makes sense as a recurring monthly
    // sub — quarterly is a one-time upfront payment with no trial_end, so force
    // monthly when a firstBillingDate is in play.
    const isQuarterly = billingOption === 'quarterly' && !migrationTrialEnd

    // Fetch the plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Look up the organisation's Stripe Connect account, platform plan, discounts, etc.
    const { data: planOrg } = await supabase
      .from('organisations')
      .select('stripe_account_id, platform_plan_id, sibling_discount_enabled, sibling_discount_percent, stripe_sibling_coupon_id, quarterly_billing_enabled, quarterly_discount_percent')
      .eq('id', plan.organisation_id)
      .single()

    // bridge_billing_mode (Stage 3 session enhancement) read separately
    // so this route works whether or not migration 072 has been applied.
    // If the column doesn't exist yet, we fall back to 'calendar'.
    let bridgeBillingMode = 'calendar'
    try {
      const { data: orgBridge } = await supabase
        .from('organisations')
        .select('bridge_billing_mode')
        .eq('id', plan.organisation_id)
        .single()
      if ((orgBridge as { bridge_billing_mode?: string } | null)?.bridge_billing_mode === 'session') {
        bridgeBillingMode = 'session'
      }
    } catch { /* migration 072 not applied */ }

    // sessions_per_month (Stage 3 session enhancement) read separately.
    let planSessionsPerMonth: number | null = null
    try {
      const { data: planSpm } = await supabase
        .from('subscription_plans')
        .select('sessions_per_month')
        .eq('id', planId)
        .single()
      planSessionsPerMonth = (planSpm as { sessions_per_month?: number | null } | null)?.sessions_per_month ?? null
    } catch { /* migration 072 not applied */ }

    // ── QUARTERLY ENABLEMENT GATE (server-authoritative). Quarterly is allowed
    // only for an org that passes (global flag OR allow-listed) AND has not opted
    // out. Default is OFF for EVERY academy (empty allowlist + global flag off),
    // so future academies are never auto-exposed. Fires BEFORE any Stripe object
    // is created, so a blocked quarterly request makes zero Stripe calls.
    if (isQuarterly && !isQuarterlyEnabledForOrg(plan.organisation_id, planOrg?.quarterly_billing_enabled)) {
      return NextResponse.json({ error: QUARTERLY_UNAVAILABLE_MESSAGE }, { status: 400 })
    }

    const quarterlyDiscountRate = Math.max(0, Math.min(50, Number(planOrg?.quarterly_discount_percent ?? 10))) / 100

    const connectedAccountId = planOrg?.stripe_account_id as string | null

    // ── SAFETY GATE: refuse to take payments if the academy hasn't connected Stripe ──
    // Without this, payments would silently route to the platform account instead of the academy,
    // and the academy would never see the money. Better to block at checkout with a clear message.
    if (!connectedAccountId) {
      return NextResponse.json(
        { error: 'This academy is still finishing their setup. Payments are not available yet — please check back in a day or two.' },
        { status: 503 }
      )
    }

    // CONNECT READINESS PRE-FLIGHT — presence of a connected account isn't enough:
    // it may not be able to take charges yet (charges_enabled=false / transfers
    // inactive). Block before any Stripe object is created so the parent gets a
    // friendly message instead of a raw mid-checkout error. Mirrors the proven
    // pre-flight in /api/migration/confirm-checkout. Additive — does not alter fee
    // math, on_behalf_of, or transfer_data below.
    if (!(await isConnectChargeReady(connectedAccountId))) {
      return NextResponse.json({ error: CONNECT_NOT_READY_MESSAGE }, { status: 503 })
    }

    // ════════════════════════════════════════════════════════════════
    // Capacity preflight (RPC) — Phase 1a, flag-gated.
    // Grafted from hotfix 841f97b onto day1's richer route during the
    // Batch 1 recovery merge (the wholesale cherry-pick would have
    // reverted Stage 1+2 billing, so only this block was carried over).
    //
    // When CAPACITY_RPC_ENABLED is true and a classId is present,
    // consult the SECURITY DEFINER get_group_seat_counts RPC (race-proof
    // read, same data source the production enrol_if_capacity_available
    // RPC uses internally). If the seat count is at-or-over
    // max_capacity, reject with HTTP 409 BEFORE any Stripe API call —
    // no Coupon.create, no Customer.create, no Checkout.Session.create.
    // Money never moves.
    //
    // Body shape: { error: 'class_full', count, capacity } matches the
    // live RPC's class_full jsonb so client-side parsing is shared.
    //
    // RPC failure or empty data falls through — an RPC outage cannot
    // block legitimate bookings; the new path is only ever stricter
    // than today, never more lenient.
    //
    // Flag OFF: this block is skipped entirely.
    // ════════════════════════════════════════════════════════════════
    if (classId && process.env.CAPACITY_RPC_ENABLED === 'true') {
      const { data: capGroup } = await supabase
        .from('training_groups')
        .select('max_capacity')
        .eq('id', classId)
        .single()
      const cap = Number(capGroup?.max_capacity ?? 20)
      const { data: seatRows, error: seatErr } = await supabase
        .rpc('get_group_seat_counts', { p_org_id: plan.organisation_id })
      if (seatErr) {
        console.error('[capacity-rpc][preflight] rpc_error', seatErr.message)
        // Fall through — never block legitimate bookings on RPC outage.
      } else {
        const seatRow = (seatRows ?? []).find(
          (r: { group_id: string; seat_count: number }) => r.group_id === classId
        )
        const seat = Number(seatRow?.seat_count ?? 0)
        if (cap > 0 && seat >= cap) {
          console.log('[capacity-rpc][preflight] class_full', { classId, seat, capacity: cap })
          return NextResponse.json(
            { error: 'class_full', count: seat, capacity: cap },
            { status: 409 }
          )
        }
      }
    }

    // ── Detect if this parent already has an active subscription with the academy ──
    // If they do, and the academy has sibling discount enabled, auto-apply.
    let siblingCouponId: string | null = null
    if (planOrg?.sibling_discount_enabled && Number(planOrg?.sibling_discount_percent) > 0) {
      const { count: existingActiveSubs } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', user.id)
        .eq('organisation_id', plan.organisation_id)
        .eq('status', 'active')

      if ((existingActiveSubs || 0) > 0) {
        // Get or create the Stripe coupon for this org's sibling discount
        let couponId = planOrg.stripe_sibling_coupon_id as string | null
        const discountPercent = Number(planOrg.sibling_discount_percent)

        if (!couponId) {
          const coupon = await stripe.coupons.create({
            name: `${discountPercent}% sibling discount`,
            percent_off: discountPercent,
            duration: 'forever',
            metadata: {
              organisation_id: plan.organisation_id,
              type: 'sibling_discount',
            },
          })
          couponId = coupon.id

          await supabase
            .from('organisations')
            .update({ stripe_sibling_coupon_id: couponId })
            .eq('id', plan.organisation_id)
        }

        siblingCouponId = couponId
      }
    }

    // Resolve the platform fee rate from the academy's platform plan
    let PLATFORM_FEE_RATE = 0.035 // default to Starter rate (3.5%)
    if (planOrg?.platform_plan_id) {
      const { data: platformPlan } = await supabase
        .from('platform_plans')
        .select('transaction_fee_percent')
        .eq('id', planOrg.platform_plan_id)
        .single()
      if (platformPlan) {
        PLATFORM_FEE_RATE = Number(platformPlan.transaction_fee_percent) / 100
      }
    }

    // Fetch parent profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, stripe_customer_id')
      .eq('id', user.id)
      .single()

    // Get or create Stripe customer.
    //
    // We validate any stored customerId against the current Stripe mode (live vs
    // test). If a stale test-mode customer ID is sitting on the profile (e.g. from
    // an earlier dev/staging session), Stripe live API throws "No such customer".
    // In that case we clear the column and create a fresh live customer rather
    // than blocking the parent at checkout.
    let customerId = profile?.stripe_customer_id

    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId)
        if ((existing as Stripe.DeletedCustomer).deleted) {
          customerId = null
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('No such customer')) {
          // Stale ID (most likely test-mode) — drop it and recreate.
          customerId = null
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: null })
            .eq('id', user.id)
        } else {
          throw err
        }
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email || '',
        name: profile?.full_name || '',
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Get or create the Stripe Product
    let stripeProductId = plan.stripe_product_id

    if (!stripeProductId) {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description || `${plan.name} - ${plan.sessions_per_week} session(s)/week`,
        metadata: { supabase_plan_id: plan.id },
      })
      stripeProductId = product.id

      await supabase
        .from('subscription_plans')
        .update({ stripe_product_id: stripeProductId })
        .eq('id', plan.id)
    }

    const origin = request.headers.get('origin') || 'https://theplayerportal.net'

    if (isQuarterly) {
      // ═══ QUARTERLY: Real RECURRING Stripe subscription (Phase 1A) ═══
      // Mirrors the monthly subscription branch — mode:'subscription' + the same
      // Connect subscription_data + the SAME auto-enrol metadata — but with a
      // 3-month recurring Price and the quarterly % applied via a forever coupon.
      // The generic webhook handler (mode==='subscription', no pp_flow) then
      // creates the subscription row AND auto-enrols the player — inherited,
      // unchanged. No proration / no trial_end: the full first quarter is charged
      // today and recurs every 3 months. Connect routing + fee math are IDENTICAL
      // to monthly (#1 application_fee_percent = PLATFORM_FEE_RATE preserved).
      const monthlyAmount = Number(plan.amount)

      // Double-sub guard (quarterly-branch only): a player who already has an
      // active subscription must not be able to start a second — prevents
      // parallel billing. Returns a clear error before any Stripe object.
      if (playerId) {
        const { count: activeForPlayer } = await supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('player_id', playerId)
          .eq('organisation_id', plan.organisation_id)
          .eq('status', 'active')
        if ((activeForPlayer || 0) > 0) {
          return NextResponse.json(
            { error: 'This player already has an active subscription.' },
            { status: 400 },
          )
        }
      }

      // Recurring quarterly Price: full 3 months, billed every 3 months. Created
      // inline (mirrors the previous quarterly price-create) so NO schema column
      // is needed; the discount is the coupon, NOT baked into the price.
      const quarterlyRecurringPrice = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: Math.round(monthlyAmount * 3 * 100), // full 3 months, pence
        currency: 'gbp',
        recurring: { interval: 'month', interval_count: 3 },
        metadata: { supabase_plan_id: plan.id, billing_option: 'quarterly', months_covered: '3' },
      })

      // Quarterly saving via a deterministic forever percent-off coupon
      // (pp-quarterly-{pct}pct-forever, get-or-create). Re-applies every cycle.
      const quarterlyCoupon =
        quarterlyDiscountRate > 0
          ? await getOrCreateQuarterlyCoupon(quarterlyDiscountRate * 100, plan.organisation_id as string)
          : null

      const quarterlySessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        line_items: [{ price: quarterlyRecurringPrice.id, quantity: 1 }],
        mode: 'subscription',
        payment_method_types: ['card'],
        success_url: `${origin}/dashboard/payments/success?billing=quarterly`,
        cancel_url: `${origin}/dashboard/payments?sub_cancelled=1`,
        ...(quarterlyCoupon ? { discounts: [{ coupon: quarterlyCoupon }] } : {}),
        // Session metadata MUST match monthly so the generic webhook resolves
        // ctx.planId / classId / playerId and fires the auto-enrol RPC.
        metadata: {
          supabase_plan_id: planId,
          supabase_user_id: user.id,
          supabase_player_id: playerId || '',
          billing_option: 'quarterly',
          months_covered: '3',
          activates_on: activatesOnIso,
          ...(classId ? { supabase_class_id: classId } : {}),
        },
        subscription_data: {
          metadata: {
            supabase_plan_id: planId,
            supabase_user_id: user.id,
            supabase_player_id: playerId || '',
            billing_option: 'quarterly',
            activates_on: activatesOnIso,
            ...(classId ? { supabase_class_id: classId } : {}),
          },
          // Connect routing + platform fee IDENTICAL to the monthly branch.
          // `on_behalf_of` brands Checkout/receipts with the academy; the fee is
          // the SAME application_fee_percent (PLATFORM_FEE_RATE) — fee math (#1)
          // unchanged. No trial_end / billing_cycle_anchor → full quarter today.
          ...(connectedAccountId
            ? {
                on_behalf_of: connectedAccountId,
                ...(PLATFORM_FEE_RATE > 0 ? { application_fee_percent: feePercentFromRate(PLATFORM_FEE_RATE) } : {}),
                transfer_data: { destination: connectedAccountId },
              }
            : {}),
        },
      }

      const session = await stripe.checkout.sessions.create(quarterlySessionParams)

      const quarterlyFull = monthlyAmount * 3
      const quarterlyDiscounted = quarterlyFull * (1 - quarterlyDiscountRate)
      return NextResponse.json({
        url: session.url,
        billing: 'quarterly',
        recurring: true,
        total: quarterlyDiscounted.toFixed(2),
        saving: (quarterlyFull * quarterlyDiscountRate).toFixed(2),
        discountPercent: Math.round(quarterlyDiscountRate * 100),
      })
    }

    // ═══ MONTHLY: Standard recurring subscription ═══
    // Get or create the Stripe recurring Price for this plan
    let stripePriceId = plan.stripe_price_id

    if (!stripePriceId) {
      const price = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: Math.round(Number(plan.amount) * 100), // pence
        currency: 'gbp',
        recurring: {
          interval: plan.interval === 'year' ? 'year' : 'month',
        },
        metadata: { supabase_plan_id: plan.id, billing_option: 'monthly' },
      })
      stripePriceId = price.id

      await supabase
        .from('subscription_plans')
        .update({ stripe_price_id: stripePriceId })
        .eq('id', plan.id)
    }

    // ─── Determine first session date for fair-billing logic ───
    // When the parent's first session is in the next month or beyond, strict
    // pro-rata feels wrong (they pay £X for days where they get no service).
    // Instead, charge the full month upfront NOW and skip the next anchor —
    // their first paid month covers the month containing their first session.
    //
    // For group classes: use the training_group's day_of_week to compute
    //   the next occurrence as their first session.
    // For 1-2-1 / 2-1 / intensity: prefer the explicit firstSessionDate
    //   parameter if provided, fall back to day_of_week next occurrence.
    let firstSessionDate: Date | null = null
    // Captured for session-bridge: needed to count class-day occurrences
    // in [activatesOn, anchor). NULL when no class is linked or no class day.
    let classDayOfWeek: string | null = null
    if (classId) {
      const { data: group } = await supabase
        .from('training_groups')
        .select('day_of_week, class_type')
        .eq('id', classId)
        .single()
      classDayOfWeek = (group?.day_of_week as string | null) ?? null
      const allowsExplicitDate = group?.class_type && ['1-2-1', '2-1', 'intensity'].includes(group.class_type as string)
      if (allowsExplicitDate && firstSessionDateInput) {
        const parsed = new Date(firstSessionDateInput)
        if (!isNaN(parsed.getTime())) firstSessionDate = parsed
      }
      if (!firstSessionDate) {
        firstSessionDate = nextOccurrenceOfDayOfWeek(group?.day_of_week as string | null | undefined)
      }
    }

    const standardAnchor = getFirstOfNextMonth()
    const firstSessionTimestamp = firstSessionDate ? Math.floor(firstSessionDate.getTime() / 1000) : null

    // ── BILLING MODEL: "Pay for tonight's session + monthly term from the 1st" ──
    //
    // Aim: parents joining mid-month see one clean, understandable amount today
    // (the price of a single session — monthly ÷ 4), then their proper monthly
    // term kicks in on the 1st of next month with the full £X and recurs from
    // there. No mystery prorated pennies, no surprise £62 bills.
    //
    // Implementation under the hood (because Stripe Checkout can't bill a
    // one-off today AND defer the subscription to a future date in a single
    // session): we run Checkout in PAYMENT mode for tonight's session amount
    // with `setup_future_usage: 'off_session'` to save the card. The webhook
    // then creates the actual recurring subscription via the Stripe API with
    // `trial_end` set to the 1st of next month — so £0 sub charge today, full
    // £X charged on the 1st, recurs monthly thereafter.
    //
    // Migration mode (admin pre-set firstBillingDate because the parent already
    // paid the academy elsewhere) takes precedence and uses the legacy
    // trial_end subscription flow — no one-time charge for them.
    //
    // If first session is in NEXT month already (no session this month at all),
    // skip the one-time and let the trial_end carry the subscription cleanly.
    const today = new Date()
    const sessionIsThisCalendarMonth =
      firstSessionDate !== null &&
      firstSessionDate.getUTCFullYear() === today.getUTCFullYear() &&
      firstSessionDate.getUTCMonth() === today.getUTCMonth()

    const perSessionPence = Math.max(0, Math.round((Number(plan.amount) / 4) * 100))

    // ─── BILLING FLOW SELECTION ───
    // Four branches in production simultaneously, dispatched by:
    //   1. migration (admin-set firstBillingDate) → trial_end mechanism (unchanged)
    //   2. immediate_prorated (NEW, feature-flagged) → Stripe-native proration
    //   3. tonight_then_sub (legacy default) → monthly÷4 + webhook subscription
    //   4. sub_from_1st (fallback) → trial_end at standardAnchor
    //
    // Stage 2 introduces #2. The flag check below means the legacy #3 path stays
    // active for ALL orgs until BILLING_FLOW_STARTDATE_ENABLED includes them.
    const startDateBillingFlag = isStartDateBillingEnabled(plan.organisation_id as string)
    const startsThisCalendarMonth = isStartInCurrentMonth(activatesOnDate)
    const startsTodayOrEarlier = isStartTodayOrEarlier(activatesOnDate)

    // Use the new immediate_prorated path when ALL of:
    //   - flag is on for this org
    //   - no migration override
    //   - parent picked a date in the current calendar month (i.e. proration is meaningful)
    //   - parent picked today or earlier (immediate-start case)
    const useImmediateProrated =
      startDateBillingFlag && !migrationTrialEnd && startsThisCalendarMonth && startsTodayOrEarlier

    // Stage 3: future-start path. Activates when both Stage 2 + Stage 3 flags
    // are on for this org, parent picked a date strictly in the future, and
    // no migration override. The Stripe Checkout runs in SETUP mode (£0 today)
    // and the activation cron creates the real subscription on start_date.
    const futureStartBillingFlag = isFutureStartBillingEnabled(plan.organisation_id as string)
    const useFutureProratedBase =
      startDateBillingFlag &&
      futureStartBillingFlag &&
      !migrationTrialEnd &&
      !startsTodayOrEarlier

    // Session-bridge variant: same gate as useFutureProratedBase PLUS the org
    // must be in session mode AND this plan must have sessions_per_month set
    // AND the class must have a day_of_week (needed to count sessions).
    // bridgeBillingMode + planSessionsPerMonth are resolved earlier (separate
    // queries that tolerate migration 072 not yet being applied).
    // If any condition fails, dispatch falls back to calendar.
    const killSwitchOn = process.env.BILLING_BRIDGE_MODE_KILL === 'true'
    const useSessionBridge =
      useFutureProratedBase &&
      !killSwitchOn &&
      bridgeBillingMode === 'session' &&
      planSessionsPerMonth !== null &&
      planSessionsPerMonth > 0 &&
      classDayOfWeek !== null &&
      !isQuarterly

    const useFutureProrated = useFutureProratedBase && !useSessionBridge

    const useTonightPlusSub = !useImmediateProrated && !useFutureProrated && !useSessionBridge && !migrationTrialEnd && sessionIsThisCalendarMonth && perSessionPence > 0
    const useTrialEndOnly = !useImmediateProrated && !useFutureProrated && !useSessionBridge && !migrationTrialEnd && !useTonightPlusSub

    // ─── Class-day validation (Stage 3 future-start only) ───
    // The picker (allowFutureStart=true) only emits class-day dates. Reject
    // any tampered submission that breaks the rule — applies to BOTH the
    // session-bridge branch and the calendar-mode future-prorated branch,
    // so a Wednesday submission for a Monday class is rejected uniformly.
    //
    // Scoped to useFutureProratedBase so it doesn't surprise legacy paths
    // (today-only mode, where today may or may not be a class day and the
    // picker has no choice anyway).
    //
    // Skipped when classDayOfWeek is null (unknown-schedule fallback path).
    if (useFutureProratedBase && classDayOfWeek) {
      const { isClassDay } = await import('@/lib/billing/sessions')
      if (!isClassDay(activatesOnIso, classDayOfWeek)) {
        return NextResponse.json(
          { error: `Selected start date is not a ${classDayOfWeek} class session.` },
          { status: 400 },
        )
      }
    }

    if (useSessionBridge) {
      // ═══ Stage 3 session-bridge: charge bridge NOW + sub trials until anchor ═══
      // Parent is charged the bridge amount immediately at Stripe Checkout.
      // The subscription is created with trial_end=anchor — the recurring £X
      // first cycle fires automatically on the 1st. No cron needed.
      // (Test Clock probe confirmed: Stripe transitions trialing → active on
      // anchor and the full monthly invoice fires with no proration.)
      // (Class-day validation already enforced above for all
      //  useFutureProratedBase branches — no per-branch re-check needed.)
      const { estimateBridgePence } = await import('@/lib/billing/sessions')

      const estimate = estimateBridgePence({
        monthlyPence: Math.round(Number(plan.amount) * 100),
        sessionsPerMonth: planSessionsPerMonth,
        classDayOfWeek,
        startDate: activatesOnDate,
      })

      // Defensive: if math fails (shouldn't happen since useSessionBridge
      // gate already validated all inputs), fall through to calendar mode.
      if (!estimate || estimate.bridgePence <= 0) {
        // No bridge to charge → parent gets pure trial-to-anchor.
        // Hand off to useFutureProrated (calendar) path below.
      } else {
        const anchorUnix = firstOfNextMonthUnix(activatesOnDate)
        const anchorIso = new Date(anchorUnix * 1000).toISOString().slice(0, 10)

        // a54bd62 graft — explicit "Paid today" wording on the bridge line
        // item so the parent anchors on what they're actually charged at
        // checkout, rather than Stripe's automatic "X days free" label on
        // the recurring line. Bridge math + amount unchanged — display only.
        const startMonthName = activatesOnDate.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })
        const sessionWord = estimate.sessionsRemaining === 1 ? 'session' : 'sessions'
        const bridgeLineName = `Paid today — covers ${estimate.sessionsRemaining} remaining ${startMonthName} ${sessionWord}`

        // Resolve a Stripe priceId for the monthly recurring leg. Reuse the
        // existing one set on the plan if present, else create via price_data
        // (the existing immediate_prorated path already handles either).
        const stripePriceId = (plan as { stripe_price_id?: string | null }).stripe_price_id ?? null

        const sessionBridgeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
        if (stripePriceId) {
          sessionBridgeLineItems.push({ price: stripePriceId, quantity: 1 })
        } else {
          sessionBridgeLineItems.push({
            price_data: {
              currency: 'gbp',
              product_data: { name: String(plan.name) },
              unit_amount: Math.round(Number(plan.amount) * 100),
              recurring: { interval: 'month' },
            },
            quantity: 1,
          })
        }
        // One-time bridge line item — billed at checkout
        sessionBridgeLineItems.push({
          price_data: {
            currency: 'gbp',
            product_data: {
              name: bridgeLineName,
              description: `${estimate.sessionsRemaining} ${sessionWord} × £${(estimate.perSessionPence / 100).toFixed(2)}`,
            },
            unit_amount: estimate.bridgePence,
          },
          quantity: 1,
        })

        const sessionBridgeParams: Stripe.Checkout.SessionCreateParams = {
          customer: customerId,
          mode: 'subscription',
          payment_method_types: ['card'],
          success_url: `${origin}/dashboard/payments/success?billing=monthly&model=future_session_bridge`,
          cancel_url: `${origin}/dashboard/payments?sub_cancelled=1`,
          line_items: sessionBridgeLineItems,
          subscription_data: {
            trial_end: anchorUnix,
            // NOTE: billing_cycle_anchor intentionally omitted. Stripe forbids
            // combining it with trial_end. trial_end alone produces the
            // desired calendar: first cycle billed on trial_end.
            on_behalf_of: connectedAccountId,
            application_fee_percent: feePercentFromRate(PLATFORM_FEE_RATE),
            transfer_data: { destination: connectedAccountId },
            metadata: {
              supabase_plan_id: planId,
              supabase_user_id: user.id,
              ...(playerId ? { supabase_player_id: playerId } : {}),
              ...(classId ? { supabase_class_id: classId } : {}),
              billing_model: 'future_session_bridge',
              pp_flow: 'future_session_bridge',
              activates_on: activatesOnIso,
              bridge_sessions_remaining: String(estimate.sessionsRemaining),
              bridge_per_session_pence: String(estimate.perSessionPence),
              bridge_pence: String(estimate.bridgePence),
            },
          },
          metadata: {
            supabase_plan_id: planId,
            supabase_user_id: user.id,
            supabase_player_id: playerId || '',
            billing_option: 'monthly',
            billing_model: 'future_session_bridge',
            pp_flow: 'future_session_bridge',
            activates_on: activatesOnIso,
            bridge_pence: String(estimate.bridgePence),
            bridge_sessions_remaining: String(estimate.sessionsRemaining),
            ...(classId ? { supabase_class_id: classId } : {}),
            ...(siblingCouponId ? { sibling_coupon_id: siblingCouponId } : {}),
          },
          ...(siblingCouponId ? { discounts: [{ coupon: siblingCouponId }] } : {}),
        }

        const session = await stripe.checkout.sessions.create(sessionBridgeParams)

        return NextResponse.json({
          url: session.url,
          billing: 'monthly',
          billingModel: 'future_session_bridge',
          activatesOn: activatesOnIso,
          nextBillingDate: anchorIso,
          nextBillingAmount: Number(plan.amount).toFixed(2),
          tonightAmount: (estimate.bridgePence / 100).toFixed(2),
          firstSessionDate: firstSessionDate ? firstSessionDate.toISOString().split('T')[0] : null,
          siblingDiscountApplied: !!siblingCouponId,
          siblingDiscountPercent: siblingCouponId ? Number(planOrg?.sibling_discount_percent) : 0,
          bridge: {
            sessionsRemaining: estimate.sessionsRemaining,
            perSessionPence: estimate.perSessionPence,
            bridgePence: estimate.bridgePence,
            capApplied: estimate.capApplied,
          },
        })
      }
    }

    if (useFutureProrated) {
      // ═══ Stage 3: SetupIntent-mode Checkout, charge happens later via cron ═══
      // Parent saves card now (£0 today). A `subscriptions` row with
      // status='scheduled' + start_date + stripe_setup_intent_id is written by
      // the webhook on checkout.session.completed (setup mode). The activation
      // cron at /api/cron/activate-scheduled-subs runs daily at 02:00 UTC and
      // creates the real Stripe subscription when start_date <= today.
      //
      // BRANDING: `setup_intent_data.on_behalf_of` attributes the SetupIntent
      // to the academy's Connect account. Without it, Stripe falls back to
      // rendering the PLATFORM account's business name on the Checkout page
      // (e.g. parents saw "Gold and Gray Soccer Academy ltd" — the platform
      // account's legacy `business_profile.name` — instead of the academy
      // name). Stripe DOES support on_behalf_of on SetupIntents; the prior
      // comment about "those apply only to charges" was wrong.
      // application_fee / transfer_data still don't apply here — there's no
      // charge — those are set when the cron creates the real subscription.
      const setupParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        mode: 'setup',
        payment_method_types: ['card'],
        success_url: `${origin}/dashboard/payments/success?billing=monthly&model=future_prorated`,
        cancel_url: `${origin}/dashboard/payments?sub_cancelled=1`,
        setup_intent_data: {
          ...(connectedAccountId ? { on_behalf_of: connectedAccountId } : {}),
          metadata: {
            supabase_plan_id: planId,
            supabase_user_id: user.id,
            ...(playerId ? { supabase_player_id: playerId } : {}),
            ...(classId ? { supabase_class_id: classId } : {}),
            billing_model: 'future_prorated',
            pp_flow: 'future_prorated',
            activates_on: activatesOnIso,
          },
        },
        metadata: {
          supabase_plan_id: planId,
          supabase_user_id: user.id,
          supabase_player_id: playerId || '',
          billing_option: 'monthly',
          billing_model: 'future_prorated',
          pp_flow: 'future_prorated',
          activates_on: activatesOnIso,
          ...(classId ? { supabase_class_id: classId } : {}),
          ...(siblingCouponId ? { sibling_coupon_id: siblingCouponId } : {}),
        },
      }

      const session = await stripe.checkout.sessions.create(setupParams)

      return NextResponse.json({
        url: session.url,
        billing: 'monthly',
        billingModel: 'future_prorated',
        activatesOn: activatesOnIso,
        nextBillingDate: activatesOnIso,
        nextBillingAmount: Number(plan.amount).toFixed(2),
        tonightAmount: '0.00',
        firstSessionDate: firstSessionDate ? firstSessionDate.toISOString().split('T')[0] : null,
        siblingDiscountApplied: !!siblingCouponId,
        siblingDiscountPercent: siblingCouponId ? Number(planOrg?.sibling_discount_percent) : 0,
      })
    }

    if (useImmediateProrated) {
      // ═══ Stage 2: Stripe-native proration ═══
      // Direct subscription in Checkout subscription mode. Stripe calendar-day
      // proration handles "from activates_on to 1st of next month" maths and
      // bills the prorated amount NOW. Every subsequent renewal is on the 1st.
      //
      // Verified end-to-end in Probe 7 (Stripe test mode with Test Clock):
      //   Jun 15 signup → £15.62 prorated  →  Jul 1 £30  →  Aug 1 £30.
      //
      // Connect routing identical to existing branches:
      //   - on_behalf_of = academy (brands Checkout + receipts)
      //   - transfer_data.destination = academy (money lands on their balance)
      //   - application_fee_percent = platform fee
      const billingAnchor = firstOfNextMonthUnix(activatesOnDate)

      const monthlySessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: 'subscription',
        payment_method_types: ['card'],
        success_url: `${origin}/dashboard/payments/success?billing=monthly&model=immediate_prorated`,
        cancel_url: `${origin}/dashboard/payments?sub_cancelled=1`,
        ...(siblingCouponId ? { discounts: [{ coupon: siblingCouponId }] } : {}),
        metadata: {
          supabase_plan_id: planId,
          supabase_user_id: user.id,
          supabase_player_id: playerId || '',
          billing_option: 'monthly',
          billing_model: 'immediate_prorated',
          pp_flow: 'immediate_prorated',
          activates_on: activatesOnIso,
          ...(classId ? { supabase_class_id: classId } : {}),
          ...(siblingCouponId ? { sibling_discount_applied: 'true' } : {}),
        },
        subscription_data: {
          metadata: {
            supabase_plan_id: planId,
            supabase_user_id: user.id,
            supabase_player_id: playerId || '',
            billing_model: 'immediate_prorated',
            activates_on: activatesOnIso,
            ...(classId ? { supabase_class_id: classId } : {}),
            ...(siblingCouponId ? { sibling_discount_applied: 'true' } : {}),
          },
          // The KEY mechanism: future billing_cycle_anchor + create_prorations.
          // Stripe issues a prorated invoice covering (today → anchor) NOW, and
          // bills the full monthly amount on each anchor afterward.
          billing_cycle_anchor: billingAnchor,
          proration_behavior: 'create_prorations',
          // No trial_end here. trial_end + billing_cycle_anchor must match
          // (Stripe constraint, root of task #76). With anchor in the future and
          // no trial, Stripe prorates immediately — exactly what we want.
          ...(connectedAccountId
            ? {
                on_behalf_of: connectedAccountId,
                ...(PLATFORM_FEE_RATE > 0 ? { application_fee_percent: feePercentFromRate(PLATFORM_FEE_RATE) } : {}),
                transfer_data: { destination: connectedAccountId },
              }
            : {}),
        },
      }

      const session = await stripe.checkout.sessions.create(monthlySessionParams)

      // Estimate the prorated charge for the UI / response. Stripe's actual
      // amount is calendar-day computed at finalize time; this matches within
      // pence for the standard plan amounts.
      const anchorDate = new Date(billingAnchor * 1000)
      const startMs = activatesOnDate.getTime()
      const endMs = anchorDate.getTime()
      const monthMs = new Date(Date.UTC(activatesOnDate.getUTCFullYear(), activatesOnDate.getUTCMonth() + 1, 0)).getUTCDate() * 86400000
      const daysToAnchor = Math.max(0, Math.round((endMs - startMs) / 86400000))
      const proratedPence = Math.round((Number(plan.amount) * 100 * daysToAnchor * 86400000) / monthMs)

      return NextResponse.json({
        url: session.url,
        billing: 'monthly',
        billingModel: 'immediate_prorated',
        firstSessionDate: firstSessionDate ? firstSessionDate.toISOString().split('T')[0] : null,
        nextBillingDate: anchorDate.toISOString().split('T')[0],
        nextBillingAmount: Number(plan.amount).toFixed(2),
        tonightAmount: (proratedPence / 100).toFixed(2),
        activatesOn: activatesOnIso,
        siblingDiscountApplied: !!siblingCouponId,
        siblingDiscountPercent: siblingCouponId ? Number(planOrg?.sibling_discount_percent) : 0,
      })
    }

    if (useTonightPlusSub) {
      // ─── New flow: charge tonight's session as a one-off, then create the
      //     subscription via webhook with trial_end = 1st of next month ───
      const platformFeePence = PLATFORM_FEE_RATE > 0 ? Math.round(perSessionPence * PLATFORM_FEE_RATE) : 0

      const tonightSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'gbp',
              unit_amount: perSessionPence,
              product_data: {
                name: `Your first session — ${plan.name}`,
                description: `One session today. Your £${Number(plan.amount).toFixed(2)}/month membership starts ${new Date(standardAnchor * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`,
              },
            },
            quantity: 1,
          },
        ],
        // Save the card so the post-checkout subscription can charge off-session.
        // `on_behalf_of` brands the Checkout + receipt with the academy's
        // Stripe account name (e.g. "Jamie Allan Football Academy") instead of
        // the platform account name. The follow-up subscription created in the
        // webhook handler picks up the same on_behalf_of so renewals stay
        // academy-branded too.
        payment_intent_data: {
          setup_future_usage: 'off_session',
          ...(connectedAccountId
            ? {
                on_behalf_of: connectedAccountId,
                ...(platformFeePence > 0 ? { application_fee_amount: platformFeePence } : {}),
                transfer_data: { destination: connectedAccountId },
              }
            : {}),
        },
        success_url: `${origin}/dashboard/payments/success?billing=monthly&model=tonight_then_sub`,
        cancel_url: `${origin}/dashboard/payments?sub_cancelled=1`,
        ...(siblingCouponId ? { discounts: [{ coupon: siblingCouponId }] } : {}),
        metadata: {
          // The webhook reads these to build the subscription after payment.
          pp_flow: 'tonight_then_sub',
          supabase_plan_id: planId,
          supabase_user_id: user.id,
          supabase_player_id: playerId || '',
          supabase_class_id: classId || '',
          stripe_recurring_price_id: stripePriceId,
          stripe_connected_account: connectedAccountId || '',
          platform_fee_percent: String(feePercentFromRate(PLATFORM_FEE_RATE)),
          sub_trial_end_unix: String(standardAnchor),
          first_session_date: firstSessionDate ? firstSessionDate.toISOString().split('T')[0] : '',
          ...(siblingCouponId ? { sibling_coupon_id: siblingCouponId } : {}),
          billing_option: 'monthly',
          billing_model: 'tonight_then_sub',
          // Always captured (Stage 1) — webhook writes this to enrolments.activates_on
          // regardless of which billing flow ran. Booking gate enforces it
          // whether flag is on or off.
          activates_on: activatesOnIso,
        },
      })

      return NextResponse.json({
        url: tonightSession.url,
        billing: 'monthly',
        billingModel: 'tonight_then_sub',
        firstSessionDate: firstSessionDate ? firstSessionDate.toISOString().split('T')[0] : null,
        tonightAmount: (perSessionPence / 100).toFixed(2),
        nextBillingDate: new Date(standardAnchor * 1000).toISOString().split('T')[0],
        nextBillingAmount: Number(plan.amount).toFixed(2),
        siblingDiscountApplied: !!siblingCouponId,
        siblingDiscountPercent: siblingCouponId ? Number(planOrg?.sibling_discount_percent) : 0,
      })
    }

    // ─── Legacy / fallback flow: subscription mode with trial_end ───
    // Used for (a) migration billing and (b) no-session-this-month signups,
    // where there's nothing to charge for tonight — sub starts on the 1st.
    const trialEnd = migrationTrialEnd || standardAnchor

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: stripePriceId, quantity: 1 },
    ]

    const monthlySessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: lineItems,
      mode: 'subscription',
      payment_method_types: ['card'],
      success_url: `${origin}/dashboard/payments/success?billing=monthly`,
      cancel_url: `${origin}/dashboard/payments?sub_cancelled=1`,
      ...(siblingCouponId ? { discounts: [{ coupon: siblingCouponId }] } : {}),
      metadata: {
        supabase_plan_id: planId,
        supabase_user_id: user.id,
        supabase_player_id: playerId || '',
        billing_option: 'monthly',
        billing_model: migrationTrialEnd ? 'migration' : 'sub_from_1st',
        ...(firstSessionDate ? { first_session_date: firstSessionDate.toISOString().split('T')[0] } : {}),
        ...(classId ? { supabase_class_id: classId } : {}),
        ...(siblingCouponId ? { sibling_discount_applied: 'true' } : {}),
        activates_on: activatesOnIso,
      },
      subscription_data: {
        metadata: {
          supabase_plan_id: planId,
          supabase_user_id: user.id,
          supabase_player_id: playerId || '',
          billing_model: migrationTrialEnd ? 'migration' : 'sub_from_1st',
          ...(firstSessionDate ? { first_session_date: firstSessionDate.toISOString().split('T')[0] } : {}),
          ...(classId ? { supabase_class_id: classId } : {}),
          ...(siblingCouponId ? { sibling_discount_applied: 'true' } : {}),
          activates_on: activatesOnIso,
        },
        trial_end: trialEnd,
        // on_behalf_of pins the academy as settlement merchant so Stripe renders
        // the academy's business name on Checkout, mandate copy, and receipts.
        ...(connectedAccountId
          ? {
              on_behalf_of: connectedAccountId,
              ...(PLATFORM_FEE_RATE > 0 ? { application_fee_percent: feePercentFromRate(PLATFORM_FEE_RATE) } : {}),
              transfer_data: { destination: connectedAccountId },
            }
          : {}),
      },
    }

    const session = await stripe.checkout.sessions.create(monthlySessionParams)

    return NextResponse.json({
      url: session.url,
      billing: 'monthly',
      billingModel: migrationTrialEnd ? 'migration' : 'sub_from_1st',
      firstSessionDate: firstSessionDate ? firstSessionDate.toISOString().split('T')[0] : null,
      nextBillingDate: new Date(trialEnd * 1000).toISOString().split('T')[0],
      nextBillingAmount: Number(plan.amount).toFixed(2),
      tonightAmount: '0.00',
      siblingDiscountApplied: !!siblingCouponId,
      siblingDiscountPercent: siblingCouponId ? Number(planOrg?.sibling_discount_percent) : 0,
      // suppress unused-var warning while keeping the flag visible for future logic
      _useTrialEndOnly: useTrialEndOnly,
    })
  } catch (err) {
    console.error('Subscribe checkout error:', err)
    return NextResponse.json(
      { error: mapStripeCheckoutError(err) },
      { status: 500 }
    )
  }
}
