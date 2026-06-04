/**
 * Cancellation Intelligence — pure derive layer.
 *
 * Mirrors the pattern of trial-conversion-derive.ts: takes pre-fetched
 * rows, returns shaped results. Zero I/O. Zero side effects. Easy to
 * unit-test (`scripts/_unit_tests_cancellation_derive.mjs` placeholder
 * for a future test file — derive logic is testable in isolation).
 *
 * Inputs come from the AdminPayments server fetch (org-scoped already)
 * so the derive layer trusts its input is already filtered to the
 * admin's organisation.
 */

// ─── Types ────────────────────────────────────────────────────────────

/**
 * Pre-joined cancellation row. The page enriches each cancellations row
 * with the plan amount it represented (joined via stripe_subscription_id
 * → subscriptions → subscription_plans). `plan_amount` is null when:
 *   • the row is a class-type cancellation (no sub linked), or
 *   • the join couldn't resolve (legacy data, orphaned cancel).
 */
export interface CancellationRow {
  id: string
  cancellation_type: 'class' | 'subscription' | null
  reason: string | null
  reason_detail: string | null
  offered_discount: boolean
  accepted_discount: boolean
  discount_percent: number | null
  final_status: 'cancelled' | 'retained' | string | null
  cancelled_at: string | null
  plan_amount: number | null
}

export interface LostMRR {
  thisMonth: number
  last30Days: number
  last90Days: number
  thisMonthCount: number
  last30DaysCount: number
  last90DaysCount: number
}

export interface SavedMRR {
  retainedCount: number
  savedMonthlyMRR: number
}

export interface OfferROI {
  offered: number
  accepted: number
  acceptancePct: number | null   // null when offered < 3 (sample-size discipline)
  discountCostMonthly: number
  savedMonthlyMRR: number
  /** Net retention value per month = savedMRR − discountCost. */
  netMonthlyValue: number
}

export interface ReasonRow {
  reason: string         // canonical key, e.g. 'too_expensive'
  label: string          // display label
  count: number
  percentage: number     // 0-100, rounded to 1dp
}

export interface TrendBucket {
  /** ISO date YYYY-MM-DD */
  date: string
  count: number
}

export interface DataIntegrityResult {
  /** True when a data-integrity notice should render. */
  showNotice: boolean
  capturedSubscriptionCancellations: number
  detectedSubscriptionCancellations: number
  /** Number of cancellations missing from the captured table. */
  uncapturedCount: number
}

// ─── Constants ────────────────────────────────────────────────────────

/**
 * Minimum row count before we render percentages or share-shaped data.
 * Below this, the dashboard renders an empty-state explanation.
 * Matches the sample-size discipline used in trial-conversion-derive.ts.
 */
export const MIN_ROWS_FOR_INSIGHTS = 5

/**
 * Minimum offered-discount count before we show the acceptance %.
 * Acceptance % is highly noisy below this — e.g. 1 of 2 offered = 50%
 * acceptance, statistically meaningless.
 */
export const MIN_OFFERED_FOR_ACCEPTANCE_PCT = 3

const REASON_LABELS: Record<string, string> = {
  too_expensive:     'Too expensive',
  not_using:         'Not using',
  switching:         'Switching academies',
  child_stopped:     'Child stopped',
  unhappy:           'Unhappy with service',
  other:             'Other',
  schedule_conflict: 'Schedule conflict',
  unspecified:       'Unspecified',
}

export function labelForReason(reason: string | null | undefined): string {
  if (!reason) return REASON_LABELS.unspecified
  return REASON_LABELS[reason] ?? reason
}

// ─── Time-window helpers ──────────────────────────────────────────────

