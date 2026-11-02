import type { SupabaseClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/email'

/**
 * A class membership whose card didn't go through: a link the parent can pay from, that keeps working.
 *
 * John, 2 Nov 2026 (No.1, Cammy couldn't chase anyone): "build the buttons why are they not there?"
 * The academy presses Send payment link (child page, class register, Enrolments → In a class, not
 * paying), and the parent is emailed /pay/membership/<subscription id>. Every tap there opens Stripe's
 * page for the bill that's still open, so the link never goes stale. Paying there also keeps the card
 * for the next month (save_default_payment_method), so the parent doesn't fail again on the 1st.
 * Nothing about what is charged or when changes: it is the same Stripe bill, paid by the parent.
 */

const FAILING = ['past_due', 'unpaid']
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export type ChaseKind = 'invite' | 'card' | null

/** What the academy can chase for a child, from their membership statuses: a failed card first, then an unconfirmed invite. */
export function chaseKind(statuses: Array<string | null | undefined>): ChaseKind {
  if (statuses.some((s) => FAILING.includes(String(s)))) return 'card'
  if (statuses.includes('pending_migration')) return 'invite'
  return null
}

export function membershipPayUrl(subscriptionRowId: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'}/pay/membership/${subscriptionRowId}`
}

interface SubRow { id: string; organisation_id: string; parent_id: string | null; player_id: string | null; plan_id: string | null; status: string; stripe_subscription_id: string | null }

export type MembershipBill =
  | { ok: true; sub: SubRow; amountPence: number; invoiceId: string | null; hostedUrl: string | null; month: string | null }
  | { ok: false; error: string; status: number }

/** The bill still open on this membership. amountPence 0 / invoiceId null = nothing left to pay. */
export async function openMembershipBill(svc: SupabaseClient, subscriptionRowId: string): Promise<MembershipBill> {
  const { data: sub } = await svc.from('subscriptions')
    .select('id, organisation_id, parent_id, player_id, plan_id, status, stripe_subscription_id')
    .eq('id', subscriptionRowId).maybeSingle()
  if (!sub) return { ok: false, error: 'This payment link is invalid.', status: 404 }
  if (!sub.stripe_subscription_id) return { ok: false, error: 'This membership has no card payments set up. Please contact the academy.', status: 400 }
  const list = await stripe.invoices.list({ subscription: sub.stripe_subscription_id, status: 'open', limit: 10 })
  // Oldest first: a parent clears the earliest month, and the link then opens the next one.
  const inv = [...list.data].sort((a, b) => a.created - b.created)[0]
  if (!inv) return { ok: true, sub: sub as SubRow, amountPence: 0, invoiceId: null, hostedUrl: null, month: null }
  const month = new Date(((inv.period_end || inv.created) as number) * 1000).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/London' })
  return { ok: true, sub: sub as SubRow, amountPence: inv.amount_remaining ?? inv.amount_due ?? 0, invoiceId: inv.id ?? null, hostedUrl: inv.hosted_invoice_url ?? null, month }
}

/** The parent tapped Pay: keep the card they pay with for next month, then hand back Stripe's page for the open bill. */
export async function startMembershipPayment(svc: SupabaseClient, subscriptionRowId: string): Promise<{ url: string } | { error: string; status: number }> {
  const b = await openMembershipBill(svc, subscriptionRowId)
  if (!b.ok) return { error: b.error, status: b.status }
  if (!b.invoiceId || !b.hostedUrl) return { error: 'This has already been paid. Thank you!', status: 409 }
  await stripe.subscriptions.update(b.sub.stripe_subscription_id as string, { payment_settings: { save_default_payment_method: 'on_subscription' } })
  return { url: b.hostedUrl }
}

/** Email the parent their pay link. Used by the academy's Send payment link button and when a card first fails. */
export async function emailMembershipPayLink(svc: SupabaseClient, subscriptionRowId: string): Promise<{ ok: true; url: string; emailed: boolean; to: string } | { ok: false; error: string; status: number }> {
  const b = await openMembershipBill(svc, subscriptionRowId)
  if (!b.ok) return b
  if (!b.invoiceId || b.amountPence <= 0) return { ok: false, error: 'Nothing is owed on this membership now. It may have just been paid.', status: 409 }
  const [{ data: parent }, { data: player }, { data: org }, { data: plan }] = await Promise.all([
    b.sub.parent_id ? svc.from('profiles').select('full_name, email').eq('id', b.sub.parent_id).maybeSingle() : Promise.resolve({ data: null }),
    b.sub.player_id ? svc.from('players').select('first_name').eq('id', b.sub.player_id).maybeSingle() : Promise.resolve({ data: null }),
    svc.from('organisations').select('name, contact_email, contact_phone').eq('id', b.sub.organisation_id).single(),
    b.sub.plan_id ? svc.from('subscription_plans').select('name').eq('id', b.sub.plan_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const to = String(parent?.email || '').trim()
  if (!to || to.endsWith('@theplayerportal.net')) return { ok: false, error: 'There is no email on file for this parent.', status: 400 }
  const url = membershipPayUrl(b.sub.id)
  const gbp = `£${(b.amountPence / 100).toFixed(2)}`
  const child = (player?.first_name as string | undefined) || 'your child'
  const first = String(parent?.full_name || '').trim().split(/\s+/)[0] || 'there'
  const academy = (org?.name as string | undefined) || 'Your academy'
  const what = (plan?.name as string | undefined) ? `${child}'s ${plan!.name}` : `${child}'s membership`
  const mail = await sendEmail({
    to, fromName: academy, replyTo: (org?.contact_email as string | null) || undefined,
    subject: `${child}'s ${b.month ? b.month.split(' ')[0] + ' ' : ''}payment didn't go through: ${gbp} to pay`,
    html: `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5">
  <p>Hi ${esc(first)},</p>
  <p>The payment for ${esc(what)}${b.month ? ` (${esc(b.month)})` : ''} didn't go through, so <strong>${gbp}</strong> is still to pay.</p>
  <p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Pay ${gbp} now</a></p>
  <p style="color:#555;font-size:14px">You can use the same card or a new one. The card you pay with is kept for next month, so it won't happen again.</p>
  <p style="color:#555;font-size:14px">Questions? Reply to this email${org?.contact_phone ? ` or call ${esc(org.contact_phone as string)}` : ''}.</p>
  <p>${esc(academy)}</p>
</div>`,
  })
  return { ok: true, url, emailed: mail.success === true, to }
}
