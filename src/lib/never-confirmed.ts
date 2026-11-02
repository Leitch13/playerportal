import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

/**
 * A child coming to class on an invite their parent never confirmed: the months owed.
 *
 * John, 2 Nov 2026 (G&G, Hedi Khelifi: invited 30 Jun, never confirmed, at every Saturday class
 * since, £0 paid). "Nobody uses services free." The months from the invite's first billing date up
 * to the start of this month are owed; this month is not, because confirming pays the sessions left
 * this month and then the plan from the 1st (the billing rule). The academy sees it in red with the
 * amount, and one button sends the parent a bill for those months (a normal one-off invoice with a
 * pay link, /pay/<id>) together with their invite link to set up the monthly payment.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

/** The months owed: from the first billing month up to, not including, this month. ['2026-08','2026-09','2026-10'] */
export function backMonths(billingStartsAt: string | null, inviteSentAt: string | null, today: string): string[] {
  let from: Date
  if (billingStartsAt) from = new Date(billingStartsAt.slice(0, 7) + '-01T00:00:00Z')
  else if (inviteSentAt) { const d = new Date(inviteSentAt.slice(0, 7) + '-01T00:00:00Z'); from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)) }
  else return []
  const thisMonth = today.slice(0, 7)
  const out: string[] = []
  for (let d = from; ym(d) < thisMonth && out.length < 24; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) out.push(ym(d))
  return out
}

