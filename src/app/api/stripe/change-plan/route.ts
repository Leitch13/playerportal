import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { mapStripeCheckoutError } from '@/lib/stripe-errors'

/**
 * One-tap plan upgrade. Swaps the parent's EXISTING subscription to a higher
 * plan (with proration) instead of creating a second subscription, then enrols
 * the player in the requested class. Used by the schedule "Upgrade to book"
 * confirm.
 *
 * Subscriptions live on the platform account (destination charges), so we can
 * update them directly — no per-connected-account billing portal needed.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { playerId, groupId, newPlanId } = await request.json()
    if (!playerId || !groupId || !newPlanId) {
      return NextResponse.json({ error: 'Missing playerId, groupId or newPlanId' }, { status: 400 })
    }

    // Verify the player belongs to this parent
    const { data: player } = await supabase
      .from('players')
      .select('id, parent_id, first_name')
      .eq('id', playerId)
      .eq('parent_id', user.id)
      .single()
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    // The class + its org
    const { data: group } = await supabase
      .from('training_groups')
      .select('id, organisation_id')
      .eq('id', groupId)
      .single()
    if (!group) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

    // The target plan (must belong to this org + be active)
    const { data: newPlan } = await supabase
      .from('subscription_plans')
      .select('id, name, amount, interval, stripe_product_id, stripe_price_id, sessions_per_week')
      .eq('id', newPlanId)
      .eq('organisation_id', group.organisation_id)
      .eq('active', true)
      .single()
    if (!newPlan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    // The parent's active subscription to upgrade
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id, plan_id, plan:subscription_plans(amount)')
      .eq('parent_id', user.id)
      .eq('organisation_id', group.organisation_id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!sub?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription to upgrade.' }, { status: 400 })
    }

    const currentAmount = Number((sub.plan as unknown as { amount?: number } | null)?.amount ?? 0)
    if (Number(newPlan.amount) <= currentAmount) {
      return NextResponse.json({ error: 'Selected plan is not an upgrade.' }, { status: 400 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Ensure the target plan has a Stripe recurring price
    let stripePriceId = newPlan.stripe_price_id as string | null
    if (!stripePriceId) {
      let productId = newPlan.stripe_product_id as string | null
      if (!productId) {
        const product = await stripe.products.create({
          name: newPlan.name,
          metadata: { supabase_plan_id: newPlan.id },
        })
        productId = product.id
        await admin.from('subscription_plans').update({ stripe_product_id: productId }).eq('id', newPlan.id)
      }
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(Number(newPlan.amount) * 100),
        currency: 'gbp',
        recurring: { interval: newPlan.interval === 'year' ? 'year' : 'month' },
        metadata: { supabase_plan_id: newPlan.id },
      })
      stripePriceId = price.id
      await admin.from('subscription_plans').update({ stripe_price_id: stripePriceId }).eq('id', newPlan.id)
    }

    // Swap the price on the existing subscription, prorated. transfer_data /
    // application_fee on the sub are preserved across the update.
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    const itemId = stripeSub.items.data[0]?.id
    if (!itemId) return NextResponse.json({ error: 'Subscription has no billable item.' }, { status: 500 })

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: itemId, price: stripePriceId }],
      // always_invoice = prorate the difference AND charge it now, so the
      // parent pays for the upgrade immediately rather than on next month's bill.
      proration_behavior: 'always_invoice',
    })

    // Point our subscription row at the new plan
    await admin.from('subscriptions').update({ plan_id: newPlan.id, updated_at: new Date().toISOString() }).eq('id', sub.id)

    // Enrol the player in the class now that they have capacity (idempotent).
    //
    // 079 — for a brand-new enrolment use the atomic capacity-check RPC.
    // For an existing-but-cancelled enrolment we re-activate in place (no
    // capacity check needed because the seat was already theirs and we're
    // not adding a new one — though if a busy academy has filled the seat
    // since they cancelled, that's a future-call decision; leaving the
    // re-activate path as-is to preserve change-plan behaviour).
    const { data: existing } = await admin
      .from('enrolments')
      .select('id, status')
      .eq('player_id', playerId)
      .eq('group_id', groupId)
      .maybeSingle()
    if (existing) {
      if (existing.status !== 'active') {
        await admin.from('enrolments').update({ status: 'active' }).eq('id', existing.id)
      }
    } else {
      const { data: cpRes, error: cpErr } = await admin.rpc('enrol_if_capacity_available', {
        p_player_id: playerId,
        p_group_id: groupId,
        p_org_id: group.organisation_id,
        p_status: 'active',
        p_activates_on: null,
      })
      if (cpErr) {
        console.error('[change-plan] enrol RPC failed', cpErr.message)
        // change-plan already committed the sub change — don't roll that
        // back here. Log + continue; an admin can manually enrol later.
      }
      const cr = (cpRes ?? {}) as { ok?: boolean; error?: string; capacity?: number; count?: number }
      if (!cr.ok && cr.error === 'class_full') {
        console.error('[change-plan] class_full at enrol — plan changed but no seat', { playerId, groupId, capacity: cr.capacity, count: cr.count })
      }
    }

    return NextResponse.json({ success: true, newPlanName: newPlan.name })
  } catch (err) {
    console.error('Change-plan error:', err)
    return NextResponse.json({ error: mapStripeCheckoutError(err) }, { status: 500 })
  }
}
