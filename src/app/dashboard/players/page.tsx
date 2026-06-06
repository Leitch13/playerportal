/**
 * Players page — server-side data load + page chrome.
 *
 * Phase 2.1 changes:
 *   - Added explicit `organisation_id` scoping to EVERY query (the original
 *     query relied on RLS alone — defence in depth + parity with the
 *     Enrolments page pattern).
 *   - Single bundled data load: players + parent + enrolments + groups +
 *     subscriptions (read-only, just the status column) + 30-day attendance
 *     window + latest progress_review per player.
 *   - Drops the inline table and renders the new client `PlayersTable` for
 *     search / filter / sort / quick actions, plus the server-rendered
 *     `PlayersInsightsBar` totals at the top.
 *
 * Read-only. Touches no billing, no Stripe, no webhook, no cron, no emails,
 * no enrolment activation logic. Subscription rows are read to derive a
 * chip label — no Stripe API calls, no writes.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/EmptyState'
import QuickAddPlayer from './QuickAddPlayer'
import ExportCSV from './ExportCSV'
import ImportPlayersModal from './ImportPlayersModal'
import PlayersTable, { type PlayersTableRow } from './PlayersTable'
import PlayersInsightsBar from './PlayersInsightsBar'
import {
  deriveAge,
  deriveActiveClassNames,
  deriveReviewDue,
  deriveRowStatus,
  deriveSubStatus,
  summariseAttendance,
  daysSinceIso,
  type AttendanceRow,
} from '@/lib/players-derive'
// Phase 2.4: trial follow-up cohort. We match ONLY by playerId here —
// booking-source rows lack a player FK and would require fuzzy joins
// (parent_email → profile → players), which the spec forbids. Those
// rows stay surfaced on /dashboard/enrolments and /dashboard/trials.
import { loadTrialFollowUpRows } from '@/lib/trial-followups-loader'
import { pickMoreUrgentStage, type TrialStage } from '@/lib/trial-derive'
// Phase 2.5 — optional "No contact 30+ days" badge per player. Keyed by
// the player's parent_id since contact is captured per parent profile,
// not per child.
import { loadLastContactedMap } from '@/lib/contact-loader'
import { contactBucket } from '@/lib/contact-derive'
// Phase 2.8 — Attendance Risk derive. Pure helpers consume the same
// attendance rows the existing summariseAttendance already reads —
// this is purely additive on the read side.
import {
  deriveAttendanceRisk,
  type AttendanceRiskAssessment,
} from '@/lib/attendance-risk-derive'

// Cap defensively at 500 rows per render. Jamie has ~30; the largest org
// we serve has well under 500. Above this, we'd paginate (Phase 2.2).
const ROW_CAP = 500

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // Org scoping — explicit + defence-in-depth.
  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .single()
  const orgId = profile?.organisation_id || ''
  if (!orgId) redirect('/dashboard')

  // ── 1. Players + parent + enrolments + group ──
  // Org-scoped EXPLICITLY (the prior version relied on RLS alone).
  // Sprint 7 — select archived_at + archive_reason so the table can render
  // the [ARCHIVED] badge and the 'archived' filter chip can include them.
  // Default view excludes archived; switching to the Archived filter shows
  // them.
  const { data: playersRaw } = await supabase
    .from('players')
    .select(`
      id, first_name, last_name, photo_url, playing_level, parent_id,
      date_of_birth, created_at, organisation_id,
      archived_at, archive_reason,
      parent:profiles!players_parent_id_fkey(full_name, email, phone),
      enrolments(status, is_trial, trial_expires_at, activates_on, enrolled_at, group:training_groups(name))
    `)
    .eq('organisation_id', orgId)
    .order('first_name')
    .limit(ROW_CAP)

  const players = (playersRaw || []) as unknown as Array<{
    id: string
    first_name: string
    last_name: string
    photo_url: string | null
    playing_level: string | null
    parent_id: string | null
    date_of_birth: string | null
    created_at: string
    archived_at: string | null
    archive_reason: string | null
    parent: { full_name: string | null; email: string | null; phone: string | null } | null
    enrolments: Array<{ status: string | null; is_trial: boolean | null; trial_expires_at: string | null; activates_on: string | null; enrolled_at: string | null; group: { name: string } | null }> | null
  }>

  const playerIds = players.map(p => p.id)

  // ── 2. Read-only subscription status per player (read-only — no Stripe) ──
  let subsByPlayer = new Map<string, Array<{ status: string }>>()
  if (playerIds.length > 0) {
    const { data: subsRows } = await supabase
      .from('subscriptions')
      .select('player_id, status')
      .eq('organisation_id', orgId)
      .in('player_id', playerIds)
    for (const row of (subsRows || []) as Array<{ player_id: string | null; status: string | null }>) {
      if (!row.player_id) continue
      const list = subsByPlayer.get(row.player_id) || []
      list.push({ status: row.status || '' })
      subsByPlayer.set(row.player_id, list)
    }
  }

  // ── 3. Attendance — 365-day window aggregated per player.
  // Phase 2.8 widens the window from 30 to 365 days so the
  // attendance-risk derive can detect "drifted away N>30d" cases
  // (the 30-day window would have made them indistinguishable from
  // never-attended). At Jamie's scale this is ~3 rows today; at full
  // coverage scale (~5000 rows for ~100 active × 52 sessions) it
  // remains a single indexed query.
  const yearAgoIso = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  let attendanceSummary = new Map<string, ReturnType<typeof summariseAttendance> extends Map<string, infer V> ? V : never>()
  // Phase 2.8 — per-player attendance history for the derive layer.
  const attendanceByPlayer = new Map<string, Array<{ session_date: string; present: boolean }>>()
  if (playerIds.length > 0) {
    const { data: attRows } = await supabase
      .from('attendance')
      .select('player_id, session_date, present')
      .in('player_id', playerIds)
      .gte('session_date', yearAgoIso)
    const all = (attRows || []) as Array<AttendanceRow & { present: boolean }>
    for (const r of all) {
      const arr = attendanceByPlayer.get(r.player_id) || []
      arr.push({ session_date: r.session_date, present: r.present })
      attendanceByPlayer.set(r.player_id, arr)
    }
    // The existing summariseAttendance keeps its current 30-day semantics
    // (used by the existing Attendance % column). Filter the row set
    // before passing it in so we don't change that column's meaning.
    const last30 = all.filter(r => r.session_date >= thirtyDaysAgoIso) as AttendanceRow[]
    attendanceSummary = summariseAttendance(last30)
  }

  // ── 4. Latest progress_review per player ──
  const latestReviewByPlayer = new Map<string, string>()
  if (playerIds.length > 0) {
    const { data: reviewRows } = await supabase
      .from('progress_reviews')
      .select('player_id, review_date')
      .in('player_id', playerIds)
      .order('review_date', { ascending: false })
    for (const r of (reviewRows || []) as Array<{ player_id: string; review_date: string }>) {
      if (!latestReviewByPlayer.has(r.player_id)) {
        latestReviewByPlayer.set(r.player_id, r.review_date)
      }
    }
  }

  // ── 4a. Phase 2.5 — Last Contacted, scoped to the parent_ids referenced
  //         by these players. We don't need the full signal here — just a
  //         boolean per player: "is this child's parent stale_30plus OR
  //         never_contacted?". The badge is purely informational, no chip
  //         filter, no action.
  const parentIdsForContact = [...new Set(players.map(p => p.parent_id).filter(Boolean) as string[])]
  const contactByParent = parentIdsForContact.length > 0
    ? await loadLastContactedMap(supabase, parentIdsForContact).catch(() => new Map())
    : new Map()
  const noContact30dByPlayer = new Map<string, boolean>()
  for (const p of players) {
    if (!p.parent_id) continue
    const sig = contactByParent.get(p.parent_id) || null
    const bucket = contactBucket(sig)
    // Only flag stale OR never — recent contacts get no badge.
    if (bucket === 'stale_30plus' || bucket === 'never') {
      noContact30dByPlayer.set(p.id, true)
    }
  }

  // ── 4b. Phase 2.4 — trial follow-up cohort, scoped to playerId only ──
  // Booking-source rows have no FK to a player; they continue to surface
  // on the Enrolments + Trials pages but NEVER produce a player-row badge
  // here. Same loader as Enrolments / Parents pages — no duplication.
  const followUpRows = await loadTrialFollowUpRows(supabase, orgId).catch(() => [])
  const followUpStageByPlayerId = new Map<string, TrialStage>()
  for (const f of followUpRows) {
    if (!f.playerId) continue
    const prev = followUpStageByPlayerId.get(f.playerId)
    followUpStageByPlayerId.set(
      f.playerId,
      prev ? pickMoreUrgentStage(prev, f.stage) : f.stage,
    )
  }

  // ── 5. Reduce to flat row contract for the client table ──
  const tableRows: PlayersTableRow[] = players.map(p => {
    const subs = subsByPlayer.get(p.id) || null
    const att = attendanceSummary.get(p.id)

    // Phase 2.8 — pick the most recent active enrolment to feed the
    // attendance-risk derive. We deliberately use 'active' only — paused/
    // cancelled enrolments degrade to riskLevel='not_applicable' by the
    // derive layer's contract. Multiple active enrolments → use the
    // earliest enrolled_at so we count tenure from when the family first
    // committed to the academy.
    const activeEnrolments = (p.enrolments || []).filter(e => (e.status || '') === 'active')
    const earliestActiveEnrolledAt = activeEnrolments
      .map(e => e.enrolled_at)
      .filter((v): v is string => !!v)
      .sort()[0] || null
    const attendanceRisk: AttendanceRiskAssessment = deriveAttendanceRisk({
      attendanceHistory: attendanceByPlayer.get(p.id) || [],
      enrolmentStatus: activeEnrolments.length > 0 ? 'active' : (p.enrolments?.[0]?.status || null),
      enrolledAt: earliestActiveEnrolledAt,
    })

    return {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      photo_url: p.photo_url,
      playing_level: p.playing_level,
      parent_id: p.parent_id,
      parent_name: p.parent?.full_name || null,
      parent_email: p.parent?.email || null,
      age: deriveAge(p.date_of_birth),
      className: deriveActiveClassNames(p.enrolments),
      attendancePct: att?.pct ?? null,
      lastAttendanceDays: att ? daysSinceIso(att.lastDateIso) : null,
      subStatus: deriveSubStatus(subs),
      rowStatus: deriveRowStatus(p.enrolments),
      reviewDue: deriveReviewDue(latestReviewByPlayer.get(p.id) || null),
      joinedAt: p.created_at,
      // null when this player is not in the follow-up cohort.
      trialFollowUpStage: followUpStageByPlayerId.get(p.id) ?? null,
      // Phase 2.5 — true when the player's parent has not been contacted
      // in 30+ days OR has never been contacted. False/undefined otherwise.
      noContact30dPlus: noContact30dByPlayer.get(p.id) ?? false,
      // Phase 2.8 — server-computed attendance risk assessment. UI consumes
      // the fields directly; no client-side derivation.
      attendanceRisk,
      // Sprint 7 — archive metadata. archivedAt drives the [ARCHIVED]
      // badge + archived filter chip + Restore action. Null = active.
      archivedAt: p.archived_at,
      archiveReason: p.archive_reason,
    }
  })

  // ── 6. Insights bar totals (org-wide, NOT filtered by current view) ──
  const counts = {
    active:         tableRows.filter(r => r.rowStatus === 'active').length,
    pendingStarts:  tableRows.filter(r => r.rowStatus === 'pending').length,
    trials:         tableRows.filter(r => r.rowStatus === 'trial').length,
    paymentIssues:  tableRows.filter(r => r.subStatus === 'past_due').length,
  }

  // ── 7. QuickAdd reference data — parents + groups, org-scoped ──
  // (Same shape the existing QuickAddPlayer component expects.)
  const [{ data: parents }, { data: groups }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organisation_id', orgId)
      .eq('role', 'parent')
      .order('full_name'),
    supabase
      .from('training_groups')
      .select('id, name')
      .eq('organisation_id', orgId)
      .order('name'),
  ])

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Players</h1>

        <div className="flex items-center gap-3">
          <QuickAddPlayer
            parents={parents || []}
            groups={groups || []}
            autoOpen={params.add === '1'}
            orgId={orgId}
          />
          <ImportPlayersModal />
          <ExportCSV />
        </div>

        <PlayersInsightsBar counts={counts} />

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent" />

        {tableRows.length === 0 ? (
          <EmptyState message="No players registered yet. Add one above." />
        ) : (
          <PlayersTable rows={tableRows} />
        )}
      </div>
    </div>
  )
}
