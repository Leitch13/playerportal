import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { firstOfNextMonthUnix } from '@/lib/billing/anchor'

/**
 * Stage 3 — daily activation cron for scheduled subscriptions.
 *
 * Runs once per day at 02:00 UTC (see vercel.json). Queries
 * `subscriptions` for rows with status='scheduled' and start_date <= today,
 * then activates each by creating a real Stripe subscription with
 * billing_cycle_anchor at the 1st of next month + create_prorations
 * (exactly the same Stage 2 primitive — just deferred). On success, the
 * `customer.subscription.created` webhook flips the DB row to 'active'.
 *
 * Idempotency is guaranteed by the per-row idempotency key:
 *   `sub_activate_${db_subscription_id}_${start_date_iso}`
 * — re-running the cron for the same row cannot create two Stripe subs.
 *
 * Safety:
 *   - Bearer auth required (CRON_SECRET) — never invoke from public clients
 *   - BILLING_FUTURE_START_KILL=true short-circuits the cron without scanning
 *   - Errors per row do not abort the batch; each row is logged + skipped
 *
 * Reverse rollback: delete vercel.json cron entry + flip kill switch.
 * The DB rows with status='scheduled' remain unbilled until cron resumes.
 */

export const maxDuration = 300
export const dynamic = 'force-dynamic'

interface ScheduledSubRow {
  id: string
  parent_id: string
  player_id: string | null
  plan_id: string
  organisation_id: string
  start_date: string
  stripe_setup_intent_id: string | null
  stripe_customer_id: string | null
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (process.env.BILLING_FUTURE_START_KILL === 'true') {
    return NextResponse.json({
      skipped: true,
      reason: 'BILLING_FUTURE_START_KILL=true',
    })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
  })
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const todayIso = new Date().toISOString().split('T')[0]

  // Query rows ready to activate. Limit to 100 per run as a safety cap —
  // far more than expected (typical academies see < 5 future-start signups
  // per day). If we ever queue 100+ activations, we have a bigger ops issue.
  const { data: rows, error: queryErr } = await supabase
    .from('subscriptions')
    .select('id, parent_id, player_id, plan_id, organisation_id, start_date, stripe_setup_intent_id, stripe_customer_id')
    .eq('status', 'scheduled')
    .lte('start_date', todayIso)
    .limit(100)

  if (queryErr) {
    return NextResponse.json(
      { error: 'query failed', message: queryErr.message },
      { status: 500 }
    )
  }

  const candidates = (rows ?? []) as ScheduledSubRow[]
  const results: Array<{
    sub_id: string
    start_date: string
    ok: boolean
    stripe_subscription_id?: string
    error?: string
  }> = []

  for (const row of candidates) {
    try {
      // Resolve the plan + org for Stripe params
      const { data: plan, error: planErr } = await supabase
        .from('subscription_plans')
        .select('stripe_price_id, organisation_id, amount')
        .eq('id', row.plan_id)
        .single()
      if (planErr || !plan?.stripe_price_id) {
        throw new Error(`plan ${row.plan_id} has no stripe_price_id`)
      }

      const { data: org } = await supabase
        .from('organisations')
        .select('stripe_account_id, platform_plan_id')
        .eq('id', row.organisation_id)
        .single()
      if (!org?.stripe_account_id) {
        throw new Error(`org ${row.organisation_id} has no stripe_account_id`)
      }

      // Resolve platform fee rate
      let feePercent = 3.5
      if (org.platform_plan_id) {
        const { data: pp } = await supabase
          .from('platform_plans')
          .select('transaction_fee_percent')
          .eq('id', org.platform_plan_id)
          .single()
        if (pp?.transaction_fee_percent != null) {
          feePercent = Number(pp.transaction_fee_percent)
        }
      }

      // Resolve the SetupIntent's payment method (saved at signup)
      let defaultPm: string | null = null
      if (row.stripe_setup_intent_id) {
        try {
          const si = await stripe.setupIntents.retrieve(row.stripe_setup_intent_id)
          defaultPm = typeof si.payment_method === 'string'
            ? si.payment_method
            : si.payment_method?.id ?? null
        } catch (e) {
          // SetupIntent may have expired (>30 days). Surface clearly.
          throw new Error(`setup_intent ${row.stripe_setup_intent_id} unreadable: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      if (!defaultPm) {
        throw new Error(`no payment method on SetupIntent for sub ${row.id}`)
      }
      if (!row.stripe_customer_id) {
        throw new Error(`no stripe_customer_id on sub ${row.id}`)
      }

      // Compute billing_cycle_anchor = 1st of next month from TODAY
      // (not from start_date — start_date is already <= today, and Stripe
      // requires anchor strictly in the future).
      const anchor = firstOfNextMonthUnix(new Date())

      // Create the Stripe subscription. Same primitive as Stage 2's
      // immediate_prorated branch — verified end-to-end in Probe 7.
      const stripeSub = await stripe.subscriptions.create(
        {
          customer: row.stripe_customer_id,
          items: [{ price: plan.stripe_price_id }],
          default_payment_method: defaultPm,
          billing_cycle_anchor: anchor,
          proration_behavior: 'create_prorations',
          collection_method: 'charge_automatically',
          on_behalf_of: org.stripe_account_id,
          application_fee_percent: feePercent,
          transfer_data: { destination: org.stripe_account_id },
          metadata: {
            supabase_subscription_id: row.id,
            supabase_user_id: row.parent_id,
            supabase_plan_id: row.plan_id,
            ...(row.player_id ? { supabase_player_id: row.player_id } : {}),
            billing_model: 'future_prorated',
            activates_on: row.start_date,
            pp_flow: 'future_prorated_activation',
          },
        },
        {
          // Idempotency: re-running the cron for the same row cannot create
          // a second Stripe sub. Key includes start_date so a manual edit
          // of start_date (admin action) would allow re-activation.
          idempotencyKey: `sub_activate_${row.id}_${row.start_date}`,
        }
      )

      // Update DB row immediately so subsequent webhook deliveries find it
      // by stripe_subscription_id. The webhook will further mark active +
      // record the prorated invoice via the normal renewal flow.
      const { error: updErr } = await supabase
        .from('subscriptions')
        .update({
          stripe_subscription_id: stripeSub.id,
          status: stripeSub.status,
        })
        .eq('id', row.id)
      if (updErr) {
        // Stripe sub was created successfully; DB update failed. Log and
        // continue — the next webhook delivery will correct it.
        console.error(`[cron-activate] DB update failed for sub ${row.id} (Stripe sub ${stripeSub.id}):`, updErr.message)
      }

      results.push({
        sub_id: row.id,
        start_date: row.start_date,
        ok: true,
        stripe_subscription_id: stripeSub.id,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[cron-activate] failed for sub ${row.id}:`, message)
      results.push({
        sub_id: row.id,
        start_date: row.start_date,
        ok: false,
        error: message,
      })
    }
  }

  const successCount = results.filter((r) => r.ok).length
  const errorCount = results.length - successCount

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    today: todayIso,
    candidates: candidates.length,
    activated: successCount,
    errors: errorCount,
    results,
  })
}
