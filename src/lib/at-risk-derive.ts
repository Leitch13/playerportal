/**
 * At-Risk Family derivation — Phase 2.6.
 *
 * Pure derive layer. Takes signals that are ALREADY computed by other
 * derive modules (trial-derive, contact-derive, family-derive) and rolls
 * them up to:
 *   • a single `riskLevel`  ∈ { 'high' | 'medium' | 'healthy' }
 *   • an ordered `riskReasons[]` for the badge / chip / banner display
 *
 * NO I/O. NO DB. NO new business logic — every signal is sourced from an
 * existing derive module, so the same "what counts as a risk" answer
 * appears in every UI surface that consumes this.
 *
 * Risk tier model (user-confirmed for this phase):
 *
 *   HIGH                                    → riskLevel='high'
 *     Trial follow-up due
 *     Stale trial follow-up
 *     Payment issue
 *
 *   MEDIUM                                  → riskLevel='medium' (only if no high)
 *     No attendance 30+ days
 *     No contact 30+ days
 *     Never contacted
 *     Review due
 *
 *   HEALTHY                                 → riskLevel='healthy'
 *     No active signals
 *
 *   Dropped: "Trial extended" — no persistence layer; Phase 2.4 extend
 *   endpoints mutate dates without recording an extension marker. See the
 *   Phase 2.6 audit report for the data gap.
 */
import { needsFollowUp, type TrialStage } from './trial-derive'
import { contactBucket, type LastContactSignal } from './contact-derive'

// ─── Public types ──────────────────────────────────────────────────────

export type RiskLevel = 'high' | 'medium' | 'healthy'

export type RiskReasonKey =
  | 'trial_followup_due'
  | 'trial_stale_followup'
  | 'payment_issue'
  | 'no_attendance_30d'
  | 'not_contacted_30d'
  | 'never_contacted'
  | 'review_due'

export interface RiskReason {
  key: RiskReasonKey
  label: string
  tier: 'high' | 'medium'
  tone: 'rose' | 'amber'
  emoji: string
}

export interface RiskInputs {
  /**
   * Trial follow-up stage from `trial-followups-loader` (rolled up via
   * `pickMoreUrgentStage` across this family's enrolment-source and
   * email-matched booking-source rows). null = no follow-up open.
   */
  trialStage: TrialStage | null
  /**
   * Family-level badges produced by `deriveFamilyBadges` (family-derive).
   * We read the SET of keys, not the badge objects themselves, to avoid
   * coupling to the badge tone palette. Re-exporting them as risk-reason
   * keys means the underlying "what counts" logic lives only in
   * family-derive.
   */
  badges: Array<{ key: string }>
  /**
   * Contact signal from `contact-loader`. null = never contacted.
   */
  contactSignal: LastContactSignal | null
}

export interface RiskAssessment {
  riskLevel: RiskLevel
  riskReasons: RiskReason[]
}

// ─── Reason catalogue ─────────────────────────────────────────────────

const REASON_CATALOGUE: Record<RiskReasonKey, Omit<RiskReason, 'key'>> = {
  // HIGH
  trial_stale_followup: { label: 'Stale trial follow-up', tier: 'high',   tone: 'rose',  emoji: '⏰' },
  trial_followup_due:   { label: 'Trial follow-up due',   tier: 'high',   tone: 'rose',  emoji: '⏰' },
  payment_issue:        { label: 'Payment issue',         tier: 'high',   tone: 'rose',  emoji: '⚠️' },
  // MEDIUM
  no_attendance_30d:    { label: 'No attendance 30+ days', tier: 'medium', tone: 'amber', emoji: '⏱️' },
  not_contacted_30d:    { label: 'No contact 30+ days',    tier: 'medium', tone: 'amber', emoji: '📭' },
  never_contacted:      { label: 'Never contacted',        tier: 'medium', tone: 'amber', emoji: '📭' },
  review_due:           { label: 'Review due',             tier: 'medium', tone: 'amber', emoji: '📋' },
}

