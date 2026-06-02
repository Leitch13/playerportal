/**
 * Per-row activation of a Stage 3 scheduled subscription.
 *
 * Extracted from /api/cron/activate-scheduled-subs (which now calls this in a
 * loop) so the same logic can be invoked manually by the admin "Activate now"
 * action in the Enrolments page. Behaviour is byte-identical to the cron's
 * inner loop — the only difference is that the cron iterates over all
 * scheduled rows ≤ today, while the admin endpoint invokes this for a single
 * sub id chosen by an academy admin.
 *
 * Idempotency is preserved: the Stripe API call uses
 *   idempotencyKey = `sub_activate_${row.id}_${row.start_date}`
 * so re-running this for the same (sub, start_date) cannot create a second
 * Stripe subscription. Admin → Activate now → cron run later → both no-op.
 */

import Stripe from 'stripe'
import { firstOfNextMonthUnix } from './anchor'

export interface ScheduledSubRow {
  id: string
  parent_id: string
  player_id: string | null
  plan_id: string
  organisation_id: string
  start_date: string
  stripe_setup_intent_id: string | null
  stripe_customer_id: string | null
  training_group_id: string | null
}

export interface ActivationResult {
  sub_id: string
  start_date: string
  ok: boolean
  stripe_subscription_id?: string
  error?: string
}

// Minimal Supabase shape we need — we accept anything that exposes a Supabase
// .from() chain. Keeps the helper agnostic to client/server/service-role
// flavours of the Supabase SDK.
type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, v: string) => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [k: string]: any
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [k: string]: any
    }
    update: (vals: Record<string, unknown>) => {
      eq: (col: string, v: string) => {
        eq: (col: string, v: string) => {
          eq: (col: string, v: string) => Promise<{ error: { message: string } | null }>
        }
      }
    }
  }
}

export async function activateScheduledSubRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  stripe: Stripe,
  row: ScheduledSubRow,
): Promise<ActivationResult> {
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
        throw new Error(`setup_intent ${row.stripe_setup_intent_id} unreadable: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (!defaultPm) throw new Error(`no payment method on SetupIntent for sub ${row.id}`)
    if (!row.stripe_customer_id) throw new Error(`no stripe_customer_id on sub ${row.id}`)

    const anchor = firstOfNextMonthUnix(new Date())

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
        idempotencyKey: `sub_activate_${row.id}_${row.start_date}`,
      },
    )

    const { error: updErr } = await supabase
      .from('subscriptions')
      .update({
        stripe_subscription_id: stripeSub.id,
        status: stripeSub.status,
      })
      .eq('id', row.id)
    if (updErr) {
      console.error(`[activate-sub] DB update failed for sub ${row.id} (Stripe sub ${stripeSub.id}):`, updErr.message)
    }

    if (row.training_group_id && row.player_id) {
      const { error: enrolErr } = await supabase
        .from('enrolments')
        .update({ status: 'active' })
        .eq('player_id', row.player_id)
        .eq('group_id', row.training_group_id)
        .eq('status', 'pending')
      if (enrolErr) {
        console.error(`[activate-sub] enrolment flip failed for sub ${row.id} (player ${row.player_id}, group ${row.training_group_id}):`, enrolErr.message)
      }
    }

    return {
      sub_id: row.id,
      start_date: row.start_date,
      ok: true,
      stripe_subscription_id: stripeSub.id,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[activate-sub] failed for sub ${row.id}:`, message)
    return {
      sub_id: row.id,
      start_date: row.start_date,
      ok: false,
      error: message,
    }
  }
  // Suppress unused-var warning for the SupabaseLike type — kept for documentation.
  void (null as unknown as SupabaseLike)
}
