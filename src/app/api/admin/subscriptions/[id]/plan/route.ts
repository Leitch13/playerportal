import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

/**
 * Change one family's plan. POST { planId, confirm }
 *   confirm false → preview only: what their next bill becomes, and when. Nothing changes.
 *   confirm true  → Stripe first (new price from the NEXT bill, proration 'none': nothing
 *                   charged today, no part-month credit), then our row. If our row can't be
 *                   saved, Stripe is put back so the two never disagree.
 *
 * Replaces the Payments-page drop-down switched off on 2 Sep 2026: it changed our row only
 * and Stripe kept charging the old price (4 families on the wrong amount for months).
 * John's written yes 30 Sep 2026. Same for every academy; academy admins only.
 * Billing guard rule 9. Only the one membership the admin picks is touched.
 */
type Body = { planId?: string; confirm?: boolean }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as Body

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Only academy admins can change a plan' }, { status: 403 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: row } = await admin.from('subscriptions')
    .select('id, organisation_id, parent_id, player_id, status, plan_id, stripe_subscription_id')
    .eq('id', id).maybeSingle()
  if (!row || row.organisation_id !== me.organisation_id) return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  if (!row.stripe_subscription_id) return NextResponse.json({ error: "This membership isn't billed through Stripe yet, so its plan can't be changed here." }, { status: 409 })
  if (!['active', 'trialing', 'paused'].includes(row.status)) return NextResponse.json({ error: `A ${row.status} membership's plan can't be changed.` }, { status: 409 })

  const planId = String(body.planId || '')
  if (!planId || planId === row.plan_id) return NextResponse.json({ error: 'Pick a different plan' }, { status: 400 })
  const { data: plan } = await admin.from('subscription_plans')
    .select('id, name, amount, interval, active, organisation_id, stripe_product_id, stripe_price_id').eq('id', planId).maybeSingle()
  if (!plan || plan.organisation_id !== row.organisation_id || !plan.active) return NextResponse.json({ error: 'That plan isn’t available at this academy' }, { status: 400 })
  const { data: oldPlan } = await admin.from('subscription_plans').select('name, amount').eq('id', row.plan_id).maybeSingle()

  const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
  if (sub.status === 'canceled') return NextResponse.json({ error: 'This membership has ended in Stripe.' }, { status: 409 })
  if (sub.items.data.length !== 1) return NextResponse.json({ error: 'This membership has more than one item in Stripe; change it by hand.' }, { status: 409 })
  const item = sub.items.data[0]
  if ((item.price.recurring?.interval_count ?? 1) !== 1 || item.price.recurring?.interval !== (plan.interval === 'year' ? 'year' : 'month')) {
    return NextResponse.json({ error: 'Quarterly or yearly memberships can’t be switched here yet. Ask Player Portal to do it.' }, { status: 409 })
  }

  // The new plan's monthly price in Stripe (created once and saved on the plan, as checkout does).
  let productId = plan.stripe_product_id as string | null
  let priceId = plan.stripe_price_id as string | null
  if (priceId) {
    const p = await stripe.prices.retrieve(priceId)
    if (!p.active || p.unit_amount !== Math.round(Number(plan.amount) * 100) || p.recurring?.interval_count !== 1) priceId = null
  }
  if (!priceId) {
    if (!body.confirm) {
      // Preview without creating anything in Stripe.
      return NextResponse.json({ ok: true, preview: previewText(oldPlan, plan, Math.round(Number(plan.amount) * 100), nextBillDate(sub), sub) })
    }
    if (!productId) {
      const product = await stripe.products.create({ name: plan.name, metadata: { supabase_plan_id: plan.id } })
      productId = product.id
      await admin.from('subscription_plans').update({ stripe_product_id: productId }).eq('id', plan.id)
    }
    const price = await stripe.prices.create({
      product: productId, unit_amount: Math.round(Number(plan.amount) * 100), currency: 'gbp',
      recurring: { interval: plan.interval === 'year' ? 'year' : 'month' },
      metadata: { supabase_plan_id: plan.id, billing_option: 'monthly' },
    })
    priceId = price.id
    await admin.from('subscription_plans').update({ stripe_price_id: priceId }).eq('id', plan.id)
  }

  // What their next bill becomes (discounts such as a sibling 20% carry over).
  // No upcoming bill (no card on file, or the membership is set to end) is not an error:
  // the plan can still change, there's just no next payment to show.
  let nextPence: number | null = null
  try {
    const preview = await stripe.invoices.createPreview({
      subscription: sub.id,
      subscription_details: { items: [{ id: item.id, price: priceId }], proration_behavior: 'none' },
    })
    nextPence = preview.amount_due
  } catch (e) {
    if ((e as { code?: string }).code !== 'invoice_upcoming_none') throw e
  }
  const text = previewText(oldPlan, plan, nextPence, nextBillDate(sub), sub)
  if (!body.confirm) return NextResponse.json({ ok: true, preview: text })

  // Stripe first, then our row; put Stripe back if our row can't be saved.
  const oldPriceId = item.price.id
  await stripe.subscriptions.update(sub.id, { items: [{ id: item.id, price: priceId }], proration_behavior: 'none' })
  const { error } = await admin.from('subscriptions').update({ plan_id: plan.id, updated_at: new Date().toISOString() }).eq('id', row.id)
  if (error) {
    await stripe.subscriptions.update(sub.id, { items: [{ id: item.id, price: oldPriceId }], proration_behavior: 'none' })
    return NextResponse.json({ error: `Nothing changed: Player Portal couldn’t save the new plan (${error.message}).` }, { status: 500 })
  }

  await admin.from('audit_log').insert({
    organisation_id: row.organisation_id, user_id: user.id, action: 'subscription.plan_changed', entity_type: 'subscription', entity_id: row.id,
    details: { from_plan_id: row.plan_id, to_plan_id: plan.id, from_price: oldPriceId, to_price: priceId, next_bill_pence: nextPence, next_bill_date: text.nextDate },
  }).then(() => undefined, () => undefined)

  // Tell the family what changed. A failed email never undoes the change.
  const { data: parent } = await admin.from('profiles').select('email, full_name').eq('id', row.parent_id).maybeSingle()
  const { data: org } = await admin.from('organisations').select('name, contact_email').eq('id', row.organisation_id).maybeSingle()
  const { data: child } = await admin.from('players').select('first_name').eq('id', row.player_id).maybeSingle()
  if (parent?.email) {
    const academy = (org?.name as string) || 'Your academy'
    const who = (child?.first_name as string) || 'your child'
    await sendEmail({
      to: parent.email, fromName: academy, replyTo: (org?.contact_email as string) || undefined,
      subject: `${academy}: ${who}'s plan has changed`,
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;color:#1a1a1a;line-height:1.6;font-size:15px">
<p>Hi ${esc(((parent.full_name as string) || '').split(' ')[0] || 'there')},</p>
<p>${esc(academy)} has moved ${esc(who)} to <b>${esc(plan.name)}</b> at <b>£${Number(plan.amount).toFixed(2)} a month</b>.</p>
<p>Nothing is charged today.${nextPence === null ? '' : ` Your next payment on <b>${esc(text.nextDate)}</b> will be <b>£${(nextPence / 100).toFixed(2)}</b>.`}</p>
<p>Any questions, just reply to this email.</p></div>`,
    }).catch(() => undefined)
  }
  return NextResponse.json({ ok: true, changed: text })
}

function nextBillDate(sub: Stripe.Subscription): string {
  const s = sub as unknown as { trial_end?: number | null; current_period_end?: number; items: { data: { current_period_end?: number }[] } }
  const unix = (sub.status === 'trialing' && s.trial_end) ? s.trial_end : (s.current_period_end ?? s.items.data[0]?.current_period_end ?? 0)
  return new Date(unix * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/London' })
}

function previewText(oldPlan: { name: string; amount: number | string } | null, plan: { name: string; amount: number | string }, nextPence: number | null, nextDate: string, sub: Stripe.Subscription) {
  return {
    from: oldPlan ? `${oldPlan.name} (£${Number(oldPlan.amount).toFixed(2)})` : 'current plan',
    to: `${plan.name} (£${Number(plan.amount).toFixed(2)})`,
    nextAmount: nextPence === null ? 'none due (no card on file or membership ending)' : `£${(nextPence / 100).toFixed(2)}`,
    nextDate,
    paused: !!sub.pause_collection,
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
