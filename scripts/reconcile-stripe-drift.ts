/**
 * STAGE A — read-only Stripe ⇄ Supabase reconciliation diagnostic.
 *
 * For one organisation, reports every break in the trust chain:
 *   Pay → Subscription → Enrolment → Booking permission → Dashboard
 *
 * Does NOT write to either system. Safe to run repeatedly.
 *
 * Run:
 *   vercel env pull /tmp/.env.prod --environment=production --yes
 *   set -a; source /tmp/.env.prod; set +a
 *   npx tsx scripts/reconcile-stripe-drift.ts \
 *     --org=d99aa6e4-514b-42db-9c2a-523aab90e678 \
 *     --days=90
 *
 *   --testmode    use STRIPE_SECRET_KEY_TEST instead of live key (if set)
 *   --verbose     also print matched/OK lines
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
)

const ORG_ID = args.org
const DAYS = Number(args.days || 90)
const PRINT_OK = args.verbose === 'true'
const TEST_MODE = args.testmode === 'true'

if (!ORG_ID) {
  console.error('Missing --org=<uuid>')
  process.exit(1)
}

const stripeKey = TEST_MODE
  ? process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY!
  : process.env.STRIPE_SECRET_KEY!

const stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' as never })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type DriftKind =
  | 'sub_in_stripe_not_db'
  | 'sub_in_db_not_stripe'
  | 'sub_status_mismatch'
  | 'session_paid_no_payment_row'
  | 'invoice_paid_no_payment_row'
  | 'payment_row_no_stripe_object'
  | 'customer_no_profile'
  | 'sub_active_no_enrolment'
  | 'enrolment_active_no_sub'
  | 'customer_paid_no_enrolment'
  | 'booking_blocked_by_disagreement'
  | 'dashboard_shows_subscribe_despite_stripe_sub'
  // Stage 3 — future-start lifecycle drift kinds.
  // 'scheduled' subs + 'pending' enrolments live in a separate state
  // dimension and must NOT trigger the legacy checks above:
  //   - sub_in_db_not_stripe: scheduled subs have stripe_subscription_id=NULL,
  //     so they're naturally excluded from the Stripe lookup loop (the map
  //     is keyed by stripe_subscription_id).
  //   - sub_status_mismatch: same reason — only walked when both sides agree
  //     on stripe_subscription_id existence.
  //   - sub_active_no_enrolment / enrolment_active_no_sub / etc: filter on
  //     status === 'active' || 'trialing' explicitly, excluding scheduled.
  //   - enrolment_active_no_sub: filters status === 'active', excluding pending.
  // New Stage 3 checks below catch real future-start drift:
  | 'scheduled_sub_no_pending_enrolment'
  | 'pending_enrolment_no_scheduled_sub'
  | 'pending_enrolment_overdue'
  | 'stale_scheduled_sub'

interface Drift {
  kind: DriftKind
  customer_id?: string
  parent_email?: string | null
  parent_name?: string | null
  stripe_id?: string
  db_id?: string
  amount?: number
  status_stripe?: string
  status_db?: string
  detail?: string
}

const drifts: Drift[] = []
let okCount = 0

async function run() {
  const t0 = Date.now()
  console.log(`\n═══ STRIPE ⇄ SUPABASE RECONCILIATION ═══`)
  console.log(`Org:        ${ORG_ID}`)
  console.log(`Window:     last ${DAYS} days`)
  console.log(`Stripe key: ${TEST_MODE ? 'TEST MODE' : 'LIVE'}`)
  console.log(`Run at:     ${new Date().toISOString()}`)
  console.log()

  // ── Load org name + every profile in this org with a Stripe customer ID ──
  const { data: org } = await supabase
    .from('organisations')
    .select('name, slug, stripe_account_id')
    .eq('id', ORG_ID)
    .single()
  if (!org) {
    console.error('Org not found')
    process.exit(1)
  }
  console.log(`Academy:    ${org.name} (${org.slug})`)
  console.log(`Connect:    ${org.stripe_account_id || '(none)'}`)
  console.log()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, stripe_customer_id')
    .eq('organisation_id', ORG_ID)
    .not('stripe_customer_id', 'is', null)

  const profileByCustomer = new Map<
    string,
    { id: string; full_name: string | null; email: string | null }
  >()
  for (const p of profiles || []) {
    profileByCustomer.set(p.stripe_customer_id as string, p as never)
  }
  console.log(`Parents with stripe_customer_id: ${profileByCustomer.size}`)
  console.log()

  // ── Load DB-side ground truth ──
  // Stage 3 columns (start_date, training_group_id, stripe_setup_intent_id,
  // player_id) selected so the future-start checks below can match
  // scheduled subs to their pending enrolments and detect stale rows.
  // If migration 071 hasn't been applied, the missing columns come back
  // as undefined — the new checks tolerate that gracefully (they only
  // fire if start_date is present).
  const { data: dbSubs } = await supabase
    .from('subscriptions')
    .select('id, status, stripe_subscription_id, parent_id, plan_id, player_id, start_date, training_group_id, stripe_setup_intent_id')
    .eq('organisation_id', ORG_ID)
  const dbSubsByStripeId = new Map<
    string,
    { id: string; status: string; parent_id: string }
  >()
  // Stage 3: scheduled subs have stripe_subscription_id=NULL by design
  // (cron creates the Stripe sub later). They are intentionally excluded
  // from this map so they're never matched against Stripe Subscription
  // objects in the legacy checks — preventing false-positive
  // sub_in_db_not_stripe / sub_status_mismatch reports.
  for (const s of dbSubs || []) {
    if (s.stripe_subscription_id)
      dbSubsByStripeId.set(s.stripe_subscription_id, s as never)
  }

  const sinceDate = new Date(Date.now() - DAYS * 86400_000)
  const { data: dbPayments } = await supabase
    .from('payments')
    .select(
      'id, parent_id, amount, amount_paid, stripe_session_id, paid_date, status'
    )
    .eq('organisation_id', ORG_ID)
    .gte('paid_date', sinceDate.toISOString().split('T')[0])
  const dbPaymentBySessionId = new Map<string, { id: string; amount: number }>()
  for (const p of dbPayments || []) {
    if (p.stripe_session_id)
      dbPaymentBySessionId.set(p.stripe_session_id, p as never)
  }

  // ── Walk each customer in Stripe ──
  const stripeSubsByCustomer = new Map<
    string,
    Array<{ id: string; status: string; unit_amount: number | null }>
  >()

  for (const [customerId, profile] of profileByCustomer) {
    // 1. Subscriptions
    const stripeSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    })
    stripeSubsByCustomer.set(
      customerId,
      stripeSubs.data.map((s) => ({
        id: s.id,
        status: s.status,
        unit_amount: s.items.data[0]?.price.unit_amount ?? null,
      }))
    )

    for (const s of stripeSubs.data) {
      const dbSub = dbSubsByStripeId.get(s.id)
      if (!dbSub) {
        drifts.push({
          kind: 'sub_in_stripe_not_db',
          customer_id: customerId,
          parent_email: profile.email,
          parent_name: profile.full_name,
          stripe_id: s.id,
          status_stripe: s.status,
          amount: s.items.data[0]?.price.unit_amount
            ? s.items.data[0].price.unit_amount / 100
            : undefined,
        })
      } else {
        if (dbSub.status !== s.status) {
          drifts.push({
            kind: 'sub_status_mismatch',
            customer_id: customerId,
            parent_email: profile.email,
            stripe_id: s.id,
            db_id: dbSub.id,
            status_stripe: s.status,
            status_db: dbSub.status,
          })
        } else {
          okCount++
        }
      }
    }

    // 2. Checkout sessions in window
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      limit: 100,
      created: { gte: Math.floor(sinceDate.getTime() / 1000) },
    })
    for (const sess of sessions.data) {
      if (
        sess.payment_status !== 'paid' &&
        sess.payment_status !== 'no_payment_required'
      )
        continue
      if ((sess.amount_total || 0) === 0) continue
      const dbPayment = dbPaymentBySessionId.get(sess.id)
      if (!dbPayment) {
        drifts.push({
          kind: 'session_paid_no_payment_row',
          customer_id: customerId,
          parent_email: profile.email,
          parent_name: profile.full_name,
          stripe_id: sess.id,
          amount: (sess.amount_total || 0) / 100,
          detail: `mode=${sess.mode} status=${sess.status} payment_status=${sess.payment_status}`,
        })
      } else {
        okCount++
      }
    }

    // 3. Invoices in window
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100,
      created: { gte: Math.floor(sinceDate.getTime() / 1000) },
    })
    for (const inv of invoices.data) {
      if (inv.status !== 'paid') continue
      if ((inv.amount_paid || 0) === 0) continue
      const dbPayment = dbPaymentBySessionId.get(inv.id)
      if (!dbPayment) {
        drifts.push({
          kind: 'invoice_paid_no_payment_row',
          customer_id: customerId,
          parent_email: profile.email,
          parent_name: profile.full_name,
          stripe_id: inv.id,
          amount: (inv.amount_paid || 0) / 100,
          detail: `subscription=${inv.subscription || 'none'}`,
        })
      } else {
        okCount++
      }
    }
  }

  // ── 4. Inverse: any DB sub whose Stripe ID we can't find? ──
  for (const [stripeId, dbSub] of dbSubsByStripeId) {
    try {
      await stripe.subscriptions.retrieve(stripeId)
    } catch (e: unknown) {
      const err = e as { code?: string }
      if (err?.code === 'resource_missing') {
        drifts.push({
          kind: 'sub_in_db_not_stripe',
          db_id: dbSub.id,
          stripe_id: stripeId,
          status_db: dbSub.status,
        })
      }
    }
  }

  // ── 5. Any payment row whose stripe_session_id can't be retrieved? ──
  for (const [sessId, pay] of dbPaymentBySessionId) {
    if (!sessId.startsWith('cs_') && !sessId.startsWith('in_')) continue
    try {
      if (sessId.startsWith('cs_')) {
        await stripe.checkout.sessions.retrieve(sessId)
      } else {
        await stripe.invoices.retrieve(sessId)
      }
    } catch (e: unknown) {
      const err = e as { code?: string }
      if (err?.code === 'resource_missing') {
        drifts.push({
          kind: 'payment_row_no_stripe_object',
          db_id: pay.id,
          stripe_id: sessId,
          amount: pay.amount,
        })
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXTENDED TRUST-CHAIN CHECKS
  // ─────────────────────────────────────────────────────────────────────────

  // Preload every player in this org grouped by parent
  const { data: orgPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name, parent_id')
    .eq('organisation_id', ORG_ID)
  const playersByParent = new Map<
    string,
    Array<{ id: string; first_name: string; last_name: string }>
  >()
  for (const p of orgPlayers || []) {
    if (!p.parent_id) continue
    if (!playersByParent.has(p.parent_id)) playersByParent.set(p.parent_id, [])
    playersByParent.get(p.parent_id)!.push(p as never)
  }

  // Preload enrolments grouped by player. activates_on selected so the
  // Stage 3 pending-enrolment-overdue check can fire.
  const { data: orgEnrolments } = await supabase
    .from('enrolments')
    .select('id, player_id, status, group_id, enrolled_at, activates_on')
    .eq('organisation_id', ORG_ID)
  const enrolmentsByPlayer = new Map<
    string,
    Array<{ id: string; status: string; group_id: string }>
  >()
  for (const e of orgEnrolments || []) {
    if (!enrolmentsByPlayer.has(e.player_id))
      enrolmentsByPlayer.set(e.player_id, [])
    enrolmentsByPlayer.get(e.player_id)!.push(e as never)
  }

  const playerHasActiveEnrolment = (playerId: string) =>
    (enrolmentsByPlayer.get(playerId) || []).some((e) => e.status === 'active')

  // DB subs indexed by parent
  const dbSubsByParent = new Map<string, Array<{ status: string }>>()
  for (const s of dbSubs || []) {
    if (!s.parent_id) continue
    if (!dbSubsByParent.has(s.parent_id)) dbSubsByParent.set(s.parent_id, [])
    dbSubsByParent.get(s.parent_id)!.push({ status: s.status })
  }

  // ── CHECK 6: Stripe sub active but no matching active enrolment ──
  for (const [customerId, profile] of profileByCustomer) {
    const subs = stripeSubsByCustomer.get(customerId) || []
    const activeSubs = subs.filter(
      (s) => s.status === 'active' || s.status === 'trialing'
    )
    if (activeSubs.length === 0) continue

    const children = playersByParent.get(profile.id) || []
    const anyChildActiveEnrolled = children.some((c) =>
      playerHasActiveEnrolment(c.id)
    )

    if (!anyChildActiveEnrolled) {
      for (const s of activeSubs) {
        drifts.push({
          kind: 'sub_active_no_enrolment',
          customer_id: customerId,
          parent_email: profile.email,
          parent_name: profile.full_name,
          stripe_id: s.id,
          status_stripe: s.status,
          amount: s.unit_amount ? s.unit_amount / 100 : undefined,
          detail: `parent has ${children.length} child(ren) in org, none active-enrolled`,
        })
      }
    }
  }

  // ── CHECK 7: Active enrolment but no active sub for the parent ──
  for (const e of orgEnrolments || []) {
    if (e.status !== 'active') continue
    const player = orgPlayers?.find((p) => p.id === e.player_id)
    if (!player?.parent_id) continue
    const parentSubs = dbSubsByParent.get(player.parent_id) || []
    const hasActiveSub = parentSubs.some(
      (s) => s.status === 'active' || s.status === 'trialing'
    )
    if (!hasActiveSub) {
      const { data: parentProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', player.parent_id)
        .maybeSingle()
      drifts.push({
        kind: 'enrolment_active_no_sub',
        db_id: e.id,
        parent_name: parentProfile?.full_name,
        parent_email: parentProfile?.email,
        detail: `${player.first_name} ${player.last_name} active in group ${e.group_id.slice(0, 8)} — parent has no active sub`,
      })
    }
  }

  // ── CHECK 8: Customer with successful payment but no enrolment in this org ──
  for (const [customerId, profile] of profileByCustomer) {
    const pis = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 100,
      created: { gte: Math.floor(sinceDate.getTime() / 1000) },
    })
    const successful = pis.data.filter(
      (pi) => pi.status === 'succeeded' && (pi.amount_received || 0) > 0
    )
    if (successful.length === 0) continue

    const children = playersByParent.get(profile.id) || []
    const anyChildActiveEnrolled = children.some((c) =>
      playerHasActiveEnrolment(c.id)
    )
    if (!anyChildActiveEnrolled) {
      const totalPaid =
        successful.reduce((sum, pi) => sum + (pi.amount_received || 0), 0) / 100
      drifts.push({
        kind: 'customer_paid_no_enrolment',
        customer_id: customerId,
        parent_email: profile.email,
        parent_name: profile.full_name,
        amount: totalPaid,
        detail: `${successful.length} successful PI(s) totalling £${totalPaid.toFixed(2)} — no active enrolment for any of their ${children.length} child(ren)`,
      })
    }
  }

  // ── CHECK 9: Booking gate disagreement ──
  for (const [customerId, profile] of profileByCustomer) {
    const stripeActive = (stripeSubsByCustomer.get(customerId) || []).some(
      (s) => s.status === 'active' || s.status === 'trialing'
    )
    const dbActive = (dbSubsByParent.get(profile.id) || []).some(
      (s) => s.status === 'active' || s.status === 'trialing'
    )

    if (stripeActive && !dbActive) {
      drifts.push({
        kind: 'booking_blocked_by_disagreement',
        customer_id: customerId,
        parent_email: profile.email,
        parent_name: profile.full_name,
        detail: `Stripe has active/trialing sub, DB does NOT — booking API returns 402 "needs subscription"`,
      })
    }

    if (!stripeActive && dbActive) {
      drifts.push({
        kind: 'booking_blocked_by_disagreement',
        customer_id: customerId,
        parent_email: profile.email,
        parent_name: profile.full_name,
        detail: `DB has active/trialing sub, Stripe does NOT — parent can book despite cancelled Stripe sub`,
      })
    }
  }

  // ── CHECK 10: Dashboard Subscribe CTA despite real Stripe sub ──
  for (const [customerId, profile] of profileByCustomer) {
    const stripeActive = (stripeSubsByCustomer.get(customerId) || []).some(
      (s) => s.status === 'active' || s.status === 'trialing'
    )
    const dbActiveCount = (dbSubsByParent.get(profile.id) || []).filter(
      (s) => s.status === 'active' || s.status === 'trialing'
    ).length

    if (stripeActive && dbActiveCount === 0) {
      drifts.push({
        kind: 'dashboard_shows_subscribe_despite_stripe_sub',
        customer_id: customerId,
        parent_email: profile.email,
        parent_name: profile.full_name,
        detail: `Dashboard count = 0, Stripe count > 0 — parent sees "Subscribe" CTA despite paying`,
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 3 — FUTURE-START LIFECYCLE CHECKS
  // ─────────────────────────────────────────────────────────────────────────
  // These checks live below the legacy ones because they query the
  // 'scheduled' + 'pending' state dimension that didn't exist pre-Stage 3.
  // They only fire if migration 071 has been applied (start_date column
  // exists) — otherwise they're no-ops.
  //
  // Skip cleanly if migration 071 isn't applied yet. Sample the first
  // row for the start_date column; if it's never present anywhere, the
  // column doesn't exist and we silently skip Stage 3 reconciliation.
  const stage3Active = (dbSubs || []).some(
    (s) => (s as Record<string, unknown>).start_date !== undefined
  )

  if (stage3Active) {
    const todayIso = new Date().toISOString().slice(0, 10)

    // CHECK 11: scheduled sub exists but no matching pending enrolment for
    // the same player+group. Webhook auto-enrol failed at insert time —
    // parent will be charged on start_date but their seat isn't reserved.
    for (const s of (dbSubs || []) as Array<Record<string, unknown>>) {
      if (s.status !== 'scheduled') continue
      if (!s.player_id || !s.training_group_id) continue
      const enrolments = enrolmentsByPlayer.get(s.player_id as string) || []
      const hasMatchingPending = enrolments.some(
        (e) => e.group_id === s.training_group_id && e.status === 'pending'
      )
      if (!hasMatchingPending) {
        drifts.push({
          kind: 'scheduled_sub_no_pending_enrolment',
          db_id: s.id as string,
          detail: `scheduled sub for player ${(s.player_id as string).slice(0, 8)} in group ${(s.training_group_id as string).slice(0, 8)} but no matching pending enrolment — seat not reserved`,
        })
      }
    }

    // CHECK 12: pending enrolment exists but no matching scheduled
    // subscription. Orphan — webhook subscription insert failed but
    // enrolment insert succeeded. Booking gate will block this enrolment
    // forever (no cron path to flip it).
    for (const e of orgEnrolments || []) {
      if (e.status !== 'pending') continue
      const candidateSubs = (dbSubs || []).filter(
        (s) => s.status === 'scheduled' && (s as Record<string, unknown>).training_group_id === e.group_id
      )
      // Match against the parent of this player, not the player_id
      // directly (sub.player_id may be set, may be null for some orgs).
      const player = orgPlayers?.find((p) => p.id === e.player_id)
      if (!player?.parent_id) continue
      const hasMatchingScheduled = candidateSubs.some(
        (s) => s.parent_id === player.parent_id
      )
      if (!hasMatchingScheduled) {
        drifts.push({
          kind: 'pending_enrolment_no_scheduled_sub',
          db_id: e.id,
          detail: `pending enrolment for ${player.first_name} ${player.last_name} in group ${e.group_id.slice(0, 8)} — no matching scheduled subscription, booking gate will block forever`,
        })
      }
    }

    // CHECK 13: pending enrolment with activates_on <= today. Cron should
    // have flipped it to active. If it's still pending, either the cron
    // is broken or the matching scheduled sub activation failed half-way.
    for (const e of orgEnrolments || []) {
      if (e.status !== 'pending') continue
      const activatesOn = (e as Record<string, unknown>).activates_on as string | null
      if (!activatesOn) continue
      if (activatesOn > todayIso) continue
      const player = orgPlayers?.find((p) => p.id === e.player_id)
      drifts.push({
        kind: 'pending_enrolment_overdue',
        db_id: e.id,
        detail: `${player?.first_name ?? '?'} ${player?.last_name ?? ''} pending since ${activatesOn} (today ${todayIso}) — cron should have flipped to active`,
      })
    }

    // CHECK 14: scheduled sub with start_date well in the past.
    // SetupIntents can expire (typically ~30 days after creation). If the
    // cron hasn't activated this row, something went wrong — either the
    // SetupIntent can't be retrieved, or every cron run has thrown.
    const STALE_THRESHOLD_DAYS = 7
    const staleCutoff = new Date(Date.now() - STALE_THRESHOLD_DAYS * 86400_000).toISOString().slice(0, 10)
    for (const s of (dbSubs || []) as Array<Record<string, unknown>>) {
      if (s.status !== 'scheduled') continue
      const startDate = s.start_date as string | null
      if (!startDate) continue
      if (startDate >= staleCutoff) continue
      drifts.push({
        kind: 'stale_scheduled_sub',
        db_id: s.id as string,
        detail: `scheduled sub start_date=${startDate} (>${STALE_THRESHOLD_DAYS}d in the past) — cron has failed to activate; check SetupIntent ${(s.stripe_setup_intent_id as string)?.slice(0, 14) || 'NULL'} is still valid`,
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REPORT
  // ─────────────────────────────────────────────────────────────────────────

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`═══ RESULTS  (run took ${elapsed}s) ═══`)
  console.log(`Matched OK:           ${okCount}`)
  console.log(`Drifts found:         ${drifts.length}`)
  console.log()

  const sectionTitle: Record<DriftKind, string> = {
    sub_in_stripe_not_db: '🔴 Stripe subscriptions MISSING from DB',
    sub_in_db_not_stripe: '🟠 DB subscriptions MISSING from Stripe',
    sub_status_mismatch: '🟠 Subscription status mismatches',
    session_paid_no_payment_row: '🔴 Paid Checkout sessions with NO payment row',
    invoice_paid_no_payment_row: '🔴 Paid invoices (renewals) with NO payment row',
    payment_row_no_stripe_object: '🟠 Payment rows pointing at missing Stripe objects',
    customer_no_profile: '🟡 Stripe customers with no matching profile',
    sub_active_no_enrolment:
      '🔴 Parents PAYING in Stripe but child has NO active enrolment',
    enrolment_active_no_sub:
      '🟠 Children IN CLASS but parent has NO active subscription',
    customer_paid_no_enrolment:
      '🔴 Customers CHARGED in Stripe but child has NO active enrolment',
    booking_blocked_by_disagreement:
      '🔴 Parents BLOCKED at booking gate by Stripe ⇄ DB disagreement',
    dashboard_shows_subscribe_despite_stripe_sub:
      '🔴 Parents seeing "Subscribe" CTA despite ACTIVE Stripe subscription',
    // Stage 3 future-start lifecycle
    scheduled_sub_no_pending_enrolment:
      '🟠 Scheduled subs MISSING matching pending enrolment (seat not reserved)',
    pending_enrolment_no_scheduled_sub:
      '🟠 Pending enrolments with NO scheduled sub (orphan — booking blocked forever)',
    pending_enrolment_overdue:
      '🔴 Pending enrolments OVERDUE (cron did not flip to active on start_date)',
    stale_scheduled_sub:
      '🔴 Stale scheduled subs (start_date > 7d in the past, cron has failed)',
  }

  const byKind: Record<string, Drift[]> = {}
  for (const d of drifts) (byKind[d.kind] ||= []).push(d)

  // Reorder sections so trust-chain breaks come first (most operational impact)
  const printOrder: DriftKind[] = [
    'sub_active_no_enrolment',
    'customer_paid_no_enrolment',
    'booking_blocked_by_disagreement',
    'dashboard_shows_subscribe_despite_stripe_sub',
    'enrolment_active_no_sub',
    'sub_in_stripe_not_db',
    'session_paid_no_payment_row',
    'invoice_paid_no_payment_row',
    'sub_status_mismatch',
    'sub_in_db_not_stripe',
    'payment_row_no_stripe_object',
    'customer_no_profile',
    // Stage 3 — at the bottom because they only fire post-Stage-3 launch.
    'pending_enrolment_overdue',
    'stale_scheduled_sub',
    'scheduled_sub_no_pending_enrolment',
    'pending_enrolment_no_scheduled_sub',
  ]

  for (const kind of printOrder) {
    const items = byKind[kind] || []
    if (items.length === 0) {
      if (PRINT_OK) console.log(`✅  ${sectionTitle[kind]}  (0 cases)\n`)
      continue
    }
    console.log(`── ${sectionTitle[kind]}  (${items.length}) ──`)
    for (const d of items) {
      const who = d.parent_name || d.parent_email || d.customer_id || d.db_id || '?'
      const amt = d.amount !== undefined ? `  £${d.amount.toFixed(2)}` : ''
      const sts =
        d.status_stripe || d.status_db
          ? `  [stripe=${d.status_stripe || '?'} db=${d.status_db || '?'}]`
          : ''
      const sid = d.stripe_id ? `  ${d.stripe_id}` : ''
      const det = d.detail ? `\n     ${d.detail}` : ''
      console.log(`  ${who}${amt}${sts}${sid}${det}`)
    }
    console.log()
  }

  // ── Write JSON archive ──
  const out = {
    run_at: new Date().toISOString(),
    org_id: ORG_ID,
    org_name: org.name,
    window_days: DAYS,
    matched_ok: okCount,
    drift_count: drifts.length,
    drifts,
  }
  const fs = await import('fs/promises')
  const fname = `/tmp/reconcile-${ORG_ID.slice(0, 8)}-${Date.now()}.json`
  await fs.writeFile(fname, JSON.stringify(out, null, 2))
  console.log(`Full JSON report: ${fname}`)
}

run().catch((e) => {
  console.error('FATAL:', e)
  process.exit(2)
})
