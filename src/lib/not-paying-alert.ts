/**
 * John's rule, 26 Oct 2026: "Every child on a register (class, camp or 1-2-1) must be one of: paying
 * (confirmed in Stripe), on a trial, or marked paid in cash. Anyone else shows red on the register,
 * and the academy is told the same day, with the amount."
 *
 * This is the "told" half (the red half is src/lib/class-outstanding.ts, camp-payment-display.ts and
 * 1-2-1s Needs you). Every morning, each academy with a child not paying gets ONE email listing who and
 * how much, but only when someone is new on the list since the last email, so it never nags daily
 * about the same names. Same for every academy.
 *
 * 28 children (Jamie 10, PFC 12, G&G 6) had trained for weeks unpaid with nobody told; No.1's 1-2-1
 * families the same. Reporting only: nothing here charges anyone.
 */

import { familyOwedUpToNow } from './one-to-one/money'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export const NOT_PAYING_ALERTED = 'academy.not_paying_alerted'

export interface NotPaying { key: string; child: string; what: string; amount: number; why: string }

const NOT_PAYING_SUB: Record<string, string> = {
  pending_migration: 'never signed up to pay',
  past_due: 'card payment failed',
  unpaid: 'card payment failed',
  incomplete: 'started signing up but never paid',
}

/** Everyone at one academy who is on a class, camp or 1-2-1 and not paying. */
export async function notPayingFor(db: Db, orgId: string, today: string): Promise<NotPaying[]> {
  const out: NotPaying[] = []
  // Classes: memberships that aren't paying, for children still enrolled.
  const { data: subs } = await db.from('subscriptions').select('id, status, player_id, players(first_name, last_name), subscription_plans(name, amount)')
    .eq('organisation_id', orgId).in('status', Object.keys(NOT_PAYING_SUB))
  const playerIds = [...new Set(((subs ?? []) as { player_id: string | null }[]).map((s) => s.player_id).filter(Boolean))] as string[]
  const { data: enrols } = playerIds.length
    ? await db.from('enrolments').select('player_id').in('player_id', playerIds).in('status', ['active', 'pending'])
    : { data: [] }
  const enrolled = new Set(((enrols ?? []) as { player_id: string }[]).map((e) => e.player_id))
  for (const s of (subs ?? []) as { id: string; status: string; player_id: string | null; players: { first_name: string; last_name: string | null } | null; subscription_plans: { name: string; amount: number | string } | null }[]) {
    if (!s.player_id || !enrolled.has(s.player_id)) continue
    out.push({ key: `sub:${s.id}`, child: `${s.players?.first_name ?? 'Child'} ${s.players?.last_name ?? ''}`.trim(), what: s.subscription_plans?.name ?? 'Class membership', amount: Number(s.subscription_plans?.amount ?? 0), why: NOT_PAYING_SUB[s.status] })
  }
  // Camps: unpaid bookings for camps that haven't finished.
  const { data: camps } = await db.from('camp_bookings').select('id, child_name, amount_paid, camp:camps(name, end_date, start_date)')
    .eq('organisation_id', orgId).eq('payment_status', 'pending')
  for (const c of (camps ?? []) as { id: string; child_name: string | null; amount_paid: number | string | null; camp: { name: string; end_date: string | null; start_date: string | null } | null }[]) {
    const ends = c.camp?.end_date || c.camp?.start_date
    if (ends && ends < today) continue
    out.push({ key: `camp:${c.id}`, child: (c.child_name || 'Child').trim(), what: c.camp?.name ?? 'Camp', amount: Number(c.amount_paid ?? 0), why: 'booked but not paid' })
  }
  // 1-2-1s: families still waiting to set up (what they owe up to the end of this month, the same sum
  // their link asks for), and live families whose month didn't go through (card failed or cash due).
  const { data: waiting } = await db.from('regular_slots').select('parent_id, player:players(first_name, last_name)')
    .eq('organisation_id', orgId).eq('status', 'pending')
  const families = new Map<string, string[]>()
  for (const w of (waiting ?? []) as { parent_id: string; player: { first_name: string; last_name: string | null } | null }[]) {
    families.set(w.parent_id, [...(families.get(w.parent_id) || []), `${w.player?.first_name ?? ''} ${w.player?.last_name ?? ''}`.trim()])
  }
  for (const [parentId, kids] of families) {
    const b = await familyOwedUpToNow(db, orgId, parentId, today)
    if (b.amountPence <= 0) continue
    out.push({ key: `121setup:${parentId}`, child: [...new Set(kids)].join(' & ') || 'A family', what: '1-2-1 sessions', amount: b.amountPence / 100, why: 'set-up link not paid' })
  }
  const { data: bills } = await db.from('coaching_charges').select('id, parent_id, amount_pence, failure_message')
    .eq('organisation_id', orgId).eq('status', 'failed').gt('amount_pence', 0)
  for (const b of (bills ?? []) as { id: string; parent_id: string; amount_pence: number; failure_message: string | null }[]) {
    const { data: slots } = await db.from('regular_slots').select('player:players(first_name, last_name)').eq('organisation_id', orgId).eq('parent_id', b.parent_id).neq('status', 'released')
    const kids = [...new Set(((slots ?? []) as { player: { first_name: string; last_name: string | null } | null }[]).map((x) => `${x.player?.first_name ?? ''} ${x.player?.last_name ?? ''}`.trim()).filter(Boolean))]
    const cash = (b.failure_message || '').startsWith('Cash or bank transfer due')
    out.push({ key: `121:${b.id}`, child: kids.join(' & ') || 'A family', what: '1-2-1 sessions', amount: b.amount_pence / 100, why: cash ? 'cash or bank transfer due' : 'card payment failed' })
  }
  return out
}