function inWindow(iso: string | null | undefined, since: Date): boolean {
  if (!iso) return false
  const d = new Date(iso)
  return !Number.isNaN(d.getTime()) && d >= since
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function daysAgo(now: Date, n: number): Date {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  return d
}

// ─── Section A — Lost MRR ─────────────────────────────────────────────

/**
 * Lost MRR = sum of (monthly plan amount) for cancellations where:
 *   • cancellation_type === 'subscription'
 *   • final_status === 'cancelled'   (NOT retained)
 *   • cancelled_at in window
 *
 * Class cancellations are excluded (they don't directly kill a sub).
 * Retained cancellations are excluded (we saved them).
 */
export function deriveLostMRR(rows: CancellationRow[], now: Date = new Date()): LostMRR {
  const monthStart = startOfMonth(now)
  const start30 = daysAgo(now, 30)
  const start90 = daysAgo(now, 90)

  let thisMonth = 0, thisMonthCount = 0
  let last30Days = 0, last30DaysCount = 0
  let last90Days = 0, last90DaysCount = 0

  for (const r of rows) {
    if (r.cancellation_type !== 'subscription') continue
    if (r.final_status === 'retained') continue
    const amount = Number(r.plan_amount ?? 0)
    if (inWindow(r.cancelled_at, monthStart)) {
      thisMonth += amount
      thisMonthCount += 1
    }
    if (inWindow(r.cancelled_at, start30)) {
      last30Days += amount
      last30DaysCount += 1
    }
    if (inWindow(r.cancelled_at, start90)) {
      last90Days += amount
      last90DaysCount += 1
    }
  }
  return { thisMonth, last30Days, last90Days, thisMonthCount, last30DaysCount, last90DaysCount }
}

// ─── Section B — Saved MRR ────────────────────────────────────────────

/**
 * Saved MRR = sum of (monthly plan amount) for cancellations where the
 * parent accepted the retention offer (final_status='retained').
 *
 * Counts only sub-type cancellations — class cancels don't have MRR.
 * Saved MRR is the recurring revenue we kept; it's NOT reduced by the
 * discount given (that's tracked separately in the Offer ROI panel).
 */
export function deriveSavedMRR(rows: CancellationRow[]): SavedMRR {
  let retainedCount = 0
  let savedMonthlyMRR = 0
  for (const r of rows) {
    if (r.cancellation_type !== 'subscription') continue
    if (r.final_status !== 'retained') continue
    retainedCount += 1
    savedMonthlyMRR += Number(r.plan_amount ?? 0)
  }
  return { retainedCount, savedMonthlyMRR }
}

// ─── Section C — Retention Offer ROI ─────────────────────────────────

/**
 * Retention-offer effectiveness over ALL captured cancellations
 * (sub-type only — class cancels don't see retention offers).
 *
 * Numerator/denominator:
 *   • offered  = count where offered_discount = true
 *   • accepted = count where accepted_discount = true
 *
 * acceptancePct suppressed (returns null) when offered < 3 to avoid
 * single-row noise (1 of 1 = 100% acceptance is misleading).
 *
 * Cost vs. value:
 *   • discountCostMonthly = sum of (plan.amount × discount_percent / 100)
 *                            for accepted offers. The monthly £ given up.
 *   • savedMonthlyMRR     = sum of plan.amount for accepted offers — the
 *                            recurring revenue we kept (gross).
 *   • netMonthlyValue     = savedMonthlyMRR − discountCostMonthly
 *                            (i.e. the £/month we actually pocket from
 *                            running the retention offer programme).
 */
export function deriveOfferROI(rows: CancellationRow[]): OfferROI {
  let offered = 0, accepted = 0
  let discountCostMonthly = 0
  let savedMonthlyMRR = 0
  for (const r of rows) {
    if (r.cancellation_type !== 'subscription') continue
    if (r.offered_discount) offered += 1
    if (r.accepted_discount) {
      accepted += 1
      const amount = Number(r.plan_amount ?? 0)
      const pct = Number(r.discount_percent ?? 0)
      savedMonthlyMRR += amount
      discountCostMonthly += amount * pct / 100
    }
  }
  const acceptancePct = offered >= MIN_OFFERED_FOR_ACCEPTANCE_PCT
    ? Math.round((accepted / offered) * 1000) / 10
    : null
  const netMonthlyValue = savedMonthlyMRR - discountCostMonthly
  return { offered, accepted, acceptancePct, discountCostMonthly, savedMonthlyMRR, netMonthlyValue }
}

// ─── Section D — Reason Breakdown ────────────────────────────────────

/**
 * Counts cancellations by reason for the window. Both class + sub types
 * counted (academy owners care WHY parents leave regardless of cancel
 * type). Percentages 0-100, 1dp, sorted by count desc.
 */
export function deriveReasonBreakdown(rows: CancellationRow[], windowDays?: number, now: Date = new Date()): ReasonRow[] {
  const since = typeof windowDays === 'number' ? daysAgo(now, windowDays) : null
  const counts = new Map<string, number>()
  let total = 0
  for (const r of rows) {
    if (since && !inWindow(r.cancelled_at, since)) continue
    const key = r.reason || 'unspecified'
    counts.set(key, (counts.get(key) || 0) + 1)
    total += 1
  }
  if (total === 0) return []
  const out: ReasonRow[] = []
  for (const [reason, count] of counts) {
    out.push({
      reason,
      label: labelForReason(reason),
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    })
  }
  out.sort((a, b) => b.count - a.count)
  return out
}

// ─── Section E — Trend ────────────────────────────────────────────────

/**
 * Per-day cancellation counts over the trailing `windowDays` window.
 * Includes class + sub cancellations. Returns one bucket per day,
 * oldest first, zero-padded so a flat zero-period chart still draws.
 */
export function deriveTrend(rows: CancellationRow[], windowDays: number, now: Date = new Date()): TrendBucket[] {
  const buckets = new Map<string, number>()
  const start = daysAgo(now, windowDays)
  // Initialise each day with 0 so the chart renders a continuous line.
  for (let i = windowDays; i >= 0; i--) {
    const d = daysAgo(now, i)
    const key = d.toISOString().split('T')[0]
    buckets.set(key, 0)
  }
  for (const r of rows) {
    if (!inWindow(r.cancelled_at, start)) continue
    const key = (r.cancelled_at ?? '').split('T')[0]
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1)
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }))
}

// ─── Section F — Data Integrity ──────────────────────────────────────

/**
 * Surfaces the orphaned-cancellation gap.
 *
 * `detectedSubscriptionCancellations` is the count of `subscriptions` rows
 * for this org that show a cancel signal (canceled_at != null OR
 * cancelled_at != null OR cancel_at_period_end = true).
 *
 * `capturedSubscriptionCancellations` is the count of `cancellations`
 * rows with cancellation_type='subscription' AND final_status='cancelled'.
 *
 * If captured < detected, some cancellations happened outside the
 * in-app flow (legacy data, Stripe-side admin cancels, etc) — surface
 * the gap so the owner knows the dashboard is undercounting.
 */
export function deriveDataIntegrity(
  capturedSubscriptionCancellations: number,
  detectedSubscriptionCancellations: number,
): DataIntegrityResult {
  const uncaptured = Math.max(0, detectedSubscriptionCancellations - capturedSubscriptionCancellations)
  return {
    showNotice: uncaptured > 0,
    capturedSubscriptionCancellations,
    detectedSubscriptionCancellations,
    uncapturedCount: uncaptured,
  }
}

// ─── Empty state ──────────────────────────────────────────────────────

export function isUnderMinSample(rows: CancellationRow[]): boolean {
  return rows.length < MIN_ROWS_FOR_INSIGHTS
}
