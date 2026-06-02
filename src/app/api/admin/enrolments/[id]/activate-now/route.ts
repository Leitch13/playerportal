import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  activateScheduledSubRow,
  type ScheduledSubRow,
} from '@/lib/billing/activate-scheduled-sub'

/**
 * Admin override for the Stage 3 activation cron — flips a single scheduled
 * subscription to active NOW instead of waiting for the 02:00 UTC cron.
 *
 * Reuses the SAME per-row activation helper the cron uses (extracted into
 * src/lib/billing/activate-scheduled-sub.ts). No new Stripe primitives, no
 * deviation from the cron's verified flow — only the trigger differs.
 *
 * Auth model:
 *   - Caller must be a signed-in user with role='admin' on the same org as
 *     the enrolment. Service-role client is used for the actual Stripe + DB
 *     write so that RLS doesn't get in the way of the cron-equivalent path,
 *     but the auth check above is the gate.
 *
 * Idempotency: handled by activateScheduledSubRow's Stripe idempotencyKey.
 * Calling this twice in quick succession is a no-op.
 *
 * Input:  POST  /api/admin/enrolments/{enrolmentId}/activate-now
 *   - `enrolmentId` identifies the pending enrolment row. We look up the
 *     matching scheduled subscription via (player_id, training_group_id).
 *
 * Output:
 *   { ok: true,  stripe_subscription_id }  on success
 *   { ok: false, error }                    on any failure
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: enrolmentId } = await params

  // 1) Auth: user must be admin of THIS org.
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }
  const myOrgId = me.organisation_id as string

  // 2) Resolve the enrolment (must be pending, must be in my org).
  const { data: enrolment } = await supabase
    .from('enrolments')
    .select('id, player_id, group_id, organisation_id, status')
    .eq('id', enrolmentId)
    .maybeSingle()
  if (!enrolment || enrolment.organisation_id !== myOrgId) {
    return NextResponse.json({ ok: false, error: 'Enrolment not found' }, { status: 404 })
  }
  if (enrolment.status !== 'pending') {
    return NextResponse.json({ ok: false, error: `Cannot activate enrolment in status '${enrolment.status}'` }, { status: 400 })
  }

  // 3) Find the matching scheduled subscription.
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: scheduledSub } = await service
    .from('subscriptions')
    .select('id, parent_id, player_id, plan_id, organisation_id, start_date, stripe_setup_intent_id, stripe_customer_id, training_group_id')
    .eq('player_id', enrolment.player_id)
    .eq('training_group_id', enrolment.group_id)
    .eq('status', 'scheduled')
    .maybeSingle()
  if (!scheduledSub) {
    return NextResponse.json({ ok: false, error: 'No scheduled subscription matches this enrolment' }, { status: 404 })
  }

  // 4) Activate via the shared helper (same code path as the daily cron).
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
  })
  const result = await activateScheduledSubRow(service, stripe, scheduledSub as ScheduledSubRow)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error || 'Activation failed' }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    stripe_subscription_id: result.stripe_subscription_id,
    sub_id: result.sub_id,
  })
}
