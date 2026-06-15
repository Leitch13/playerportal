// ============================================================================
// enrolments-revops.ts — Enrolments Revenue Ops, Phase 1A (Action Centre).
//
// Pure helpers + flag for the read-only "Daily Actions" band on the Enrolments
// page. Everything here is a pure transform over data the page already loads
// (trial enrolments, follow-up cohort) plus two flag-gated reads (trial
// conversion counts, recent attendance) — reusing the shipped derive helpers.
//
// No queries here, no writes, no schema. Flag OFF ⇒ the band is never built and
// the Enrolments page renders byte-identical to today.
// ============================================================================

import { deriveAttendanceRisk, type AttendanceRiskLevel } from '@/lib/attendance-risk-derive'
import { deriveConversionRates, type ConversionCounts } from '@/lib/trial-conversion-derive'

export const ENROLMENTS_REVOPS_ENABLED = process.env.ENROLMENTS_REVOPS_ENABLED === 'true'

const DAY_MS = 86_400_000

// UTC day-delta for a date/timestamp string. Mirrors the page's existing
// daysFromNow helper; slice(0,10) makes it robust to either 'YYYY-MM-DD' or a
// full TIMESTAMPTZ value.
export function daysFromNowUtc(iso: string, nowMs: number): number {
  const t = new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime()
  return Math.ceil((t - nowMs) / DAY_MS)
}

// ─── Trials ending soon ──────────────────────────────────────────────────
type TrialInput = {
  id: string
  trial_expires_at?: string | null
  status: string
  player: { first_name: string; last_name: string } | null
  group: { name: string; day_of_week?: string } | null
}

export type ActionTrial = {
  id: string
  playerName: string
  className: string
  daysLeft: number | null
  status: string
}

// From the already-loaded trial cohort: those expiring within `withinDays`
// (including already-overdue), soonest/most-overdue first. No new data.
export function trialsEndingSoon(trials: TrialInput[], nowMs: number, withinDays = 7): ActionTrial[] {
  const out: ActionTrial[] = []
  for (const t of trials) {
    if (!t.trial_expires_at) continue
    const d = daysFromNowUtc(t.trial_expires_at, nowMs)
    if (d > withinDays) continue
    out.push({
      id: t.id,
      playerName: `${t.player?.first_name ?? ''} ${t.player?.last_name ?? ''}`.trim() || 'Player',
      className: t.group?.name ?? 'Unassigned',
      daysLeft: d,
      status: t.status,
    })
  }
  return out.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
}

// ─── Conversion summary ──────────────────────────────────────────────────
export type ConversionSummary = {
  active: number
  endingThisWeek: number
  followUpDue: number
  grossPct: number | null
  grossSampleN: number
}

// Trial "pulse" + reuse deriveConversionRates for the gross conversion %.
export function conversionSummary(input: {
  activeTrials: number
  endingThisWeek: number
  followUpDue: number
  counts: ConversionCounts | null
}): ConversionSummary {
  const rates = input.counts ? deriveConversionRates(input.counts) : null
  return {
    active: input.activeTrials,
    endingThisWeek: input.endingThisWeek,
    followUpDue: input.followUpDue,
    grossPct: rates?.grossPct ?? null,
    grossSampleN: rates?.grossSampleN ?? 0,
  }
}

// ─── Attendance concerns ─────────────────────────────────────────────────
type ActiveInput = {
  player_id: string
  status: string
  enrolled_at: string
  player: { first_name: string; last_name: string } | null
  group: { name: string } | null
}

export type AttendanceConcern = {
  playerId: string
  playerName: string
  className: string
  classCount: number
  level: AttendanceRiskLevel
  daysSinceAttendance: number | null
}

// One concern PER PLAYER (not per enrolment): a child in N classes appears once,
// with their worst risk and a class count. Attendance history is player-wide, so
// we derive risk once using the player's longest-standing enrolment context
// (earliest enrolled_at avoids a tenured player being mis-flagged "new"). Surface
// only high/medium, highest-risk + longest-absence first.
export function buildAttendanceConcerns(
  active: ActiveInput[],
  attendanceByPlayer: Map<string, Array<{ session_date: string; present: boolean }>>,
  nowMs: number,
): AttendanceConcern[] {
  const byPlayer = new Map<string, ActiveInput[]>()
  for (const e of active) {
    const arr = byPlayer.get(e.player_id) ?? []
    arr.push(e)
    byPlayer.set(e.player_id, arr)
  }

  const out: AttendanceConcern[] = []
  for (const [playerId, enrolments] of byPlayer) {
    const earliest = enrolments.reduce((a, b) => (a.enrolled_at <= b.enrolled_at ? a : b))
    const a = deriveAttendanceRisk({
      attendanceHistory: attendanceByPlayer.get(playerId) ?? null,
      enrolmentStatus: earliest.status,
      enrolledAt: earliest.enrolled_at,
      nowMs,
    })
    if (a.riskLevel !== 'high' && a.riskLevel !== 'medium') continue
    const first = enrolments[0]
    out.push({
      playerId,
      playerName: `${first.player?.first_name ?? ''} ${first.player?.last_name ?? ''}`.trim() || 'Player',
      className: first.group?.name ?? 'Unassigned',
      classCount: enrolments.length,
      level: a.riskLevel,
      daysSinceAttendance: a.daysSinceAttendance,
    })
  }

  const rank = (l: AttendanceRiskLevel) => (l === 'high' ? 0 : 1)
  return out.sort(
    (x, y) => rank(x.level) - rank(y.level) || (y.daysSinceAttendance ?? 0) - (x.daysSinceAttendance ?? 0),
  )
}
