import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import {
  activateScheduledSubRow,
  type ScheduledSubRow,
  type ActivationResult,
} from '@/lib/billing/activate-scheduled-sub'

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
    .select('id, parent_id, player_id, plan_id, organisation_id, start_date, stripe_setup_intent_id, stripe_customer_id, training_group_id')
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
  const results: ActivationResult[] = []

  // Per-row activation logic lives in src/lib/billing/activate-scheduled-sub.ts
  // so the same code path serves both this cron and the admin "Activate now"
  // action on the Enrolments page. Byte-identical behaviour — only the
  // selection criteria differ (cron: all rows ≤ today; admin: one row).
  for (const row of candidates) {
    const result = await activateScheduledSubRow(supabase, stripe, row)
    results.push(result)
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
