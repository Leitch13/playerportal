/**
 * Pure helpers for the Parents List v2 page (Phase 2.3a).
 *
 * Family-level facts (status, value, badges) live in `family-derive.ts` —
 * this module adds only what's needed for the LIST view: search-hay
 * construction, filter-key matching, and at-risk classification.
 *
 * Pure. Read-only. No I/O.
 */

import type { FamilyBadge } from './family-derive'
// Phase 2.5 — contact-signal filter routing. Same pattern as the trial-
// follow-up filter added in Phase 2.4: derive-layer lives in its own
// module; this file just routes the filter chip key to the matcher.
import {
  matchesContactFilter,
  contactNeedsAttention,
  type LastContactSignal,
} from './contact-derive'
// Phase 2.6 — the at-risk rollup. Chip routing for needs_attention /
// high_risk / no_contact / attendance_risk lives here so the matcher
// composes cleanly with the existing parent-filter map.
import {
  matchesAtRiskFilter,
  type RiskAssessment,
  type AtRiskFilterKey,
} from './at-risk-derive'

// ─── Row contract used by the Parents table ────────────────────────────
// Shape the client component receives. The server-rendered loader fully
// hydrates this before handing it to the table; the table doesn't fetch.
export interface ParentRowFacts {
  id: string
  parentName: string
  parentEmail: string | null
  parentPhone: string | null
  childCount: number
  childrenNames: string[]
  familyValue: number
  billingStatus: 'healthy' | 'payment_issue' | 'pending_start' | 'none'
  badges: FamilyBadge[]
  joinedAtIso: string
  // Phase 2.5 — null when the parent has no contact record in either
  // messaging system. Loader pre-computes this and attaches it once per
  // row; the client never re-queries.
  contactSignal?: LastContactSignal | null
  // Phase 2.6 — server-computed risk assessment. Attached once per row by
  // the page loader (calls `deriveRisk` from at-risk-derive). The filter
  // matcher + Families Requiring Attention section both consume this.
  // Optional for forward-compat — older tests can omit and rows degrade
  // to riskLevel='healthy' for routing purposes.
  riskAssessment?: RiskAssessment | null
}

// ─── Search-hay ────────────────────────────────────────────────────────

/**
 * Lower-cased searchable string for a parent row. We concatenate the
 * fields the spec covers (parent name + email + phone + child names) so
 * a single `String.includes(query)` covers every search expectation.
 */
export function parentSearchHay(r: ParentRowFacts): string {
  return [
    r.parentName,
    r.parentEmail || '',
    r.parentPhone || '',
    r.childrenNames.join(' '),
  ].join(' ').toLowerCase()
}

// Note: Phase 2.5 intentionally does NOT add 'never' / 'stale' tokens to the
// search hay — those are filter-chip semantics. Search stays scoped to
// parent + child identifying strings.

// ─── Filter routing ────────────────────────────────────────────────────

export type ParentFilterKey =
  | 'all' | 'healthy' | 'payment_issues' | 'pending_starts'
  | 'trials' | 'no_attendance_30d' | 'review_due' | 'attention'
  | 'trial_followup'
  // Phase 2.5 — Last Contacted chips.
  | 'contacted_recently' | 'not_contacted_30d' | 'never_contacted'
  // Phase 2.6 — At-Risk chips. Reuses matchesAtRiskFilter so the chip
  // semantics live in exactly one place (at-risk-derive).
  | 'needs_attention' | 'high_risk' | 'no_contact' | 'attendance_risk'

/**
 * Returns true iff the row matches the active filter. Pure reduction
 * over the row's pre-derived `billingStatus` + `badges` set.
 *
 * The `attention` super-filter matches if ANY actionable badge fires —
 * deliberately excludes 'sibling_eligible' (positive signal, not an
 * attention-needing one) and 'pending_start' (also surfaced individually).
 */
export function parentMatchesFilter(r: ParentRowFacts, filter: ParentFilterKey): boolean {
  if (filter === 'all') return true
  if (filter === 'healthy')         return r.billingStatus === 'healthy'
  if (filter === 'payment_issues')  return r.billingStatus === 'payment_issue'
  if (filter === 'pending_starts')  return r.billingStatus === 'pending_start' || r.badges.some(b => b.key === 'pending_start')
  if (filter === 'trials')          return r.badges.some(b => b.key === 'trial_expiring')
  if (filter === 'no_attendance_30d') return r.badges.some(b => b.key === 'no_attendance_30d')
  if (filter === 'review_due')      return r.badges.some(b => b.key === 'review_due')
  if (filter === 'attention')       return needsAttention(r)
  // Phase 2.4 — match BOTH badge variants for the trial follow-up filter.
  if (filter === 'trial_followup')  return r.badges.some(b => b.key === 'trial_followup_due' || b.key === 'trial_stale_followup')
  // Phase 2.5 — Last Contacted chips. Routed through contact-derive so the
  // 30-day threshold lives in exactly one place.
  if (filter === 'contacted_recently') return matchesContactFilter(r.contactSignal ?? null, 'contacted_recently')
  if (filter === 'not_contacted_30d')  return matchesContactFilter(r.contactSignal ?? null, 'not_contacted_30d')
  if (filter === 'never_contacted')    return matchesContactFilter(r.contactSignal ?? null, 'never_contacted')
  // Phase 2.6 — At-Risk chips. If no riskAssessment was attached (e.g. a
  // call site that hasn't loaded the new derive layer yet), default to
  // healthy so the matcher returns false rather than throwing.
  const filtersInAtRisk: AtRiskFilterKey[] = ['needs_attention', 'high_risk', 'no_contact', 'attendance_risk']
  if (filtersInAtRisk.includes(filter as AtRiskFilterKey)) {
    if (!r.riskAssessment) return false
    return matchesAtRiskFilter(r.riskAssessment, filter as AtRiskFilterKey)
  }
  return true
}

/**
 * A row "needs attention" if it falls into HIGH or MEDIUM risk per the
 * Phase 2.6 rollup. We prefer the at-risk assessment when available
 * because it's the canonical "does this need work" answer used by every
 * surface. Falls back to the pre-2.6 badge + contact checks when no
 * assessment is attached (e.g. legacy call sites or tests).
 *
 * 'sibling_eligible' is a positive marker and is excluded from the
 * legacy fallback.
 */
export function needsAttention(r: ParentRowFacts): boolean {
  if (r.riskAssessment) return r.riskAssessment.riskLevel !== 'healthy'
  if (r.badges.some(b => b.key !== 'sibling_eligible')) return true
  return contactNeedsAttention(r.contactSignal ?? null)
}

// ─── Sort routing ──────────────────────────────────────────────────────

export type ParentSortKey = 'name' | 'children' | 'value' | 'joined'

export function compareParents(a: ParentRowFacts, b: ParentRowFacts, key: ParentSortKey): number {
  switch (key) {
    case 'children': {
      if (a.childCount !== b.childCount) return b.childCount - a.childCount
      return a.parentName.localeCompare(b.parentName)
    }
    case 'value': {
      if (a.familyValue !== b.familyValue) return b.familyValue - a.familyValue
      return a.parentName.localeCompare(b.parentName)
    }
    case 'joined': {
      return b.joinedAtIso.localeCompare(a.joinedAtIso)
    }
    case 'name':
    default:
      return a.parentName.localeCompare(b.parentName)
  }
}
