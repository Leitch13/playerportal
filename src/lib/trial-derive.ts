/**
 * Trial Timeline derivation — Phase 2.4.
 *
 * Pure helpers that map BOTH backing trial systems to a single timeline
 * stage:
 *   • trial_bookings        — the legacy "book a trial" flow with its own
 *                             reminder/conversion cron pipeline. Has fields
 *                             status, preferred_date, followup_sent,
 *                             converted, updated_at.
 *   • enrolments.is_trial   — the newer "enrolment that's flagged as a
 *                             trial" mechanism. Has fields status,
 *                             activates_on, trial_expires_at.
 *
 * No DB, no I/O. Every derivation is a pure function of the row + an
 * optional `nowMs` for testability. Phase 1 introduces NO schema changes
 * — every stage is derivable from existing columns.
 */

// ─── Shared stage enum (the public timeline contract) ──────────────────

export type TrialStage =
  // Pre-trial
  | 'upcoming'             // trial day in the future
  | 'today'                // trial day is today (booking) OR trial is in-progress (enrolment)

  // Post-trial follow-up cohort (the cohort academy owners need to action)
  | 'awaiting_followup'    // trial happened or expired; follow-up not yet sent / not yet decided
  | 'followed_up'          // follow-up sent / converted not yet decided, within 7d of trial date
  | 'stale_followup'       // follow-up sent + >7d, still not converted/lost (escalate)

  // Terminal states
  | 'converted'            // booking.converted=true OR enrolment.is_trial=false (converted)
  | 'lost'                 // explicit cancel / no-show / admin marked lost

// ─── trial_bookings → stage ────────────────────────────────────────────

export interface TrialBookingInput {
  id: string
  status: string                  // pending | confirmed | attended | no_show | cancelled | converted
  preferred_date: string | null   // ISO YYYY-MM-DD
  followup_sent: boolean | null
  converted: boolean | null
  updated_at: string | null       // ISO timestamp; used as "follow-up sent at" proxy when followup_sent=true
}

const STALE_FOLLOWUP_DAYS = 7

/**
 * Map a trial_bookings row to a TrialStage. Pure.
 *
 * Priority:
 *   converted=true   → 'converted'
 *   status='cancelled' or 'no_show' → 'lost'
 *   status='attended':
 *     !followup_sent → 'awaiting_followup'
 *     followup_sent + ≤7d → 'followed_up'
 *     followup_sent + >7d → 'stale_followup'
 *   pending/confirmed:
 *     preferred_date in future → 'upcoming'
 *     preferred_date = today   → 'today'
 *     preferred_date in past   → 'awaiting_followup' (admin missed updating status)
 *   anything else → 'upcoming' (safe default)
 */
export function deriveTrialStageFromBooking(
  b: TrialBookingInput,
  nowMs: number = Date.now(),
): TrialStage {
  if (b.converted === true) return 'converted'

  const status = (b.status || '').toLowerCase()
  if (status === 'cancelled' || status === 'no_show') return 'lost'

  if (status === 'attended') {
    if (!b.followup_sent) return 'awaiting_followup'
    // followup_sent=true. Use updated_at if present to gauge age, else
    // preferred_date as a fallback. Default to 'followed_up' when we can't tell.
    const refIso = b.updated_at || b.preferred_date
    if (!refIso) return 'followed_up'
    const refMs = Date.parse(refIso)
    if (isNaN(refMs)) return 'followed_up'
    const daysSince = Math.floor((nowMs - refMs) / 86_400_000)
    return daysSince > STALE_FOLLOWUP_DAYS ? 'stale_followup' : 'followed_up'
  }

  // pending or confirmed
  if (!b.preferred_date) return 'upcoming'
  const preferredMs = Date.parse(b.preferred_date + 'T00:00:00Z')
  if (isNaN(preferredMs)) return 'upcoming'
  const todayMs = startOfUtcDay(nowMs)
  if (preferredMs > todayMs) return 'upcoming'
  if (preferredMs === todayMs) return 'today'
  // preferred_date is past but admin never marked attended/no_show — surface
  // as needs-follow-up so the admin sees and triages it.
  return 'awaiting_followup'
}

// ─── enrolments.is_trial → stage ───────────────────────────────────────

export interface TrialEnrolmentInput {
  id: string
  status: string                  // active | pending | paused | cancelled | inactive
  is_trial: boolean | null
  trial_expires_at: string | null // ISO date
  activates_on: string | null     // ISO date
}

/**
 * Map an enrolment row (is_trial=true) to a TrialStage. Pure.
 *
 *   status='cancelled' → 'lost'
 *   status='paused'    → 'lost' (admin halted)
 *   is_trial=false     → 'converted' (treated as converted; the enrolment
 *                        continues as a non-trial enrolment)
 *   status='pending'   → 'upcoming' (Stage 3 future start)
 *   status='active':
 *     trial_expires_at in future → 'today' (in-progress)
 *     trial_expires_at <= today  → 'awaiting_followup'
 *     no trial_expires_at        → 'today' (active trial, no expiry set)
 *   default → 'today'
 *
 * Note: 'followed_up' and 'stale_followup' don't apply to enrolment-trials
 * in Phase 1 because there is no follow-up flag on enrolments. We expose
 * only the "awaiting_followup" cohort — admins resolve it via the same
 * convert/extend/lost actions as bookings.
 */
