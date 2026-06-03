/**
 * Attendance Risk derivation — Phase 2.8.
 *
 * Pure derive only. Operates on already-loaded attendance history +
 * enrolment metadata. No I/O. No DB. No business logic in UI components.
 *
 * MODEL (user-confirmed — Interpretation C, tenure-gated)
 *
 *   NEW_PLAYER   No attendance records AND enrolled < 14 days ago
 *                → Do not flag (renderers should treat as healthy)
 *
 *   MEDIUM       (no records AND enrolled 14-29 days ago)
 *                OR (attended once AND last attendance 14-29 days ago)
 *
 *   HIGH         (no records AND enrolled ≥ 30 days ago)
 *                OR (attended once AND last attendance ≥ 30 days ago)
 *
 *   HEALTHY      Attended within the last 14 days
 *
 *   NOT_APPLICABLE  Enrolment is not 'active' (paused/cancelled/pending
 *                   etc.). Risk is undefined; UI should not flag.
 *
 * REASON DISTINCTION (do not merge)
 *
 *   never_attended   No attendance row has ever been recorded
 *   drifted          Has attended at least once, then stopped
 *
 * Reason-first labels (e.g. "Never attended (32 days enrolled)" or
 * "Drifted away (41 days since attendance)") are emitted here so every
 * surface — the Players table, the Parent Detail banner — uses the
 * exact same wording.
 */

// ─── Public types ──────────────────────────────────────────────────────

export type AttendanceRiskLevel = 'high' | 'medium' | 'healthy' | 'new_player' | 'not_applicable'

export type AttendanceReasonKind =
  | 'never_attended'        // active, no record
  | 'drifted'               // active, last attendance ≥ 14d ago
  | 'recently_attended'     // active, last attendance ≤ 14d
  | 'new_player'            // active, no record, enrolled < 14d
  | 'not_applicable'        // enrolment not active

export interface AttendanceRiskReason {
  kind: AttendanceReasonKind
  /** Days since `lastAttendanceAt`. Undefined when never attended. */
  daysSinceAttendance?: number
  /** Days since enrolment. Undefined when enrolment date is unknown. */
  tenureDays?: number
  /**
   * Display label used by every surface — e.g.
   *   "Never attended (32 days enrolled)"
   *   "Drifted away (41 days since attendance)"
   * Empty string for non-risk states so callers can use `label || ''`.
   */
  label: string
}

export interface AttendanceRiskInputs {
  /** Raw attendance rows for THIS player. May be filtered to present=true. */
  attendanceHistory: Array<{ session_date: string; present: boolean }> | null
  /** Enrolment status — only 'active' enrolments are risk-evaluated. */
  enrolmentStatus: string | null
  /** Enrolment timestamp (ISO). Null when the page hasn't loaded it yet. */
  enrolledAt: string | null
  /** Optional injection point for tests. Defaults to Date.now(). */
  nowMs?: number
}

export interface AttendanceRiskAssessment {
  riskLevel: AttendanceRiskLevel
  riskReason: AttendanceRiskReason
  /** Days since last `present=true` row. null when no such row exists. */
  daysSinceAttendance: number | null
  /** ISO date of the most recent `present=true` row. null when none. */
  lastAttendanceAt: string | null
  /** True iff at least one `present=true` row exists in the input. */
  attendedEver: boolean
  /** Days since `enrolledAt`. null when enrolment date is missing. */
  tenureDays: number | null
}

// ─── Thresholds ────────────────────────────────────────────────────────

/** Below this tenure, never-attended players are not flagged. */
export const NEW_PLAYER_DAYS = 14
/** Days threshold between healthy / medium (also between new_player / medium for no-record path). */
export const MEDIUM_THRESHOLD_DAYS = 14
/** Days threshold between medium / high. */
export const HIGH_THRESHOLD_DAYS = 30

// ─── Core derivation ──────────────────────────────────────────────────

