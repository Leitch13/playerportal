import { createClient } from '@supabase/supabase-js'

/**
 * "Needs attention" — the money problems an academy can actually see and fix.
 *
 * Why this exists
 * ---------------
 * Every one of these checks already ran nightly. They ran as canaries and
 * emailed JOHN. On 2026-08-31 that meant one academy had 27 children training
 * with no payment set up — reported correctly, every morning, for fifteen days
 * — while the academy owner had no way of knowing. Another academy owner had
 * to email John to cancel five memberships because the app gave her no button.
 *
 * The platform owner was the monitoring system for his own customers. That does
 * not scale past two academies and it is why problems surfaced weeks late.
 *
 * Same queries, pointed at the person who can act on them.
 *
 * Read-only. Never writes, never touches Stripe, never charges anything. Safe
 * to render on a dashboard: worst case a panel is empty.
 */

export interface AttentionItem {
  /** Stable key so the UI can order/deduplicate. */
  kind: 'not_paying' | 'invite_unconfirmed' | 'payment_failed' | 'duplicate_player'
  /** One line, written for the academy owner, not for an engineer. */
  label: string
  /** Days the problem has existed, where knowable. Age is cost. */
  ageDays?: number
  /** Monthly £ at stake, where knowable. */
  amount?: number
  /** Where to go to fix it. */
  href?: string
}

export interface AttentionGroup {
  kind: AttentionItem['kind']
  title: string
  /** What the academy should do about it, in plain words. */
  action: string
  items: AttentionItem[]
  total: number
  /** Summed monthly £ where the items carry an amount. */
  amount: number
}

export interface NeedsAttention {
  groups: AttentionGroup[]
  totalItems: number
  totalMonthly: number
}

function daysSince(iso?: string | null): number | undefined {
  if (!iso) return undefined
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return undefined
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}