export function deriveTrialStageFromEnrolment(
  e: TrialEnrolmentInput,
  nowMs: number = Date.now(),
): TrialStage {
  const status = (e.status || '').toLowerCase()
  if (status === 'cancelled' || status === 'inactive') return 'lost'
  if (status === 'paused') return 'lost'
  if (e.is_trial === false) return 'converted'
  if (status === 'pending') return 'upcoming'

  if (status === 'active') {
    if (!e.trial_expires_at) return 'today'
    // `trial_expires_at` is declared TIMESTAMPTZ (migration 009) but the
    // newer `activates_on` is a plain date. Postgrest serialises them
    // differently: 'YYYY-MM-DDTHH:MM:SS+TZ' for timestamptz and
    // 'YYYY-MM-DD' for date. We tolerate both by skipping the bare-date
    // augmentation when the string already contains a time component.
    const expiryMs = parseDbDate(e.trial_expires_at)
    if (isNaN(expiryMs)) return 'today'
    const todayMs = startOfUtcDay(nowMs)
    return expiryMs <= todayMs ? 'awaiting_followup' : 'today'
  }

  return 'today'
}

// ─── Cohort helpers (used by the Enrolments page + filter chips) ───────

/**
 * Returns true for the cohort that needs an admin's follow-up action.
 * This is the union surfaced under "Trial Follow-up Due" on every page.
 */
export function needsFollowUp(stage: TrialStage): boolean {
  return stage === 'awaiting_followup' || stage === 'stale_followup'
}

/**
 * Returns true for stages that should appear in the "currently in trial"
 * cohort (pre-conversion, pre-loss). Useful for the existing Trial chip.
 */
export function isActiveTrialStage(stage: TrialStage): boolean {
  return stage === 'upcoming' || stage === 'today' || stage === 'awaiting_followup'
      || stage === 'followed_up' || stage === 'stale_followup'
}

// ─── Human-readable labels for chips / badges ──────────────────────────

export const STAGE_LABEL: Record<TrialStage, string> = {
  upcoming:          'Upcoming',
  today:             'Today',
  awaiting_followup: 'Follow-up due',
  followed_up:       'Followed up',
  stale_followup:    'Stale follow-up',
  converted:         'Converted',
  lost:              'Lost',
}

// ─── Badge factory for Parent-row surfaces ─────────────────────────────

/**
 * Map a follow-up stage to a parent-row badge. Returns `null` for stages
 * outside the follow-up cohort so callers can blindly `.filter(Boolean)`.
 *
 * Used by:
 *   • Parents List v2 (Phase 2.4 step 3) — chip on a family row
 *   • Players List v2 (next step)        — chip on a player row
 *   • Parent Detail page                 — badge in the FamilyInsightsBar
 *
 * Tone matches the Enrolments section:
 *   stale_followup    → rose  (escalate)
 *   awaiting_followup → amber (follow-up due)
 */
export interface TrialFollowUpBadge {
  key: 'trial_followup_due' | 'trial_stale_followup'
  label: string
  tone: 'rose' | 'amber'
  emoji: string
}

export function deriveTrialFollowUpBadge(stage: TrialStage): TrialFollowUpBadge | null {
  if (stage === 'stale_followup') {
    return { key: 'trial_stale_followup', label: 'Stale trial follow-up', tone: 'rose', emoji: '⏰' }
  }
  if (stage === 'awaiting_followup') {
    return { key: 'trial_followup_due', label: 'Trial follow-up due', tone: 'amber', emoji: '⏰' }
  }
  return null
}

/**
 * When a single family has multiple follow-up rows (e.g. two children, one
 * stale + one awaiting), the badge should reflect the MORE URGENT stage.
 * Pure ordering: stale_followup wins over awaiting_followup.
 */
export function pickMoreUrgentStage(a: TrialStage, b: TrialStage): TrialStage {
  if (a === 'stale_followup' || b === 'stale_followup') return 'stale_followup'
  if (a === 'awaiting_followup' || b === 'awaiting_followup') return 'awaiting_followup'
  return a
}

// ─── Days-since helpers used by row labels ─────────────────────────────

export function daysSinceTrialDate(
  b: TrialBookingInput | { preferred_date: string | null; updated_at?: string | null },
  nowMs: number = Date.now(),
): number | null {
  const ref = b.preferred_date || b.updated_at
  if (!ref) return null
  const ms = parseDbDate(ref)
  if (isNaN(ms)) return null
  return Math.max(0, Math.floor((nowMs - ms) / 86_400_000))
}

// ─── Internal: midnight UTC for a given ms instant ─────────────────────

function startOfUtcDay(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// ─── Internal: parse a Postgres date/timestamptz string to ms ──────────
//
// Postgrest returns:
//   • `date`        → 'YYYY-MM-DD'
//   • `timestamptz` → 'YYYY-MM-DDTHH:MM:SS+00:00' (includes a T/+ marker)
//
// `Date.parse('YYYY-MM-DD')` is timezone-implementation-defined; appending
// 'T00:00:00Z' makes it deterministic UTC midnight. For strings that
// already have a time component, we leave them alone — appending would
// produce nonsense like '2026-07-04T00:00:00+00:00T00:00:00Z' which
// Date.parse returns NaN for.
function parseDbDate(s: string): number {
  return Date.parse(/[T ]/.test(s) ? s : s + 'T00:00:00Z')
}
