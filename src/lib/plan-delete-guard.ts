import { createClient } from '@/lib/supabase/client'

/**
 * Can this plan be deleted, or is someone paying on it?
 *
 * Deleting a plan was a confirm dialog and nothing else. One of the two dialogs
 * even reassured the admin that "existing subscribers will not be affected",
 * which was the opposite of true: the row went, and every subscription
 * referencing it was left pointing at a plan that no longer existed — no name,
 * no amount, nothing for a register or an invoice to read back.
 *
 * This needs no attacker and no unusual state. An academy owner tidying up
 * their plans on a Tuesday orphans live memberships.
 *
 * Deactivating is almost always what they actually want: the plan stops being
 * offered to new parents, and everyone currently on it carries on untouched.
 * Both screens already have that toggle.
 */
export interface PlanDeleteCheck {
  ok: boolean
  liveCount: number
  message?: string
}

const LIVE = ['active', 'trialing', 'past_due', 'pending_migration']

export async function canDeletePlan(planId: string, planName?: string): Promise<PlanDeleteCheck> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .in('status', LIVE)

  // A failed check refuses. Being unable to tell whether anyone is paying is
  // not a reason to delete anyway.
  if (error) {
    return {
      ok: false,
      liveCount: -1,
      message: `Could not check whether anyone is on ${planName || 'this plan'}, so it has not been deleted. Try again in a moment.`,
    }
  }

  const liveCount = count || 0
  if (liveCount === 0) return { ok: true, liveCount: 0 }

  return {
    ok: false,
    liveCount,
    message:
      `${liveCount} ${liveCount === 1 ? 'member is' : 'members are'} currently on ` +
      `${planName ? `"${planName}"` : 'this plan'}, so it can't be deleted — their ` +
      `memberships would be left pointing at a plan that no longer exists.\n\n` +
      `Turn it off instead: it stops being offered to new parents and everyone ` +
      `already on it carries on exactly as they are.`,
  }
}
