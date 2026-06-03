/**
 * Pure derivation helpers for the Parent Detail Page (Phase 2.2).
 *
 * Every function here is:
 *   - Pure (no I/O)
 *   - Read-only — never mutates inputs, never calls Stripe / webhook / DB
 *   - Side-effect-free
 *
 * Per-child derivations (status, sub-status, attendance, review-due) are
 * reused from `src/lib/players-derive.ts` — these functions roll those
 * per-child facts up to a family view.
 */

import {
  deriveRowStatus,
  deriveSubStatus,
  type DerivedRowStatus,
  type DerivedSubStatus,
} from './players-derive'

// ─── Shape of a single child as fed to the family roll-up ──────────────
export interface FamilyChild {
  id: string
  enrolments: Array<{
    status: string | null
    is_trial?: boolean | null
    trial_expires_at?: string | null
    activates_on?: string | null
  }> | null
  subscriptions: Array<{ status: string | null }> | null
  lastAttendanceDays: number | null   // null = no attendance recorded
  latestReviewDateIso: string | null
}

// ─── Monthly family value (£) ──────────────────────────────────────────

/**
 * Sum of plan amounts across the family's active OR trialing subscriptions.
 * Pure reduction — no Stripe call. Caller is responsible for ensuring the
 * input set is scoped to the parent + org.
 */
export function deriveFamilyValue(
  subscriptions: Array<{ status: string | null; plan: { amount?: number | null } | null }> | null,
): number {
  if (!subscriptions) return 0
  return subscriptions.reduce((sum, s) => {
    if (s.status !== 'active' && s.status !== 'trialing') return sum
    const amount = Number(s.plan?.amount ?? 0)
    if (isNaN(amount) || amount <= 0) return sum
    return sum + amount
  }, 0)
}

// ─── Last successful payment ───────────────────────────────────────────

export interface PaymentRow {
  amount_paid?: number | null
  paid_date?: string | null
  status?: string | null
  // The optional plan-name join used by the existing Parents page.
  plan?: { name?: string | null } | null
  // Or a generic descriptor field
  description?: string | null
}

export interface LastPaidSummary {
  amount: number
  dateIso: string
  label: string
}

/**
 * Find the most recent successful payment from a flat list.
 *
 * Read-only over `payments` rows. Returns null if no paid row exists. The
 * label prefers an explicit description, then the plan name, then 'Payment'.
 */
export function deriveLastPaidPayment(payments: PaymentRow[] | null): LastPaidSummary | null {
  if (!payments || payments.length === 0) return null
  const paid = payments
    .filter(p => (p.status || '').toLowerCase() === 'paid' && p.paid_date)
    .sort((a, b) => (b.paid_date || '').localeCompare(a.paid_date || ''))
  if (paid.length === 0) return null
  const top = paid[0]
  const label = top.description?.trim()
    || top.plan?.name?.trim()
    || 'Payment'
  return {
    amount: Number(top.amount_paid ?? 0) || 0,
    dateIso: top.paid_date as string,
    label,
  }
}

// ─── Family-level subscription chip ────────────────────────────────────

export type FamilyBillingStatus = 'healthy' | 'payment_issue' | 'pending_start' | 'none'

/**
 * Reduce a family's subscription set to ONE chip for the header. Priority:
 *   payment_issue  ← any past_due wins (loudest signal)
 *   healthy        ← any active or trialing sub
 *   pending_start  ← only scheduled subs
 *   none           ← no subs
 */
export function deriveFamilyBillingStatus(
  subscriptions: Array<{ status: string | null }> | null,
): FamilyBillingStatus {
  if (!subscriptions || subscriptions.length === 0) return 'none'
  const set = new Set(subscriptions.map(s => (s.status || '').toLowerCase()))
  if (set.has('past_due')) return 'payment_issue'
  if (set.has('active') || set.has('trialing')) return 'healthy'
  if (set.has('scheduled')) return 'pending_start'
  return 'none'
}