const gbp = (n: number) => `£${n.toFixed(2)}`
const esc = (x: string) => x.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))

/** Every academy: email the list when someone is new on it since the last email. */
export async function alertAcademiesNotPaying(db: Db, today: string, sendEmail: (o: { to: string; subject: string; html: string; fromName?: string }) => Promise<unknown>) {
  const { data: orgs } = await db.from('organisations').select('id, name, contact_email, slug, platform_subscription_status')
  const sent: string[] = []
  for (const org of (orgs ?? []) as { id: string; name: string; contact_email: string | null; slug: string | null; platform_subscription_status: string | null }[]) {
    const list = await notPayingFor(db, org.id, today)
    if (!list.length) continue
    const { data: prior } = await db.from('audit_log').select('details').eq('organisation_id', org.id).eq('action', NOT_PAYING_ALERTED).order('created_at', { ascending: false }).limit(1)
    const seen = new Set<string>(((prior?.[0]?.details as { keys?: string[] } | undefined)?.keys) ?? [])
    const fresh = list.filter((x) => !seen.has(x.key))
    if (!fresh.length) continue
    const to = org.contact_email
    if (!to) continue
    const total = list.reduce((a, x) => a + x.amount, 0)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
    const rows = list.map((x) => `<tr><td style="padding:6px 8px;border-top:1px solid #e3e8ee"><b>${esc(x.child)}</b>${fresh.some((f) => f.key === x.key) ? ' <span style="color:#b42318;font-size:12px">new</span>' : ''}<br><span style="color:#5b6674;font-size:13px">${esc(x.what)} · ${esc(x.why)}</span></td><td style="padding:6px 8px;border-top:1px solid #e3e8ee;text-align:right;white-space:nowrap;color:#b42318;font-weight:700">${gbp(x.amount)}</td></tr>`).join('')
    await sendEmail({
      to, fromName: 'Player Portal',
      subject: `${list.length} ${list.length === 1 ? 'child is' : 'children are'} not paying: ${gbp(total)}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:600px;color:#1b2430">
        <h2 style="margin:0 0 8px">${list.length} ${list.length === 1 ? 'child is' : 'children are'} on your registers and not paying</h2>
        <p style="margin:0 0 12px">These children are booked in at ${esc(org.name)} but no payment is coming in. They show in red on your registers.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px">${rows}<tr><td style="padding:8px;border-top:2px solid #1b2430"><b>Total</b></td><td style="padding:8px;border-top:2px solid #1b2430;text-align:right;font-weight:700;color:#b42318">${gbp(total)}</td></tr></table>
        <p style="margin:14px 0 6px"><b>To collect it:</b> classes and camps: open <b>Payments</b>, find the child and send their link. 1-2-1s: <b>1-2-1s → Needs you</b>.</p>
        <p><a href="${appUrl}/dashboard/payments" style="display:inline-block;background:#4ecde6;color:#06222b;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600">Open Payments</a></p>
        <p style="color:#5b6674;font-size:12px">You'll get this again only when someone new is added to the list.</p></div>`,
    })
    await db.from('audit_log').insert({ organisation_id: org.id, action: NOT_PAYING_ALERTED, entity_type: 'organisation', entity_id: org.id, details: { keys: list.map((x) => x.key), count: list.length, total } })
    sent.push(`${org.name}: ${list.length} (${gbp(total)})`)
  }
  return sent
}