/** Never throws: a broken panel must not take the dashboard down with it. */
export async function getNeedsAttention(orgId: string): Promise<NeedsAttention> {
  const empty: NeedsAttention = { groups: [], totalItems: 0, totalMonthly: 0 }
  if (!orgId) return empty
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return empty

  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const [playersRes, enrolRes, subsRes, plansRes, profilesRes] = await Promise.all([
      sb.from('players').select('id, first_name, last_name, parent_id, date_of_birth, archived_at').eq('organisation_id', orgId).limit(3000),
      sb.from('enrolments').select('player_id, status').eq('organisation_id', orgId).eq('status', 'active').limit(5000),
      sb.from('subscriptions').select('id, parent_id, player_id, plan_id, status, invite_sent_at, invite_confirmed_at').eq('organisation_id', orgId).limit(3000),
      sb.from('subscription_plans').select('id, amount').eq('organisation_id', orgId).limit(500),
      sb.from('profiles').select('id, full_name').eq('organisation_id', orgId).limit(3000),
    ])

    const players = playersRes.data ?? []
    const enrolments = enrolRes.data ?? []
    const subs = subsRes.data ?? []
    const planAmount = new Map((plansRes.data ?? []).map((p) => [p.id as string, Number(p.amount) || 0]))
    const parentName = new Map((profilesRes.data ?? []).map((p) => [p.id as string, (p.full_name as string) || 'Unknown']))
    const playerById = new Map(players.map((p) => [p.id as string, p]))
    const activePlayerIds = new Set(enrolments.map((e) => e.player_id as string))

    // Parents holding anything that counts as "sorted" for billing purposes.
    const settledParents = new Set(
      subs.filter((s) => ['active', 'trialing', 'pending_migration'].includes(s.status as string))
        .map((s) => s.parent_id as string),
    )

    const groups: AttentionGroup[] = []
    const push = (g: Omit<AttentionGroup, 'total' | 'amount'>) => {
      if (!g.items.length) return
      groups.push({
        ...g,
        total: g.items.length,
        amount: g.items.reduce((s, i) => s + (i.amount ?? 0), 0),
      })
    }

    // ── 1. Training, nobody paying ──────────────────────────────────────
    const notPaying: AttentionItem[] = []
    for (const p of players) {
      if (p.archived_at) continue
      if (!activePlayerIds.has(p.id as string)) continue
      if (settledParents.has(p.parent_id as string)) continue
      notPaying.push({
        kind: 'not_paying',
        label: `${(p.first_name as string ?? '').trim()} ${(p.last_name as string ?? '').trim()}`.trim() || 'Unnamed player',
        href: `/dashboard/players/${p.id}`,
      })
    }
    push({
      kind: 'not_paying',
      title: 'In a class with no payment set up',
      action: 'Set up their membership, or mark them as a free place.',
      items: notPaying,
    })

    // ── 2. Invited, never confirmed ─────────────────────────────────────
    // ONLY for children who still have an active class. A pending invite for a
    // child who left months ago is not money the academy is missing — counting
    // those inflated one academy's figure from ~£2.4k to £5.6k in testing, and
    // a panel that overstates is a panel that gets ignored.
    const unconfirmed: AttentionItem[] = subs
      .filter((s) => s.status === 'pending_migration' && s.invite_sent_at && !s.invite_confirmed_at)
      .filter((s) => s.player_id && activePlayerIds.has(s.player_id as string))
      .map((s) => {
        const child = playerById.get(s.player_id as string)
        const who = child
          ? `${(child.first_name as string ?? '').trim()} ${(child.last_name as string ?? '').trim()}`.trim()
          : parentName.get(s.parent_id as string) ?? 'A family'
        return {
          kind: 'invite_unconfirmed' as const,
          label: who,
          ageDays: daysSince(s.invite_sent_at as string),
          amount: planAmount.get(s.plan_id as string),
        }
      })
      .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0))
    push({
      kind: 'invite_unconfirmed',
      title: 'Sent a payment link, not set up yet',
      action: 'They were asked but never finished. A nudge usually does it.',
      items: unconfirmed,
    })

    // ── 3. Payment failed ───────────────────────────────────────────────
    const failed: AttentionItem[] = subs
      .filter((s) => s.status === 'past_due')
      .map((s) => {
        const child = playerById.get(s.player_id as string)
        return {
          kind: 'payment_failed' as const,
          label: child
            ? `${(child.first_name as string ?? '').trim()} ${(child.last_name as string ?? '').trim()}`.trim()
            : parentName.get(s.parent_id as string) ?? 'A family',
          amount: planAmount.get(s.plan_id as string),
        }
      })
    push({
      kind: 'payment_failed',
      title: 'Their card stopped working',
      action: 'The bank declined it. They almost certainly do not know — a message fixes most of these.',
      items: failed,
    })

    // ── 4. Duplicate player records ─────────────────────────────────────
    const byKey = new Map<string, typeof players>()
    for (const p of players) {
      if (p.archived_at) continue
      const first = (p.first_name as string ?? '').trim().toLowerCase()
      const last = (p.last_name as string ?? '').trim().toLowerCase()
      if (!first && !last) continue
      const key = `${first}|${last}|${p.date_of_birth ?? ''}`
      byKey.set(key, [...(byKey.get(key) ?? []), p])
    }
    const dupes: AttentionItem[] = [...byKey.values()]
      .filter((g) => g.length > 1)
      .map((g) => ({
        kind: 'duplicate_player' as const,
        label: `${(g[0].first_name as string ?? '').trim()} ${(g[0].last_name as string ?? '').trim()}`.trim() + ` — ${g.length} records`,
        href: `/dashboard/players/${g[0].id}`,
      }))
    push({
      kind: 'duplicate_player',
      title: 'The same child twice',
      action: 'Duplicates can bill a family twice. Keep the right one and archive the other.',
      items: dupes,
    })

    return {
      groups,
      totalItems: groups.reduce((s, g) => s + g.total, 0),
      totalMonthly: groups.reduce((s, g) => s + g.amount, 0),
    }
  } catch {
    // A dashboard panel is never worth an error page.
    return empty
  }
}
