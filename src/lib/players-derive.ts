/**
 * Pure derivation helpers for the Players List v2 page.
 *
 * Every function in this module is:
 *   - Pure (no I/O, no Date.now beyond an injectable `now` param)
 *   - Read-only — never mutates inputs
 *   - Side-effect-free — no DB writes, no network calls, no email, no Stripe
 *
 * These are the ONLY computations Phase 2.1 introduces. They run client-side
 * after a single server-side data load. No new billing math, no new
 * attendance math, no new review math — they all reduce existing rows.
 */

// ─── Age ───────────────────────────────────────────────────────────────

/**
 * Years between DOB and now (or `nowMs` if injected for testing).
 * Adjusts for whether the birthday has passed this year — a child born
 * 2018-12-15 is 7 on 2026-06-02, not 8.
 */
export function deriveAge(dobIso: string | null, nowMs: number = Date.now()): number | null {
  if (!dobIso) return null
  const dob = new Date(dobIso)
  if (isNaN(dob.getTime())) return null
  const now = new Date(nowMs)
  let age = now.getUTCFullYear() - dob.getUTCFullYear()
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) age--
  return age < 0 ? null : age
}

// ─── Attendance ────────────────────────────────────────────────────────

export interface AttendanceRow {
  player_id: string
  session_date: string  // ISO YYYY-MM-DD
  present: boolean
}

export interface AttendanceSummary {
  present: number
  total: number
  pct: number | null     // 0–100; null if total === 0
  lastDateIso: string | null
}

/**
 * Roll a flat list of attendance rows into a per-player summary.
 * Caller is responsible for narrowing the input to the desired window
 * (typically last 30 days). The pure function trusts the input set.
 *
 * Returns a Map<playerId, AttendanceSummary>. Players with no rows in the
 * input simply aren't keys in the result; callers should treat absence
 * as "no recent attendance".
 */
export function summariseAttendance(rows: AttendanceRow[]): Map<string, AttendanceSummary> {
  const byPlayer = new Map<string, { present: number; total: number; lastDateIso: string | null }>()
  for (const r of rows) {
    const prev = byPlayer.get(r.player_id) || { present: 0, total: 0, lastDateIso: null }
    prev.total += 1
    if (r.present) prev.present += 1
    // Latest date seen — string comparison works for ISO YYYY-MM-DD.
    if (!prev.lastDateIso || r.session_date > prev.lastDateIso) prev.lastDateIso = r.session_date
    byPlayer.set(r.player_id, prev)
  }
  const out = new Map<string, AttendanceSummary>()
  for (const [pid, agg] of byPlayer) {
    out.set(pid, {
      present: agg.present,
      total: agg.total,
      pct: agg.total > 0 ? Math.round((agg.present / agg.total) * 100) : null,
      lastDateIso: agg.lastDateIso,
    })
  }
  return out
}

export function daysSinceIso(iso: string | null, nowMs: number = Date.now()): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000))
}

// ─── Subscription status (read-only — no Stripe calls) ─────────────────

export type DerivedSubStatus = 'active' | 'past_due' | 'pending' | 'cancelled' | 'none'

/**
 * Reduce a player's subscription rows to a single chip. Priority order:
 *   past_due  ← payment issue (worst, surface loudest)
 *   active    ← paying / trialing through Stripe
 *   pending   ← scheduled (Stage 3 future-start)
 *   cancelled ← all cancelled
 *   none      ← no rows at all
 *
 * This is purely a label for the chip. NO Stripe API calls, NO writes.
 */
export function deriveSubStatus(
  subscriptions: Array<{ status: string | null }> | null | undefined,
): DerivedSubStatus {
  if (!subscriptions || subscriptions.length === 0) return 'none'
  const set = new Set(subscriptions.map(s => (s.status || '').toLowerCase()))
  if (set.has('past_due')) return 'past_due'
  if (set.has('active') || set.has('trialing')) return 'active'
  if (set.has('scheduled')) return 'pending'
  return 'cancelled'
}

// ─── Row-level enrolment status (drives the Status chip + filter) ──────

export type DerivedRowStatus = 'active' | 'pending' | 'trial' | 'paused' | 'inactive'

/**
 * Reduce a player's enrolment rows to a single chip. Priority:
 *   active   (non-trial active wins)
 *   trial    (any is_trial that's still live)
 *   pending  (Stage 3 future-start)
 *   paused
 *   inactive (none of the above, or only cancelled)
 */
export function deriveRowStatus(
  enrolments: Array<{ status: string | null; is_trial?: boolean | null }> | null | undefined,
): DerivedRowStatus {
  if (!enrolments || enrolments.length === 0) return 'inactive'
  if (enrolments.some(e => (e.status || '') === 'active' && !e.is_trial)) return 'active'
  if (enrolments.some(e => e.is_trial && ((e.status || '') === 'active' || (e.status || '') === 'pending'))) return 'trial'
  if (enrolments.some(e => (e.status || '') === 'pending')) return 'pending'
  if (enrolments.some(e => (e.status || '') === 'paused')) return 'paused'
  return 'inactive'
}

// ─── Review-due flag ───────────────────────────────────────────────────

/**
 * True iff the player has never been reviewed OR the latest review is
 * older than 30 days. Mirrors the threshold the coach dashboard already
 * uses for its "needs review" cohort — we are NOT introducing new review
 * math.
 */
export function deriveReviewDue(latestReviewDateIso: string | null, nowMs: number = Date.now()): boolean {
  if (!latestReviewDateIso) return true
  const t = new Date(latestReviewDateIso).getTime()
  if (isNaN(t)) return false
  return (nowMs - t) > 30 * 86_400_000
}

// ─── Primary class label (already-active enrolment names) ──────────────

/**
 * Given a list of enrolments with embedded group names, return a
 * comma-joined string of the currently-active class names (matching the
 * existing column's behaviour).
 */
export function deriveActiveClassNames(
  enrolments: Array<{ status: string | null; group: { name: string } | null }> | null | undefined,
): string {
  if (!enrolments) return ''
  return enrolments
    .filter(e => (e.status || '') === 'active')
    .map(e => e.group?.name)
    .filter(Boolean)
    .join(', ')
}
