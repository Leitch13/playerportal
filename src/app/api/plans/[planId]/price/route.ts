import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────
// Change a plan's price — in the app AND at Stripe, or not at all.
//
// The old behaviour: the plan editor wrote the new amount straight from the
// browser to the database and nulled `stripe_price_id`, with a comment
// admitting "changing amount won't update the Stripe price". Existing members
// carried on paying the old figure indefinitely. The academy saw the new price
// everywhere in the app and had no way of knowing.
//
// On 1 Sep 2026 that meant seven Gold & Gray families were charged the old
// price on the same morning — £230.80 short across one billing run — and the
// academy owner had spent a week trying to work out where her money had gone.
// She had done nothing wrong: she used the feature exactly as it presents.
//
// What this does instead:
//   • updates the plan row
//   • creates a NEW Stripe price at the new amount (never edits the old price
//     object — other subscriptions may still be attached to it)
//   • moves every live subscription on that plan onto it, with
//     proration_behavior 'none' so the new amount starts at each member's next
//     billing date and NOBODY is charged today
//
// `applyToExisting: false` updates the plan for new joiners only and leaves
// current members where they are — a legitimate choice, but it has to be an
// explicit one rather than what happens by accident.
//
// Connect routing, on_behalf_of and application_fee_percent live on the
// subscription, not the price, so swapping the price item leaves all of them
// untouched.
// ─────────────────────────────────────────────────────────────────────────

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ planId: string }> },
) {
  const { planId } = await ctx.params

  // ── Signed-in admin of this academy only ──
  const supa = await createServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  const { data: role } = await supa.rpc('get_my_role')
  if (role !== 'admin') return NextResponse.json({ error: 'Only academy admins can change a plan.' }, { status: 403 })
  const { data: orgId } = await supa.rpc('get_my_org')
  if (!orgId) return NextResponse.json({ error: 'Your account is not linked to an academy.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const newAmount = Number(body.amount)
  const applyToExisting = body.applyToExisting !== false
  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    return NextResponse.json({ error: 'Enter a valid monthly amount.' }, { status: 400 })
  }

  const db = adminDb()
  const { data: plan } = await db
    .from('subscription_plans')
    .select('id, name, amount, interval, organisation_id, stripe_price_id, stripe_product_id')
    .eq('id', planId)
    .single()
  if (!plan || plan.organisation_id !== orgId) {
    return NextResponse.json({ error: 'Plan not found.' }, { status: 404 })
  }

  const oldAmount = Number(plan.amount)
  const priceChanged = Math.abs(oldAmount - newAmount) > 0.001

  // ── Fields other than the amount are a plain update ──
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), amount: newAmount }
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.description === 'string') patch.description = body.description.trim() || null
  if (body.sessionsPerWeek != null && Number.isFinite(Number(body.sessionsPerWeek))) {
    patch.sessions_per_week = Number(body.sessionsPerWeek)
  }

  if (!priceChanged) {
    const { error } = await db.from('subscription_plans').update(patch).eq('id', planId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'saved', priceChanged: false, membersMoved: 0 })
  }

  // ── A new Stripe price. Never edit the existing one: prices are immutable
  //    in Stripe for good reason, and other subscriptions may reference it. ──
  let productId = plan.stripe_product_id as string | null
  if (!productId) {
    const { data: org } = await db.from('organisations').select('name').eq('id', orgId).single()
    const product = await stripe.products.create({
      name: `${org?.name || 'Academy'} — ${plan.name}`,
      metadata: { organisation_id: String(orgId), plan_id: planId },
    })
    productId = product.id
  }

  const interval = (plan.interval as Stripe.PriceCreateParams.Recurring.Interval) || 'month'
  const price = await stripe.prices.create({
    product: productId,
    currency: 'gbp',
    unit_amount: Math.round(newAmount * 100),
    recurring: { interval },
    metadata: {
      organisation_id: String(orgId),
      plan_id: planId,
      previous_amount: oldAmount.toFixed(2),
      changed_on: new Date().toISOString().slice(0, 10),
    },
  })

  const { error: planErr } = await db
    .from('subscription_plans')
    .update({ ...patch, stripe_price_id: price.id, stripe_product_id: productId })
    .eq('id', planId)
  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })

  if (!applyToExisting) {
    return NextResponse.json({
      status: 'saved', priceChanged: true, membersMoved: 0, membersLeftAlone: null,
      message: `New members will pay £${newAmount.toFixed(2)}. Existing members stay on £${oldAmount.toFixed(2)}.`,
    })
  }

  // ── Move everyone currently paying on this plan ──
  const { data: live } = await db
    .from('subscriptions')
    .select('id, parent_id, stripe_subscription_id')
    .eq('plan_id', planId)
    .eq('organisation_id', orgId)
    .in('status', ['active', 'trialing', 'past_due'])
    .limit(1000)

  let moved = 0
  const failed: string[] = []
  for (const s of live || []) {
    if (!s.stripe_subscription_id) continue
    try {
      const sub = await stripe.subscriptions.retrieve(s.stripe_subscription_id as string)
      const item = sub.items.data[0]
      if (!item) { failed.push(`${s.stripe_subscription_id}: no item`); continue }
      await stripe.subscriptions.update(s.stripe_subscription_id as string, {
        items: [{ id: item.id, price: price.id }],
        // The whole point: the new amount applies from their NEXT billing date.
        // Anything else bills the difference immediately and a parent gets an
        // unexpected charge on the day their academy edited a number.
        proration_behavior: 'none',
      })
      moved++
    } catch (e) {
      failed.push(`${s.stripe_subscription_id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({
    status: 'saved',
    priceChanged: true,
    from: oldAmount,
    to: newAmount,
    membersMoved: moved,
    ...(failed.length ? { failed } : {}),
    message: `£${oldAmount.toFixed(2)} → £${newAmount.toFixed(2)}. ${moved} ${moved === 1 ? 'member moves' : 'members move'} at their next payment. Nothing charged today.`,
  }, { status: failed.length ? 207 : 200 })
}
