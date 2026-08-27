import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────
// Enrolments page — per-player payment marker.
//
// The enrolments page has always answered "who is on the roster?" while
// silently ignoring "who is paying?", which is how academies end up with
// enrolled-but-never-charged families (G&G's £283/mo phantom actives; the
// C7 "enrolled without paying" canary cohort). This helper closes that gap
// with ONE bounded read: all subscription rows for the page's players.
//
// Verdict per player:
//   'paying'      — has an active/trialing subscription that is genuinely
//                   billing (has a Stripe subscription id), OR the org has
//                   no Stripe account connected (pilot/demo orgs bill
//                   nowhere, so a local sub row is the best truth there is).
//   'not_billing' — has an 'active' sub row but NO Stripe subscription
//                   behind it while the org IS on Stripe. This is exactly
//                   the phantom-active pattern: looks like a member, no
//                   money has ever moved.
//   'no_sub'      — no active/trialing subscription at all.
//
// Read-only; never throws (fails open to an empty map so the page renders
// without markers rather than not at all).
// ─────────────────────────────────────────────────────────────────────────

export type PaymentVerdict = 'paying' | 'not_billing' | 'no_sub'

export async function loadPaymentStatusByPlayer(
  supabase: SupabaseClient,
  orgId: string,
  playerIds: string[],
  orgHasStripe: boolean
): Promise<Map<string, PaymentVerdict>> {
  const map = new Map<string, PaymentVerdict>()
  if (playerIds.length === 0) return map
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('player_id, status, stripe_subscription_id')
      .eq('organisation_id', orgId)
      .in('player_id', playerIds)
      .in('status', ['active', 'trialing'])
    const best = new Map<string, PaymentVerdict>()
    for (const s of (data || []) as Array<{
      player_id: string | null
      status: string
      stripe_subscription_id: string | null
    }>) {
      if (!s.player_id) continue
      const billing =
        !!s.stripe_subscription_id || !orgHasStripe || s.status === 'trialing'
      const verdict: PaymentVerdict = billing ? 'paying' : 'not_billing'
      // 'paying' wins over 'not_billing' when a player has several rows.
      if (verdict === 'paying' || !best.has(s.player_id)) best.set(s.player_id, verdict)
    }
    for (const id of playerIds) map.set(id, best.get(id) ?? 'no_sub')
  } catch {
    /* marker is an enhancement — never block the page on it */
  }
  return map
}
