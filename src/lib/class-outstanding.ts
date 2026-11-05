import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The red box next to a child's name on a class register: what is outstanding.
 *
 * John, 15 Oct 2026: "next to the player is just a number, how much they've got
 * left … like ClassForKids, a red thing with 80 quid." Same rule as camps
 * (src/lib/camp-payment-display.ts, BILLING_RULES.md "Camps"): nobody attends
 * unpaid, and an unpaid child never looks paid. Same for every academy.
 *
 *   • unpaid / part-paid / overdue payment rows for the child → what is left on them
 *   • otherwise a membership whose card payment failed or was never finished
 *     (past_due, unpaid, incomplete) → that plan's monthly amount
 *   • otherwise no membership at all (and not on a trial) → "No membership"
 *   • otherwise nothing
 */

export interface OutstandingInput {
  payments: { status: string | null; amount: number | string | null; amount_paid: number | string | null }[]
  subs: { status: string | null; planAmount: number | string | null; billingStartsAt?: string | null }[]
  isTrial?: boolean
  /** YYYY-MM-DD; defaults to today. */
  today?: string
}

const OWING_PAYMENT = ['unpaid', 'partial', 'overdue']
// Not paying: card failed, never finished, or invited and never confirmed (PFC/Jamie/G&G, 26 Oct 2026: 28 kids).
const FAILED_SUB = ['past_due', 'unpaid', 'incomplete', 'pending_migration']
const HAS_MEMBERSHIP = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused', 'scheduled']

export function classOutstanding(i: OutstandingInput): string | null {
  const fromPayments = i.payments
    .filter((p) => OWING_PAYMENT.includes(p.status || ''))
    .reduce((s, p) => s + Math.max(0, Number(p.amount || 0) - Number(p.amount_paid || 0)), 0)
  if (fromPayments > 0) return `£${fromPayments.toFixed(2)} outstanding`
  // An invite whose first card payment is set for a later month has been paid up to then another
  // way (imported prepaid, or the academy pressed "Paid another way"): nothing outstanding yet.
  const thisMonth = (i.today ?? new Date().toISOString().slice(0, 10)).slice(0, 7)
  const prepaid = (s: OutstandingInput['subs'][number]) => s.status === 'pending_migration' && !!s.billingStartsAt && s.billingStartsAt.slice(0, 7) > thisMonth
  const failed = i.subs.filter((s) => FAILED_SUB.includes(s.status || '') && !prepaid(s))
  if (failed.length) {
    const owed = failed.reduce((s, x) => s + Number(x.planAmount || 0), 0)
    return owed > 0 ? `£${owed.toFixed(2)} outstanding` : 'Payment outstanding'
  }
  if (!i.isTrial && !i.subs.some((s) => HAS_MEMBERSHIP.includes(s.status || '') || prepaid(s))) return 'No membership'
  return null
}

/** One red-box text per child (or null), read with the service client so coaches see it too. */
export async function loadClassOutstanding(admin: SupabaseClient, orgId: string, playerIds: string[], trialIds: Set<string> = new Set()): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  if (playerIds.length === 0) return out
  const [{ data: pays }, { data: subs }] = await Promise.all([
    admin.from('payments').select('player_id, status, amount, amount_paid').eq('organisation_id', orgId).in('player_id', playerIds).in('status', OWING_PAYMENT),
    admin.from('subscriptions').select('player_id, status, migration_billing_starts_at, plan:subscription_plans(amount)').eq('organisation_id', orgId).in('player_id', playerIds),
  ])
  for (const id of playerIds) {
    out.set(id, classOutstanding({
      payments: (pays || []).filter((p) => p.player_id === id),
      subs: (subs || []).filter((s) => s.player_id === id).map((s) => ({ status: s.status as string | null, planAmount: (s.plan as unknown as { amount?: number | null } | null)?.amount ?? null, billingStartsAt: (s.migration_billing_starts_at as string | null) ?? null })),
      isTrial: trialIds.has(id),
    }))
  }
  return out
}
