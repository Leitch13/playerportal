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

// ─── Filter routing ────────────────────────────────────────────────────

export type ParentFilterKey =
  | 'all' | 'healthy' | 'payment_issues' | 'pending_starts'
  | 'trials' | 'no_attendance_30d' | 'review_due' | 'attention'
  | 'trial_followup'

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
  return true
}

/**
 * A row "needs attention" if it has at least one actionable badge.
 * 'sibling_eligible' is a positive marker, not an attention signal.
 */
export function needsAttention(r: ParentRowFacts): boolean {
  return r.badges.some(b => b.key !== 'sibling_eligible')
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