// ─── Family insight badges (the conditional row at the top) ───────────

export interface FamilyBadge {
  key: string
  label: string
  tone: 'rose' | 'amber' | 'sky' | 'emerald'
  emoji: string
}

export interface FamilyBadgeOpts {
  children: FamilyChild[]
  childCount: number
  /** Set by the org settings — surfaces a hint if N children ≥ 2 */
  siblingDiscountEnabled?: boolean
  /** Injectable for tests; defaults to Date.now() */
  nowMs?: number
}

export function deriveFamilyBadges(opts: FamilyBadgeOpts): FamilyBadge[] {
  const out: FamilyBadge[] = []
  const now = opts.nowMs ?? Date.now()
  const sevenDaysMs = 7 * 86_400_000

  // Payment issue — any child has a past_due sub
  if (opts.children.some(c => deriveSubStatus(c.subscriptions) === 'past_due')) {
    out.push({ key: 'payment_issue', label: 'Payment issue', tone: 'rose', emoji: '⚠️' })
  }

  // Pending start — any child has a scheduled sub OR pending enrolment
  const pendingChild = opts.children.find(c =>
    deriveRowStatus(c.enrolments) === 'pending' ||
    deriveSubStatus(c.subscriptions) === 'pending',
  )
  if (pendingChild) {
    // Find a date if available — first non-empty activates_on
    let date: string | null = null
    for (const c of opts.children) {
      for (const e of c.enrolments || []) {
        if ((e.status || '') === 'pending' && e.activates_on) {
          date = e.activates_on
          break
        }
      }
      if (date) break
    }
    out.push({
      key: 'pending_start',
      label: date ? `Pending start: ${date}` : 'Pending start',
      tone: 'amber',
      emoji: '⏳',
    })
  }

  // Trial expiring within 7 days
  const trialSoon = opts.children.some(c =>
    (c.enrolments || []).some(e =>
      e.is_trial && e.trial_expires_at && (() => {
        const t = new Date(e.trial_expires_at).getTime()
        if (isNaN(t)) return false
        return t - now <= sevenDaysMs && t >= now
      })(),
    ),
  )
  if (trialSoon) {
    out.push({ key: 'trial_expiring', label: 'Trial expiring (7d)', tone: 'sky', emoji: '🔵' })
  }

  // Review due — count children with a stale or missing review
  const reviewDueCount = opts.children.filter(c => {
    if (!c.latestReviewDateIso) return true
    const t = new Date(c.latestReviewDateIso).getTime()
    if (isNaN(t)) return false
    return now - t > 30 * 86_400_000
  }).length
  if (reviewDueCount > 0) {
    out.push({
      key: 'review_due',
      label: reviewDueCount === 1 ? 'Review due: 1' : `Review due: ${reviewDueCount}`,
      tone: 'amber',
      emoji: '📋',
    })
  }

  // No attendance in 30 days — any child whose lastAttendanceDays is null
  // (never attended) or > 30
  const dormantChild = opts.children.some(c =>
    c.lastAttendanceDays === null || (c.lastAttendanceDays > 30),
  )
  // Suppress this badge unless at least one child has an active or trial enrolment
  // (a child who never enrolled isn't "dormant", they're just new)
  const hasAnyActiveEnrol = opts.children.some(c =>
    (c.enrolments || []).some(e => (e.status || '') === 'active'),
  )
  if (dormantChild && hasAnyActiveEnrol) {
    out.push({ key: 'no_attendance_30d', label: 'No attendance (30d)', tone: 'amber', emoji: '⏰' })
  }

  // Sibling-eligible — N children ≥ 2 AND org has discount enabled
  if (opts.siblingDiscountEnabled && opts.childCount >= 2) {
    out.push({ key: 'sibling_eligible', label: 'Sibling discount eligible', tone: 'emerald', emoji: '👨‍👩‍👧' })
  }

  return out
}

// ─── Type re-exports for convenience ───────────────────────────────────
export type { DerivedRowStatus, DerivedSubStatus }