const monthName = (m: string, year = false) => new Date(m + '-01T12:00:00Z').toLocaleString('en-GB', { month: year ? 'long' : 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' })
/** "Aug–Oct 2026" / "October 2026" */
export function monthsLabel(months: string[]): string {
  if (!months.length) return ''
  if (months.length === 1) return monthName(months[0], true)
  return `${monthName(months[0])}–${monthName(months[months.length - 1])} ${months[months.length - 1].slice(0, 4)}`
}

export interface NeverConfirmed { subId: string; playerId: string; parentId: string | null; months: string[]; label: string; amount: number; planName: string; billId: string | null; billSent: boolean }

const NOTE = (subId: string) => `back-months:${subId}`

const MONTHS_IN = (notes: unknown) => String(notes || '').match(/\d{4}-\d{2}/g) ?? []
const OPEN_BILL = ['unpaid', 'partial', 'overdue']

/**
 * Children (optionally only these) coming to an active class on an invite never confirmed, with what's owed.
 * Monthly plans only. Months already paid on an earlier bill don't count again. One figure everywhere: the
 * red box, the button, the email, the bill and the academy's daily "not paying" email all use `amount`.
 * With `sync`, an unpaid bill is brought up to that figure (a new month started before it was paid).
 */
export async function loadNeverConfirmed(db: SupabaseClient, orgId: string, playerIds?: string[], today = new Date().toISOString().slice(0, 10), opts: { sync?: boolean } = {}): Promise<Map<string, NeverConfirmed>> {
  const out = new Map<string, NeverConfirmed>()
  if (playerIds && !playerIds.length) return out
  let q = db.from('subscriptions').select('id, player_id, parent_id, invite_sent_at, migration_billing_starts_at, created_at, plan:subscription_plans(name, amount, interval)')
    .eq('organisation_id', orgId).eq('status', 'pending_migration').not('player_id', 'is', null)
  if (playerIds) q = q.in('player_id', playerIds)
  const { data: subs } = await q
  if (!subs?.length) return out
  const ids = [...new Set(subs.map((s) => s.player_id as string))]
  const [{ data: enr }, { data: bills }] = await Promise.all([
    db.from('enrolments').select('player_id').in('player_id', ids).eq('status', 'active'),
    db.from('payments').select('id, notes, status, amount, amount_paid').eq('organisation_id', orgId).in('player_id', ids).like('notes', 'back-months:%'),
  ])
  const attending = new Set((enr ?? []).map((e) => e.player_id as string))
  for (const s of subs) {
    const plan = s.plan as unknown as { name: string; amount: number; interval: string | null } | null
    if (!attending.has(s.player_id as string) || !plan || (plan.interval && plan.interval !== 'month')) continue
    const mine = (bills ?? []).filter((b) => String(b.notes || '').startsWith(NOTE(s.id as string)))
    const paid = new Set(mine.filter((b) => !OPEN_BILL.includes(b.status as string)).flatMap((b) => MONTHS_IN(b.notes)))
    const months = backMonths(s.migration_billing_starts_at as string | null, (s.invite_sent_at || s.created_at) as string | null, today).filter((m) => !paid.has(m))
    if (!months.length) continue
    const amount = Math.round(months.length * Number(plan.amount) * 100) / 100
    const open = mine.find((b) => OPEN_BILL.includes(b.status as string)) ?? null
    if (opts.sync && open && Number(open.amount) !== amount && !(Number(open.amount_paid) > 0)) {
      const sent = String(open.notes || '').match(/ · emailed .*$/)?.[0] ?? ''
      await db.from('payments').update({ amount, description: billDescription(null, plan.name, months), notes: `${NOTE(s.id as string)} ${months.join(',')}${sent}` }).eq('id', open.id)
    }
    const prev = out.get(s.player_id as string)
    const row: NeverConfirmed = { subId: s.id as string, playerId: s.player_id as string, parentId: (s.parent_id as string | null) ?? null, months, label: monthsLabel(months), amount, planName: plan.name, billId: (open?.id as string | undefined) ?? null, billSent: / · emailed /.test(String(open?.notes || '')) }
    if (!prev || row.amount > prev.amount) out.set(s.player_id as string, row)
  }
  return out
}

function billDescription(child: string | null, planName: string, months: string[]) {
  return `${child ? `${child}: ` : ''}${planName}, ${monthsLabel(months)} (${months.length} month${months.length === 1 ? '' : 's'} not paid)`
}

/**
 * The academy's one button: a bill for the months owed (made once, reused after) and the invite link,
 * in one email. Charges nothing by itself: the parent pays the bill from /pay/<id> and sets up the
 * monthly payment from their invite link.
 */
export async function sendBackMonthsBill(db: SupabaseClient, orgId: string, playerId: string, appUrl: string): Promise<{ ok: true; amount: number; label: string; to: string } | { ok: false; error: string; status: number }> {
  const owed = (await loadNeverConfirmed(db, orgId, [playerId])).get(playerId)
  if (!owed) return { ok: false, error: 'Nothing is owed from before this month for this child.', status: 404 }
  const [{ data: sub }, { data: player }, { data: org }] = await Promise.all([
    db.from('subscriptions').select('invite_token').eq('id', owed.subId).single(),
    db.from('players').select('first_name').eq('id', playerId).single(),
    db.from('organisations').select('name, contact_email, contact_phone').eq('id', orgId).single(),
  ])
  const { data: parent } = owed.parentId ? await db.from('profiles').select('full_name, email').eq('id', owed.parentId).maybeSingle() : { data: null }
  const to = String(parent?.email || '').trim()
  if (!to || to.endsWith('@theplayerportal.net')) return { ok: false, error: 'There is no email on file for this parent.', status: 400 }

  let billId = owed.billId
  const child = (player?.first_name as string | undefined) || 'your child'
  // The bill always carries the same figure the academy saw on the button.
  const bill = { amount: owed.amount, description: billDescription(child, owed.planName, owed.months), notes: `${NOTE(owed.subId)} ${owed.months.join(',')}` }
  if (billId) await db.from('payments').update(bill).eq('id', billId)
  else {
    const { data: made, error } = await db.from('payments').insert({
      organisation_id: orgId, parent_id: owed.parentId, player_id: playerId, amount_paid: 0, status: 'unpaid', due_date: new Date().toISOString().slice(0, 10), ...bill,
    }).select('id').single()
    if (error || !made) return { ok: false, error: 'Could not make the bill. Please try again.', status: 500 }
    billId = made.id as string
  }
  const base = appUrl.replace(/\/$/, '')
  const payUrl = `${base}/pay/${billId}`
  const setupUrl = sub?.invite_token ? `${base}/confirm-subscription/${sub.invite_token}` : null
  const academy = (org?.name as string | undefined) || 'Your academy'
  const first = String(parent?.full_name || '').trim().split(/\s+/)[0] || 'there'
  const gbp = `£${owed.amount.toFixed(2)}`
  const btn = (href: string, text: string, dark: boolean) => `<p style="margin:18px 0"><a href="${href}" style="display:inline-block;background:${dark ? '#111' : '#0b8299'};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${text}</a></p>`
  const mail = await sendEmail({
    to, fromName: academy, replyTo: (org?.contact_email as string | null) || undefined,
    subject: `${child}'s sessions: ${gbp} to pay for ${owed.label}`,
    html: `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5">
  <p>Hi ${esc(first)},</p>
  <p>${esc(child)} has been coming to ${esc(academy)}, but the monthly payment was never set up, so <strong>${esc(owed.label)}</strong> hasn't been paid: <strong>${gbp}</strong> (${owed.months.length} × £${(owed.amount / owed.months.length).toFixed(2)}, ${esc(owed.planName)}).</p>
  <p><strong>1. Pay what's owed</strong></p>
  ${btn(payUrl, `Pay ${gbp} now`, true)}
  ${setupUrl ? `<p><strong>2. Set up the monthly payment</strong> so it comes off automatically from now on.</p>${btn(setupUrl, 'Set up monthly payment', false)}` : ''}
  <p style="color:#555;font-size:14px">Already paid us another way? Reply to this email and we'll sort it${org?.contact_phone ? `, or call ${esc(org.contact_phone as string)}` : ''}.</p>
  <p>${esc(academy)}</p>
</div>`,
  })
  if (!mail.success) return { ok: false, error: `The email to ${to} didn't send. Check the address is right, then try again.`, status: 502 }
  await db.from('payments').update({ notes: `${NOTE(owed.subId)} ${owed.months.join(',')} · emailed ${new Date().toISOString().slice(0, 10)}` }).eq('id', billId)
  if (setupUrl) await db.from('subscriptions').update({ invite_sent_at: new Date().toISOString() }).eq('id', owed.subId)
  return { ok: true, amount: owed.amount, label: owed.label, to }
}
