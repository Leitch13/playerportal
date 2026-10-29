import type { SupabaseClient } from '@supabase/supabase-js'
import { buildFamilyMonth, lineWhen, type FamilyMonth, type FamilySessionRow, type FamilyCharge } from './family-month'
import { monthStart, monthEnd, todayLondon } from './time'
import { orgBits, parentBits, monthLabel, payNowLinkUrl, hasSavedCard, ensureNextMonthBill } from './money'
import { sendMonthBreakdown } from './emails'

/**
 * Loading and sending a family's month (family-month.ts does the sorting).
 *
 * Changes the academy makes under Regulars → More are noted as "due" in the audit
 * log. The parent is sent one breakdown when the academy presses "Email … to the
 * parent", and the evening run (/api/cron/one-to-one-breakdowns) sends any still due,
 * so a parent is never left with an out-of-date bill. One email per family per month,
 * however many dates changed.
 */
const DUE = 'one_to_one.breakdown_due', SENT = 'one_to_one.breakdown_sent'
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'

export async function loadFamilyMonths(admin: SupabaseClient, orgId: string, months: string[], parentIds?: string[]): Promise<Map<string, FamilyMonth & { rows: FamilySessionRow[] }>> {
  const out = new Map<string, FamilyMonth & { rows: FamilySessionRow[] }>()
  if (!months.length) return out
  const from = monthStart(months[0]), to = monthEnd(months[months.length - 1])
  let q = admin.from('coaching_sessions').select('id, parent_id, player_id, session_date, start_minutes, coach_id, venue_id, price_pence, status, decline_tier, charge_state, note, regular_slot_id, source')
    .eq('organisation_id', orgId).gte('session_date', from).lte('session_date', to).not('parent_id', 'is', null)
  if (parentIds?.length) q = q.in('parent_id', parentIds)
  const [{ data: rows }, { data: charges }, { data: credits }, { data: pending }] = await Promise.all([
    q,
    admin.from('coaching_charges').select('parent_id, billing_month, status, amount_pence, credit_applied_pence, sessions_pence').eq('organisation_id', orgId).in('billing_month', months),
    admin.from('coaching_credits').select('parent_id, amount_pence').eq('organisation_id', orgId),
    admin.from('regular_slots').select('id').eq('organisation_id', orgId).eq('status', 'pending'),
  ])
  const pendingIds = new Set((pending ?? []).map((r) => r.id as string))
  const parents = parentIds?.length ? parentIds : [...new Set((rows ?? []).map((r) => r.parent_id as string))]
  for (const p of parents) {
    const balance = (credits ?? []).filter((c) => c.parent_id === p).reduce((a, c) => a + (c.amount_pence as number), 0)
    for (const m of months) {
      const mine = ((rows ?? []) as (FamilySessionRow & { parent_id: string })[]).filter((r) => r.parent_id === p && r.session_date >= monthStart(m) && r.session_date <= monthEnd(m))
      const ch = (charges ?? []).find((c) => c.parent_id === p && c.billing_month === m) as FamilyCharge | undefined
      out.set(`${p}|${m}`, { ...buildFamilyMonth(mine, ch ?? null, balance, pendingIds), rows: mine })
    }
  }
  return out
}

export async function markBreakdownDue(admin: SupabaseClient, orgId: string, parentId: string | null, dates: string[], userId: string | null): Promise<void> {
  if (!parentId) return
  const months = [...new Set(dates.filter(Boolean).map((d) => monthStart(d)))]
  for (const m of months) {
    await admin.from('audit_log').insert({ organisation_id: orgId, user_id: userId, action: DUE, entity_type: 'parent', entity_id: parentId, details: { parent_id: parentId, month: m } }).then(() => {}, () => {})
  }
}