export function deriveAttendanceRisk(inputs: AttendanceRiskInputs): AttendanceRiskAssessment {
  const nowMs = inputs.nowMs ?? Date.now()
  const today = startOfUtcDay(nowMs)

  // 1) Reduce attendance history to the most recent present=true row.
  let lastAttendanceAt: string | null = null
  for (const r of (inputs.attendanceHistory || [])) {
    if (!r.present) continue
    // session_date is a `date` column → 'YYYY-MM-DD'. String compare is
    // safe for ISO date format.
    if (!lastAttendanceAt || r.session_date > lastAttendanceAt) {
      lastAttendanceAt = r.session_date
    }
  }
  const attendedEver = lastAttendanceAt !== null

  // 2) daysSinceAttendance — clamped at 0 (a same-day attendance still
  //    counts as "today", not negative).
  let daysSinceAttendance: number | null = null
  if (lastAttendanceAt) {
    const ms = parseDateUtcStart(lastAttendanceAt)
    if (ms !== null) daysSinceAttendance = Math.max(0, Math.floor((today - ms) / 86_400_000))
  }

  // 3) tenureDays — null when enrolledAt missing.
  let tenureDays: number | null = null
  if (inputs.enrolledAt) {
    const ms = parseDateUtcStart(inputs.enrolledAt)
    if (ms !== null) tenureDays = Math.max(0, Math.floor((today - ms) / 86_400_000))
  }

  const baseFacts = { lastAttendanceAt, attendedEver, daysSinceAttendance, tenureDays }

  // 4) NOT_APPLICABLE — non-active enrolment.
  const status = (inputs.enrolmentStatus || '').toLowerCase()
  if (status !== 'active') {
    return {
      riskLevel: 'not_applicable',
      riskReason: { kind: 'not_applicable', label: '' },
      ...baseFacts,
    }
  }

  // 5) Drifted path — attended at least once.
  if (attendedEver && daysSinceAttendance !== null) {
    if (daysSinceAttendance < MEDIUM_THRESHOLD_DAYS) {
      return {
        riskLevel: 'healthy',
        riskReason: { kind: 'recently_attended', daysSinceAttendance, label: '' },
        ...baseFacts,
      }
    }
    const isHigh = daysSinceAttendance >= HIGH_THRESHOLD_DAYS
    return {
      riskLevel: isHigh ? 'high' : 'medium',
      riskReason: {
        kind: 'drifted',
        daysSinceAttendance,
        ...(tenureDays !== null ? { tenureDays } : {}),
        label: `Drifted away (${daysSinceAttendance} days since attendance)`,
      },
      ...baseFacts,
    }
  }

  // 6) Never-attended path — bucketed by tenure.
  if (tenureDays === null) {
    // No enrolment date → cannot evaluate. Treat as not_applicable so
    // the UI doesn't fabricate a risk from missing data.
    return {
      riskLevel: 'not_applicable',
      riskReason: { kind: 'not_applicable', label: '' },
      ...baseFacts,
    }
  }
  if (tenureDays < NEW_PLAYER_DAYS) {
    return {
      riskLevel: 'new_player',
      riskReason: { kind: 'new_player', tenureDays, label: '' },
      ...baseFacts,
    }
  }
  const isHigh = tenureDays >= HIGH_THRESHOLD_DAYS
  return {
    riskLevel: isHigh ? 'high' : 'medium',
    riskReason: {
      kind: 'never_attended',
      tenureDays,
      label: `Never attended (${tenureDays} days enrolled)`,
    },
    ...baseFacts,
  }
}

// ─── Filter routing ───────────────────────────────────────────────────

/**
 * Routes the Players-page filter chip keys to a yes/no on an assessment.
 * Same architectural shape as Phase 2.6 `matchesAtRiskFilter`.
 */
export type AttendanceFilterKey =
  | 'attendance_risk'       // riskLevel ∈ { high, medium }
  | 'no_attendance_14d'     // any reason WHERE the underlying days metric is ≥ 14
  | 'no_attendance_30d'     // ≥ 30

export function matchesAttendanceFilter(a: AttendanceRiskAssessment, filter: AttendanceFilterKey): boolean {
  switch (filter) {
    case 'attendance_risk':
      return a.riskLevel === 'high' || a.riskLevel === 'medium'
    case 'no_attendance_14d':
      return atLeastNDaysSilent(a, 14)
    case 'no_attendance_30d':
      return atLeastNDaysSilent(a, 30)
    default:
      return false
  }
}

/**
 * "At least N days of silence" — true when:
 *   • Drifted: daysSinceAttendance ≥ N
 *   • Never attended + active enrolment: tenureDays ≥ N
 *   • Otherwise (new_player, healthy, not_applicable): false
 */
function atLeastNDaysSilent(a: AttendanceRiskAssessment, n: number): boolean {
  if (a.riskLevel === 'not_applicable') return false
  if (a.attendedEver && a.daysSinceAttendance !== null) return a.daysSinceAttendance >= n
  if (!a.attendedEver && a.tenureDays !== null) return a.tenureDays >= n
  return false
}

// ─── Display palette ──────────────────────────────────────────────────

/**
 * Per-level visual settings the UI uses. Tone aligns with Phase 2.6
 * AtRiskBanner so a family with multiple high-risk signals looks
 * consistent.
 */
export const ATTENDANCE_LEVEL_DISPLAY: Record<AttendanceRiskLevel, {
  label: string
  emoji: string
  tone: 'rose' | 'amber' | 'emerald' | 'sky' | 'muted'
}> = {
  high:           { label: 'High',          emoji: '🔴', tone: 'rose' },
  medium:         { label: 'Medium',        emoji: '🟠', tone: 'amber' },
  healthy:        { label: 'Healthy',       emoji: '🟢', tone: 'emerald' },
  new_player:     { label: 'New player',    emoji: '🆕', tone: 'sky' },
  not_applicable: { label: 'Not applicable', emoji: '·',  tone: 'muted' },
}

/**
 * Short "Last attended" label used in the Players table column. Pure
 * formatter. Renderers may colour it based on the reason kind.
 */
export function formatLastAttended(a: AttendanceRiskAssessment): string {
  if (!a.attendedEver) return 'Never'
  const d = a.daysSinceAttendance ?? 0
  if (d <= 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d} days ago`
}

// ─── Internals ────────────────────────────────────────────────────────

function startOfUtcDay(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Parses both 'YYYY-MM-DD' (date columns like attendance.session_date)
 * and 'YYYY-MM-DDTHH:MM:SS+TZ' (timestamptz columns like enrolments.
 * enrolled_at) to a UTC-midnight ms value. Returns null on bad input.
 */
function parseDateUtcStart(s: string): number | null {
  const hasTime = /[T ]/.test(s)
  const raw = hasTime ? s : s + 'T00:00:00Z'
  const ms = Date.parse(raw)
  if (isNaN(ms)) return null
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
