/**
 * Last Contacted loader — Phase 2.5.
 *
 * Pulls the latest "contact" timestamp per parent across BOTH messaging
 * systems and rolls up to a `LastContactSignal` per parent id.
 *
 * READ-ONLY. No writes. No Stripe / cron / email touched.
 *
 *   • Legacy public.messages
 *       — flat sender_id → recipient_id model (schema.sql + migration 027)
 *       — currently holds 1 row in production
 *   • New public.conversations + conversation_participants + conversation_messages
 *       — conversation-based (migration 043)
 *       — currently holds 0 rows in production
 *
 * Both systems will accumulate going forward as admins use the existing
 * messaging UI. The Phase 2.4 trial-followups-loader uses the same
 * dual-system shape — proven pattern.
 *
 * Architecture: this loader is the only place that hits messaging tables
 * for THIS surface. The derive layer (`contact-derive.ts`) operates on
 * the loader's output and is pure.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LastContactSignal } from '@/lib/contact-derive'

/**
 * Returns a Map<parentId, LastContactSignal>. Parents with no record in
 * either system are simply absent from the map — callers should treat
 * `map.get(parentId) ?? null` as "Never contacted".
 *
 * On any Postgrest error, the failing arm degrades to an empty contribution
 * (the other arm still wins). This matches the Phase 2.4 loader's failure-
 * tolerance pattern — a hiccup in one system never blocks the rest of the
 * page render.
 */
export async function loadLastContactedMap(
  supabase: SupabaseClient,
  parentIds: string[],
): Promise<Map<string, LastContactSignal>> {
  if (parentIds.length === 0) return new Map()

  // Run both pulls in parallel. They hit different tables.
  const [legacy, conv] = await Promise.all([
    loadLegacyMessageMap(supabase, parentIds).catch(() => new Map<string, string>()),
    loadConversationMap(supabase, parentIds).catch(() => ({
      latest: new Map<string, string>(),
      counts: new Map<string, number>(),
    })),
  ])

  const out = new Map<string, LastContactSignal>()
  // Seed from every parent that appeared in either map.
  const allIds = new Set<string>()
  for (const k of legacy.keys()) allIds.add(k)
  for (const k of conv.latest.keys()) allIds.add(k)
  for (const k of conv.counts.keys()) allIds.add(k)

  for (const parentId of allIds) {
    const a = legacy.get(parentId) || null
    const b = conv.latest.get(parentId) || null
    const last = pickNewer(a, b)
    out.set(parentId, {
      lastIso: last,
      mostRecentMessageIso: last,
      conversationCount: conv.counts.get(parentId) || 0,
    })
  }
  return out
}

// ─── Arm 1: Legacy public.messages ────────────────────────────────────

/**
 * For each parent id in the input, finds the newest legacy `messages`
 * row's created_at where the parent is sender OR recipient.
 *
 * One query, single ORDER BY → first-hit-per-key reduction. The
 * `idx_messages_created` index from migration 027 makes the ORDER cheap.
 */
async function loadLegacyMessageMap(
  supabase: SupabaseClient,
  parentIds: string[],
): Promise<Map<string, string>> {
  if (parentIds.length === 0) return new Map()
  // Postgrest's .in() builder is efficient; .or() needs comma-separated
  // bracket syntax for IN within OR. We construct the filter explicitly.
  const ids = parentIds.join(',')
  const { data, error } = await supabase
    .from('messages')
    .select('sender_id, recipient_id, created_at')
    .or(`sender_id.in.(${ids}),recipient_id.in.(${ids})`)
    .order('created_at', { ascending: false })
  if (error || !data) return new Map()

  const out = new Map<string, string>()
  const parentSet = new Set(parentIds)
  for (const row of data) {
    // Determine which side of the message is the parent we care about.
    // A message may match because the parent is the sender OR the recipient.
    // We attribute the timestamp to BOTH sides if both happen to be parents,
    // but in practice one side is the academy admin so only one ID is set.
    if (parentSet.has(row.sender_id) && !out.has(row.sender_id)) {
      out.set(row.sender_id, row.created_at)
    }
    if (parentSet.has(row.recipient_id) && !out.has(row.recipient_id)) {
      out.set(row.recipient_id, row.created_at)
    }
  }
  return out
}

// ─── Arm 2: Newer conversation system ─────────────────────────────────

/**
 * For each parent id, finds:
 *   • the newest `conversation_messages.created_at` from any conversation
 *     they participate in
 *   • the count of distinct conversations they participate in (surfaced
 *     on the Parent Detail page)
 *
 * Two queries (participants → messages) chained, not parallel, because
 * the second query depends on the first's conversation_id list.
 */
async function loadConversationMap(
  supabase: SupabaseClient,
  parentIds: string[],
): Promise<{ latest: Map<string, string>; counts: Map<string, number> }> {
  const empty = { latest: new Map<string, string>(), counts: new Map<string, number>() }
  if (parentIds.length === 0) return empty

  const { data: parts, error: pErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('user_id', parentIds)
  if (pErr || !parts) return empty
  if (parts.length === 0) return empty

  // conversation_id → list of participant user_ids (limited to our parent set)
  const partsByConv = new Map<string, string[]>()
  const countsByParent = new Map<string, number>()
  for (const p of parts) {
    const list = partsByConv.get(p.conversation_id) || []
    list.push(p.user_id)
    partsByConv.set(p.conversation_id, list)
    countsByParent.set(p.user_id, (countsByParent.get(p.user_id) || 0) + 1)
  }

  const convIds = [...partsByConv.keys()]
  const { data: msgs, error: mErr } = await supabase
    .from('conversation_messages')
    .select('conversation_id, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })
  if (mErr || !msgs) {
    return { latest: new Map(), counts: countsByParent }
  }

  // Newest message per conversation (first-hit reduction over the sorted list).
  const latestByConv = new Map<string, string>()
  for (const m of msgs) {
    if (!latestByConv.has(m.conversation_id)) latestByConv.set(m.conversation_id, m.created_at)
  }

  // Roll each conversation's newest message up to each parent participant,
  // keeping the maximum across that parent's conversations.
  const latestByParent = new Map<string, string>()
  for (const [convId, ts] of latestByConv) {
    for (const userId of (partsByConv.get(convId) || [])) {
      const prev = latestByParent.get(userId)
      if (!prev || prev < ts) latestByParent.set(userId, ts)
    }
  }
  return { latest: latestByParent, counts: countsByParent }
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Lexicographic compare works on ISO 8601 timestamps. */
function pickNewer(a: string | null, b: string | null): string | null {
  if (a && b) return a > b ? a : b
  return a || b
}
