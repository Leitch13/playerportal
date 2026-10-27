import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/email'
import {
  specProblem, couponParams, addCouponToSubscription, removeDiscountFromSubscription,
  amountLabel, durationLabel, discountedPence, CHILD_DISCOUNT_GIVEN, CHILD_DISCOUNT_REMOVED,
  type ChildDiscountRecord, type DiscountSpec,
} from '@/lib/discounts'

export const dynamic = 'force-dynamic'

/**
 * Give one child's membership a discount, or take it off (John, 27 Oct 2026: "a discount like
 * ClassForKids"). Same for every academy. The discount goes on the Stripe subscription next to
 * anything already there, comes off the monthly payments from the next one, and the parent is
 * emailed. Recorded in audit_log (discount.child_given / discount.child_removed), which is what the
 * Discounts page lists. 1-2-1s use the family's credit instead (1-2-1s → credit.add).
 */

const LIVE = ['active', 'trialing', 'past_due']
const db = () => createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] as string))

async function adminOrg(): Promise<{ userId: string; orgId: string } | NextResponse> {
  const supa = await createServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  const { data: role } = await supa.rpc('get_my_role')
  if (role !== 'admin') return NextResponse.json({ error: 'Only academy admins can give discounts.' }, { status: 403 })
  const { data: orgId } = await supa.rpc('get_my_org')
  if (!orgId) return NextResponse.json({ error: 'Your account is not linked to an academy.' }, { status: 400 })
  return { userId: user.id, orgId: orgId as string }
}

export async function POST(request: NextRequest) {
  const who = await adminOrg()
  if (who instanceof NextResponse) return who
  const body = await request.json().catch(() => ({}))
  const spec = { type: body.type, value: body.type === 'fixed' ? Math.round(Number(body.value) * 100) : Number(body.value), duration: body.duration }
  const problem = specProblem(spec)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })
  const reason = String(body.reason || '').trim().slice(0, 200)

  const admin = db()
  const { data: sub } = await admin.from('subscriptions')
    .select('id, status, stripe_subscription_id, player_id, parent_id, organisation_id, plan:subscription_plans(name, amount), player:players(first_name, last_name)')
    .eq('id', String(body.subscriptionId || '')).maybeSingle()
  if (!sub || sub.organisation_id !== who.orgId) return NextResponse.json({ error: 'Membership not found.' }, { status: 404 })
  if (!sub.stripe_subscription_id || !LIVE.includes(sub.status as string)) {
    return NextResponse.json({ error: 'This membership isn’t paying yet. Give the discount once the parent has signed up.' }, { status: 400 })
  }
  const plan = sub.plan as unknown as { name: string; amount: number }
  const player = sub.player as unknown as { first_name: string; last_name: string | null }
  const s = spec as DiscountSpec
  const monthlyPence = Math.round(Number(plan.amount) * 100)
  if (s.type === 'fixed' && s.value > monthlyPence) return NextResponse.json({ error: `That's more than the £${plan.amount} membership.` }, { status: 400 })

  const coupon = await stripe.coupons.create(couponParams(s, `${player.first_name}: ${amountLabel(s)}`, { type: 'child_discount', organisation_id: who.orgId, player_id: sub.player_id as string }))
  const discountId = await addCouponToSubscription(stripe, sub.stripe_subscription_id as string, coupon.id)

  const record: ChildDiscountRecord = {
    player_id: sub.player_id as string, subscription_id: sub.id as string, stripe_subscription_id: sub.stripe_subscription_id as string,
    discount_id: discountId, coupon_id: coupon.id, type: s.type, value: s.value, duration: s.duration, reason,
    plan_name: plan.name, plan_amount: Number(plan.amount),
  }
  await admin.from('audit_log').insert({ organisation_id: who.orgId, user_id: who.userId, action: CHILD_DISCOUNT_GIVEN, entity_type: 'subscription', entity_id: sub.id, details: record })

  // Tell the parent what they'll pay.
  const { data: parent } = await admin.from('profiles').select('email, full_name').eq('id', sub.parent_id).maybeSingle()
  const { data: org } = await admin.from('organisations').select('name').eq('id', who.orgId).single()
  const newPounds = (discountedPence(monthlyPence, s) / 100).toFixed(2)
  let emailed = false
  if (parent?.email) {
    const r = await sendEmail({
      to: parent.email as string, fromName: org?.name as string,
      subject: `${player.first_name}'s membership: ${amountLabel(s)}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#1b2430;font-size:15px;line-height:1.5">
        <p>Hi ${esc(((parent.full_name as string) || '').split(' ')[0] || 'there')},</p>
        <p>${esc(org?.name as string)} has given ${esc(player.first_name)} a discount: <b>${amountLabel(s)}</b> the ${esc(plan.name)}.</p>
        <p>You'll pay <b>£${newPounds}</b> instead of £${Number(plan.amount).toFixed(2)}, for ${durationLabel(s.duration)}. You don't need to do anything.</p>
        <p style="color:#5b6674;font-size:13px">Questions? Just reply to the academy.</p></div>`,
    }).catch(() => null)
    emailed = !!(r as { success?: boolean } | null)?.success
  }
  return NextResponse.json({ ok: true, newAmount: newPounds, emailed })
}

/** Take a child's discount off. Body: { auditId } (the discount.child_given row). */
export async function DELETE(request: NextRequest) {
  const who = await adminOrg()
  if (who instanceof NextResponse) return who
  const body = await request.json().catch(() => ({}))
  const admin = db()
  const { data: row } = await admin.from('audit_log').select('id, organisation_id, details').eq('id', String(body.auditId || '')).eq('action', CHILD_DISCOUNT_GIVEN).maybeSingle()
  if (!row || row.organisation_id !== who.orgId) return NextResponse.json({ error: 'Discount not found.' }, { status: 404 })
  const rec = row.details as ChildDiscountRecord
  if (rec.discount_id) {
    try { await removeDiscountFromSubscription(stripe, rec.stripe_subscription_id, rec.discount_id) }
    catch (e) { return NextResponse.json({ error: `Stripe refused: ${e instanceof Error ? e.message : 'unknown'}` }, { status: 502 }) }
  }
  await admin.from('audit_log').insert({ organisation_id: who.orgId, user_id: who.userId, action: CHILD_DISCOUNT_REMOVED, entity_type: 'subscription', entity_id: rec.subscription_id, details: { given_audit_id: row.id, ...rec } })
  return NextResponse.json({ ok: true })
}