const reason = (key: RiskReasonKey): RiskReason => ({ key, ...REASON_CATALOGUE[key] })

// ─── Core derivation ──────────────────────────────────────────────────

/**
 * Reduce the per-family signal set to a single risk assessment.
 *
 * Reasons are emitted in HIGH-then-MEDIUM order. Inside each tier, the
 * order is the catalogue order above — kept stable so UI rendering is
 * deterministic and snapshotable.
 */
export function deriveRisk(inputs: RiskInputs): RiskAssessment {
  const reasons: RiskReason[] = []
  const badgeKeys = new Set(inputs.badges.map(b => b.key))

  // ── HIGH ──
  // Stale wins over awaiting if both somehow surface (they shouldn't —
  // pickMoreUrgentStage handles this upstream — but stay defensive).
  if (inputs.trialStage === 'stale_followup') {
    reasons.push(reason('trial_stale_followup'))
  } else if (inputs.trialStage && needsFollowUp(inputs.trialStage)) {
    reasons.push(reason('trial_followup_due'))
  }
  if (badgeKeys.has('payment_issue')) reasons.push(reason('payment_issue'))

  // ── MEDIUM ──
  if (badgeKeys.has('no_attendance_30d')) reasons.push(reason('no_attendance_30d'))
  // Contact: never_contacted is its own bucket — surface separately from
  // not_contacted_30d so the academy can see which one applies.
  const bucket = contactBucket(inputs.contactSignal)
  if (bucket === 'never') reasons.push(reason('never_contacted'))
  else if (bucket === 'stale_30plus') reasons.push(reason('not_contacted_30d'))
  if (badgeKeys.has('review_due')) reasons.push(reason('review_due'))

  // ── Tier roll-up ──
  const hasHigh = reasons.some(r => r.tier === 'high')
  const hasMedium = reasons.some(r => r.tier === 'medium')
  const riskLevel: RiskLevel = hasHigh ? 'high' : hasMedium ? 'medium' : 'healthy'

  return { riskLevel, riskReasons: reasons }
}

// ─── Filter routing helper ────────────────────────────────────────────

/**
 * Map a Parents-page filter chip key to a yes/no on this assessment.
 * Pure. The chip-key strings are owned by the ParentsTable component
 * (so the chip → filter mapping stays in the UI), but the matcher logic
 * lives here so risk semantics don't drift between surfaces.
 *
 * Returns false for any key this module doesn't recognise — callers
 * compose this with their existing filter routing.
 */
export type AtRiskFilterKey =
  | 'needs_attention'   // riskLevel ∈ { high, medium }
  | 'high_risk'         // riskLevel === 'high'
  | 'no_contact'        // reasons include never_contacted OR not_contacted_30d
  | 'attendance_risk'   // reasons include no_attendance_30d

export function matchesAtRiskFilter(a: RiskAssessment, filter: AtRiskFilterKey): boolean {
  switch (filter) {
    case 'needs_attention':  return a.riskLevel !== 'healthy'
    case 'high_risk':        return a.riskLevel === 'high'
    case 'no_contact':       return a.riskReasons.some(r => r.key === 'never_contacted' || r.key === 'not_contacted_30d')
    case 'attendance_risk':  return a.riskReasons.some(r => r.key === 'no_attendance_30d')
    default:                 return false
  }
}

// ─── Display palette ──────────────────────────────────────────────────

/**
 * Per-level visual settings the UI may use. Kept here so the section /
 * banner / chip stay in lockstep on tone shifts.
 */
export const RISK_LEVEL_DISPLAY: Record<RiskLevel, { label: string; emoji: string; tone: 'rose' | 'amber' | 'emerald' }> = {
  high:    { label: 'High priority',    emoji: '🔴', tone: 'rose' },
  medium:  { label: 'Medium priority',  emoji: '🟠', tone: 'amber' },
  healthy: { label: 'Healthy',          emoji: '🟢', tone: 'emerald' },
}
