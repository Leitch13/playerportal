// ============================================================================
// dashboard-metrics.ts — Dashboard MVP (owner-first command centre).
//
// PURE functions only — no DB access, no side effects. The dashboard server
// component does the I/O and passes rows in; these helpers define the
// canonical, correctly-labelled metrics so the dashboard finally tells one
// truth (see Phase-0 DASHBOARD_MVP_PHASE0.md).
//
// Display-layer only: nothing here writes, touches Stripe, or changes schema.
// Gated by DASHBOARD_MVP_ENABLED — flag OFF ⇒ none of this is reached and the
// dashboard renders exactly as before.
// ============================================================================

export const DASHBOARD_MVP_ENABLED = process.env.DASHBOARD_MVP_ENABLED === 'true'

// Phase 2A · Phase 1A — nested flag inside the already-live CommandCentre.
// OFF (default) ⇒ CommandCentre renders byte-identically to today's live
// dashboard. ON ⇒ adds the Academy Health Bar, the 6-card Business Snapshot
// (surfacing the already-computed revenueTrend + attendanceRate), and
// promotes the Action Queue to a full-width anchor. Display-layer only:
// no writes, no new queries, no schema, no protected systems. See
// ACADEMY_HOME_PHASE2A_PHASE0_1A.md.
export const DASHBOARD_HEALTHBAR_ENABLED = process.env.DASHBOARD_HEALTHBAR_ENABLED === 'true'

/** Subset of a payments row needed for outstanding/overdue maths. */
export interface PaymentLike {
  amount: number | string
  amount_paid?: number | string | null
  status?: string | null
  due_date?: string | null
}

const DAY_MS = 86_400_000

/** Amount still owed on a payment (never negative). */
export function paymentOwing(p: PaymentLike): number {
  const owing = Number(p.amount || 0) - Number(p.amount_paid || 0)
  return owing > 0 ? owing : 0
}

/** A payment with money still outstanding (unpaid / partial / stored-overdue). */
export function isUnpaid(p: PaymentLike): boolean {
  const s = (p.status || '').toLowerCase()
  return (s === 'unpaid' || s === 'partial' || s === 'overdue') && paymentOwing(p) > 0
}

/**
 * Read-time overdue test, honouring the academy's late-payment grace period
 * (Settings → Academy Policies → `late_payment_grace_days`). A payment is
 * overdue when it still owes money AND its due date plus the grace window is
 * in the past. This replaces the broken reliance on a stored `status='overdue'`
 * that nothing sets — see Phase-0 / task #254.
 */
export function isOverdue(p: PaymentLike, graceDays = 0, nowMs: number = Date.now()): boolean {
  if (!isUnpaid(p)) return false
  if (!p.due_date) return false
  const due = Date.parse(p.due_date)
  if (Number.isNaN(due)) return false
  return due + Math.max(0, graceDays) * DAY_MS < nowMs
}

/** Σ money still owed across all outstanding payments. */
export function sumOutstanding(rows: PaymentLike[]): number {
  return rows.reduce((sum, p) => sum + (isUnpaid(p) ? paymentOwing(p) : 0), 0)
}

/** Σ amount + count of payments that are overdue (grace-aware). */
export function sumOverdue(
  rows: PaymentLike[],
  graceDays = 0,
  nowMs: number = Date.now(),
): { amount: number; count: number } {
  let amount = 0
  let count = 0
  for (const p of rows) {
    if (isOverdue(p, graceDays, nowMs)) {
      amount += paymentOwing(p)
      count += 1
    }
  }
  return { amount, count }
}

/**
 * Active players = enrolled AND paying. Caller supplies the set of player ids
 * with an active enrolment and the set with an active (player-linked)
 * subscription; this returns how many appear in both.
 */
export function countActivePayingPlayers(
  enrolledPlayerIds: Set<string>,
  payingPlayerIds: Set<string>,
): number {
  let n = 0
  for (const id of enrolledPlayerIds) if (payingPlayerIds.has(id)) n++
  return n
}

/** Players with no active subscription = the conversion gap. */
export function playersNotPaying(totalPlayers: number, payingPlayerCount: number): number {
  return Math.max(0, totalPlayers - payingPlayerCount)
}

/**
 * Adaptive 5th hero card: show the bigger problem.
 *  - 'not_paying' when the conversion gap (players with no sub) is larger
 *  - 'at_risk'    when retention risk (at-risk families) is larger
 * Ties favour conversion ('not_paying').
 */
export function pickFifthCard(
  playersNotPayingCount: number,
  atRiskFamilies: number,
): 'not_paying' | 'at_risk' {
  return playersNotPayingCount >= atRiskFamilies ? 'not_paying' : 'at_risk'
}

/** £ formatter — whole pounds, thousands separated. */
export function formatGBP(n: number): string {
  return `£${Math.round(n).toLocaleString('en-GB')}`
}