/** Families whose month changed after their last breakdown was sent. */
export async function breakdownsDue(admin: SupabaseClient, orgId?: string): Promise<{ orgId: string; parentId: string; month: string }[]> {
  const since = new Date(Date.now() - 45 * 86400000).toISOString()
  let q = admin.from('audit_log').select('organisation_id, action, created_at, details').in('action', [DUE, SENT]).gte('created_at', since).order('created_at')
  if (orgId) q = q.eq('organisation_id', orgId)
  const { data } = await q
  const last = new Map<string, { due?: string; sent?: string; orgId: string; parentId: string; month: string }>()
  for (const r of data ?? []) {
    const d = r.details as { parent_id?: string; month?: string }
    if (!d?.parent_id || !d?.month) continue
    const k = `${r.organisation_id}|${d.parent_id}|${d.month}`
    const v = last.get(k) || { orgId: r.organisation_id as string, parentId: d.parent_id, month: d.month }
    if (r.action === DUE) v.due = r.created_at as string; else v.sent = r.created_at as string
    last.set(k, v)
  }
  return [...last.values()].filter((v) => v.due && (!v.sent || v.sent < v.due)).map(({ orgId, parentId, month }) => ({ orgId, parentId, month }))
}

/** Email one family their month. Returns who it went to, or why it couldn't go. */
export async function sendFamilyMonth(admin: SupabaseClient, orgId: string, parentId: string, month: string, userId: string | null): Promise<{ sentTo: string | null; reason?: string }> {
  // No card and next month is owed: make (or refresh) its bill now so the email can carry a Pay now button.
  await ensureNextMonthBill(admin, orgId, parentId, month).catch(() => null)
  const m = (await loadFamilyMonths(admin, orgId, [month], [parentId])).get(`${parentId}|${month}`)
  if (!m || (m.on.length === 0 && m.off.length === 0)) return { sentTo: null, reason: 'No sessions that month' }
  // Not set up yet: their set-up link is the email that matters, not a month breakdown.
  if (m.sessionsPence === 0 && m.setUpPence > 0 && m.state === 'due') return { sentTo: null, reason: "They haven't set up yet. Send their set-up link instead." }
  const parent = await parentBits(admin, parentId)
  if (!parent.email) return { sentTo: null, reason: 'This parent has no email address' }
  const bits = await orgBits(admin, orgId)
  const playerIds = [...new Set(m.rows.map((r) => r.player_id).filter(Boolean))] as string[]
  const { data: kids } = playerIds.length ? await admin.from('players').select('first_name').in('id', playerIds) : { data: [] }
  const childNames = (kids ?? []).map((k) => k.first_name as string).join(' and ') || 'Your child'
  const { data: lastSent } = await admin.from('audit_log').select('details').eq('organisation_id', orgId).eq('action', SENT).eq('entity_id', parentId).order('created_at', { ascending: false }).limit(20)
  const prev = (lastSent ?? []).map((r) => r.details as { month?: string; to_pay?: number }).find((d) => d.month === month)
  // Money to pay now on this month's bill: the email carries its own pay link (John, 29 Oct 2026).
  const { data: bill } = await admin.from('coaching_charges').select('id, status, amount_pence').eq('organisation_id', orgId).eq('parent_id', parentId).eq('billing_month', month).maybeSingle()
  const payUrl = bill && ['pending', 'failed'].includes(bill.status as string) && (bill.amount_pence as number) > 0 ? payNowLinkUrl(bill.id as string) : null
  await sendMonthBreakdown({
    academy: bits.name, to: parent.email, parentName: parent.name, childNames, monthLabel: monthLabel(month),
    // Held dates (a regular not set up yet) aren't on this bill, so they aren't in this email.
    on: m.on.filter((l) => !l.tag?.startsWith('held')).map((l) => ({ when: lineWhen(l), coach: bits.coach(l.coachId), pricePence: l.pricePence, tag: l.tag })),
    off: m.off.map((l) => ({ when: lineWhen(l), why: l.why })),
    sessionsPence: m.sessionsPence, creditPence: m.creditPence, toPayPence: m.toPayPence, state: m.state,
    // A month that has already started isn't charged on its 1st any more: it's due now.
    chargeDate: month > todayLondon().slice(0, 7) + '-01' ? `${new Date(month + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })} 1 ${monthLabel(month).split(' ')[0]}` : null,
    wasPence: typeof prev?.to_pay === 'number' ? prev.to_pay : null, url: `${appUrl()}/dashboard/sessions`,
    payUrl, hasCard: await hasSavedCard(admin, orgId, parentId),
  })
  await admin.from('audit_log').insert({ organisation_id: orgId, user_id: userId, action: SENT, entity_type: 'parent', entity_id: parentId, details: { parent_id: parentId, month, to_pay: m.toPayPence, state: m.state } })
  return { sentTo: parent.email }
}
