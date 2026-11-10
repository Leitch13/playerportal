import type { SupabaseClient } from '@supabase/supabase-js'
import { firstChargeFor, firstChargeLabel } from './billing/sessions'
import { firstOfNextMonthUnix } from './billing/anchor'

/**
 * A membership the academy set up for the parent that the parent has not confirmed yet
 * (status pending_migration + invite token). Nothing is taken until they confirm.
 *
 * John, 10 Nov 2026 (No.1 GK, Tim Shek): the reminder email said "Jacob's membership hasn't
 * been set up", but his Statement said "£0.00 outstanding" because parent pages only read
 * payments already made. Every parent screen that talks about money (Payments, Statement,
 * home) must show this as owed, with the same numbers the confirm page will charge and a
 * button straight to it. Display only: the charge itself is still made by the confirm page
 * through the one billing rule (BILLING_RULES.md).
 */
export interface UnconfirmedMembership {
  subId: string
  childFirstName: string
  planName: string
  monthly: number
  /** What confirming takes today (same rule and same function as the confirm page). */
  todayAmount: number
  /** "3 sessions this month" / "Nothing today, first payment 1 December" */
  todayLabel: string
  /** "1 December": when the monthly price starts. */
  monthlyFrom: string
  href: string
}

export interface UnconfirmedRow {
  id: string
  invite_token: string | null
  migration_billing_starts_at: string | null
  player: { first_name: string | null; enrolments?: { status: string; training_groups: { day_of_week: string | null } | null }[] | null } | null
  plan: { name: string | null; amount: number | string | null } | null
}

/** Pure: one unconfirmed row → what the parent is shown. Same maths as /confirm-subscription/[token]. */
export function describeUnconfirmed(row: UnconfirmedRow, now: Date = new Date()): UnconfirmedMembership | null {
  if (!row.invite_token || !row.plan || row.plan.amount == null) return null
  const monthly = Number(row.plan.amount)
  const deferredStart = row.migration_billing_starts_at
  const deferred = !!deferredStart && new Date(deferredStart).getTime() > now.getTime() + 3600 * 1000
  const classDay = (row.player?.enrolments || []).find((e) => e.status === 'active' || e.status === 'pending')?.training_groups?.day_of_week ?? null
  const anchorUnix = firstOfNextMonthUnix(now)
  const fc = firstChargeFor(monthly, now.toISOString().slice(0, 10), new Date(anchorUnix * 1000).toISOString().slice(0, 10), classDay)
  const deferredLabel = deferred ? new Date(deferredStart as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/London' }) : null
  const monthlyFrom = deferredLabel ?? new Date(anchorUnix * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  return {
    subId: row.id,
    childFirstName: row.player?.first_name || 'Your child',
    planName: row.plan.name || 'Membership',
    monthly,
    todayAmount: deferred ? 0 : fc.pence / 100,
    todayLabel: deferred ? `Nothing today, first payment ${deferredLabel}` : firstChargeLabel(fc),
    monthlyFrom,
    href: `/confirm-subscription/${row.invite_token}`,
  }
}

/** The signed-in parent's unconfirmed memberships. */
export async function loadUnconfirmedMemberships(db: SupabaseClient, parentId: string): Promise<UnconfirmedMembership[]> {
  const { data } = await db
    .from('subscriptions')
    .select('id, invite_token, migration_billing_starts_at, player:players(first_name, enrolments(status, training_groups(day_of_week))), plan:subscription_plans(name, amount)')
    .eq('parent_id', parentId)
    .eq('status', 'pending_migration')
    .not('invite_token', 'is', null)
  const now = new Date()
  return ((data || []) as unknown as UnconfirmedRow[]).map((r) => describeUnconfirmed(r, now)).filter((x): x is UnconfirmedMembership => !!x)
}

export const unconfirmedDueToday = (items: UnconfirmedMembership[]) => Math.round(items.reduce((s, i) => s + i.todayAmount, 0) * 100) / 100
