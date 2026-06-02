/**
 * Action-queue count loader for the academy admin dashboard.
 *
 * Returns the five numbers powering the ActionQueueCard widget:
 *   - Pending future starts (Stage 3 scheduled subscriptions)
 *   - Failed / past-due payments (subscriptions with status='past_due')
 *   - Trials expiring within 7 days
 *   - Players needing attention (review overdue >30d OR attendance drop)
 *   - Unsigned waivers (optional — pass 0 if the feature isn't used)
 *
 * Pure org-scoped reads — no writes, no Stripe calls. Counts are server-side
 * for fast dashboard render. Errors are swallowed (returns 0 for that field)
 * so a single failing query never breaks the rest of the dashboard.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseLike = any
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface ActionQueueResult {
  pendingStarts: number
  pastDuePayments: number
  trialsExpiring7d: number
  needingAttention: number
  unsignedWaivers: number
}

export async function loadActionQueueCounts(
  supabase: SupabaseLike,
  orgId: string,
): Promise<ActionQueueResult> {
  const todayIso = new Date().toISOString().slice(0, 10)
  const in7daysIso = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

  // Wraps both query-construction failures (supabase.from() throws) AND
  // awaited failures (network error during fetch). The fn-based signature
  // is what makes construction-time errors catchable — passing a Promise
  // would already have triggered the throw.
  const safeCount = async (fn: () => Promise<{ count: number | null }>): Promise<number> => {
    try {
      const { count } = await fn()
      return count ?? 0
    } catch {
      return 0
    }
  }

  // Run in parallel — five lightweight count-only queries.
  const [pendingStarts, pastDuePayments, trialsExpiring7d, attentionCount, waivers] =
    await Promise.all([
      // Stage 3: subscriptions waiting to be activated.
      safeCount(() =>
        supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', orgId)
          .eq('status', 'scheduled'),
      ),
      // Recurring charge failed and is in dunning.
      safeCount(() =>
        supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', orgId)
          .eq('status', 'past_due'),
      ),
      // Trial enrolments with an expiry within the next 7 days.
      safeCount(() =>
        supabase
          .from('enrolments')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', orgId)
          .eq('is_trial', true)
          .gte('trial_expires_at', todayIso)
          .lte('trial_expires_at', in7daysIso),
      ),
      // Players overdue for review — proxy for "needing attention". Cheaper
      // than the full review+attendance recompute the coach dashboard runs;
      // surfaces the same cohort coarsely.
      loadAttentionCount(supabase, orgId),
      // Waivers count — set to 0 if waivers feature isn't in use.
      loadUnsignedWaiverCount(supabase, orgId),
    ])

  return {
    pendingStarts,
    pastDuePayments,
    trialsExpiring7d,
    needingAttention: attentionCount,
    unsignedWaivers: waivers,
  }
}

/**
 * Coarse "players needing attention" count for the action queue.
 * Counts active-enrolment players whose latest `progress_reviews.review_date`
 * is > 30 days ago OR who have never been reviewed.
 *
 * (The Coach dashboard runs a richer per-group computation including
 * attendance drop. Phase 2 can replace this coarse count with that one when
 * we surface PlayersNeedingAttention org-wide.)
 */
async function loadAttentionCount(supabase: SupabaseLike, orgId: string): Promise<number> {
  try {
    const { data: enrolments } = await supabase
      .from('enrolments')
      .select('player_id')
      .eq('organisation_id', orgId)
      .eq('status', 'active')
    if (!enrolments?.length) return 0

    const playerIds = [...new Set(enrolments.map((e: { player_id: string }) => e.player_id).filter(Boolean))]
    if (playerIds.length === 0) return 0

    const { data: latestReviews } = await supabase
      .from('progress_reviews')
      .select('player_id, review_date')
      .in('player_id', playerIds)
      .order('review_date', { ascending: false })

    const latestByPlayer = new Map<string, string>()
    for (const r of latestReviews || []) {
      const pid = (r as { player_id: string }).player_id
      if (!latestByPlayer.has(pid)) latestByPlayer.set(pid, (r as { review_date: string }).review_date)
    }

    const cutoffMs = Date.now() - 30 * 86_400_000
    let count = 0
    for (const pid of playerIds) {
      const last = latestByPlayer.get(pid as string)
      if (!last || new Date(last).getTime() < cutoffMs) count++
    }
    return count
  } catch {
    return 0
  }
}

/**
 * Unsigned-waiver count. Returns 0 if the academy doesn't use the waiver
 * feature (no active waivers configured).
 */
async function loadUnsignedWaiverCount(supabase: SupabaseLike, orgId: string): Promise<number> {
  try {
    const { data: activeWaivers } = await supabase
      .from('waivers')
      .select('id')
      .eq('organisation_id', orgId)
      .eq('is_active', true)
    if (!activeWaivers?.length) return 0

    const { data: players } = await supabase
      .from('players')
      .select('id, parent_id')
      .eq('organisation_id', orgId)
    if (!players?.length) return 0

    const { data: signatures } = await supabase
      .from('waiver_signatures')
      .select('waiver_id, player_id')
      .in('waiver_id', activeWaivers.map((w: { id: string }) => w.id))

    const signedKey = new Set(
      (signatures || []).map((s: { waiver_id: string; player_id: string }) => `${s.waiver_id}|${s.player_id}`),
    )
    let missing = 0
    for (const w of activeWaivers) {
      for (const p of players) {
        if (!signedKey.has(`${(w as { id: string }).id}|${(p as { id: string }).id}`)) missing++
      }
    }
    return missing
  } catch {
    return 0
  }
}
