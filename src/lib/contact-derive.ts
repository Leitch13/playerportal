/**
 * Contact-signal derivation — Phase 2.5.
 *
 * Pure helpers that map a parent's `LastContactSignal` (raw timestamps
 * already maxed across both messaging systems by `contact-loader.ts`) to:
 *   • a display bucket  ('today' | 'recent_7d' | 'recent_30d' | 'stale_30plus' | 'never')
 *   • a human label     ('Today' | '3 days ago' | '14 days ago' | 'Never')
 *   • a filter match for the Parents-List filter chips
 *
 * No I/O. No DB. The loader runs separately and feeds the rolled-up signal
 * into these helpers — same architectural split as `trial-derive` /
 * `trial-followups-loader` from Phase 2.4.
 *
 * Definitions confirmed by the user for this phase:
 *   Contacted recently = ≤ 30 days
 *   Not contacted     = > 30 days since last contact
 *   Never contacted   = no contact record in either messaging system
 */

// ─── Per-parent signal (the output of contact-loader) ─────────────────

export interface LastContactSignal {
  /** ISO timestamp of the most recent message in EITHER system. null = never */
  lastIso: string | null
  /** Distinct conversation_id count from the new conversation system. Used on Parent Detail only. */
  conversationCount: number
  /** ISO of the most recent message (alias for lastIso; surfaced explicitly on the
   *  Parent Detail page so future divergence between "any contact" and "message-
   *  type contact" is easy to model). */
  mostRecentMessageIso: string | null
}

// ─── Thresholds ────────────────────────────────────────────────────────

export const STALE_DAYS = 30        // > 30 days → "Not contacted"
export const RECENT_DAYS = 30       // ≤ 30 days → "Contacted recently"

// ─── Display bucket + label ───────────────────────────────────────────

export type ContactBucket =
  | 'today'         // exact same UTC day
  | 'recent_7d'     // 1–7 days
  | 'recent_30d'    // 8–30 days
  | 'stale_30plus'  // > 30 days
  | 'never'         // no record

/**
 * Map a signal to a coarse bucket used by the Parents List label + the
 * "Last contact" column tone shift. Pure.
 */
export function contactBucket(
  signal: LastContactSignal | null,
  nowMs: number = Date.now(),
): ContactBucket {
  if (!signal || !signal.lastIso) return 'never'
  const ms = parseSafe(signal.lastIso)
  if (ms === null) return 'never'
  const days = Math.floor((startOfUtcDay(nowMs) - startOfUtcDay(ms)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days <= 7) return 'recent_7d'
  if (days <= STALE_DAYS) return 'recent_30d'
  return 'stale_30plus'
}

/**
 * Human-readable label for the "Last contact" column.
 *   today                → 'Today'
 *   1 day                → 'Yesterday'
 *   2–30 days            → 'N days ago'
 *   > 30 days            → 'N days ago' (renderer chooses tone)
 *   no record            → 'Never'
 */
export function formatContactAge(
  signal: LastContactSignal | null,
  nowMs: number = Date.now(),
): string {
  if (!signal || !signal.lastIso) return 'Never'
  const ms = parseSafe(signal.lastIso)
  if (ms === null) return 'Never'
  const days = Math.floor((startOfUtcDay(nowMs) - startOfUtcDay(ms)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// ─── Filter routing ────────────────────────────────────────────────────

export type ContactFilterKey =
  | 'contacted_recently'   // ≤ 30 days
  | 'not_contacted_30d'    // > 30 days since last contact
  | 'never_contacted'      // no record at all

/**
 * Match a row's signal against a contact-filter key. Returns false for any
 * other filter key (caller composes with the existing parent-filter set).
 * Pure.
 */
export function matchesContactFilter(
  signal: LastContactSignal | null,
  filter: ContactFilterKey,
  nowMs: number = Date.now(),
): boolean {
  const bucket = contactBucket(signal, nowMs)
  switch (filter) {
    case 'contacted_recently':
      return bucket === 'today' || bucket === 'recent_7d' || bucket === 'recent_30d'
    case 'not_contacted_30d':
      return bucket === 'stale_30plus'
    case 'never_contacted':
      return bucket === 'never'
    default:
      return false
  }
}

/**
 * Returns true if THIS signal should contribute to the "Needs attention"
 * cohort. Per the user's call:
 *   never_contacted       → attention
 *   not_contacted_30d     → attention
 *   contacted_recently    → NOT attention (positive signal)
 */
export function contactNeedsAttention(
  signal: LastContactSignal | null,
  nowMs: number = Date.now(),
): boolean {
  const bucket = contactBucket(signal, nowMs)
  return bucket === 'never' || bucket === 'stale_30plus'
}

// ─── Internals ─────────────────────────────────────────────────────────

function startOfUtcDay(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Parse a Postgres date OR timestamptz string to ms. Returns null on bad
 * input. Mirrors the helper in `trial-derive.ts` — both serialisations
 * surface on this surface (legacy `messages.created_at` is timestamptz;
 * new `conversation_messages.created_at` is also timestamptz).
 */
function parseSafe(s: string): number | null {
  const ms = Date.parse(/[T ]/.test(s) ? s : s + 'T00:00:00Z')
  return isNaN(ms) ? null : ms
}
