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
  const { data: playersRaw } = await supabase
    .from('players')
    .select(`
      id, first_name, last_name, photo_url, playing_level, parent_id,
      date_of_birth, created_at, organisation_id,
      parent:profiles!players_parent_id_fkey(full_name, email, phone),
      enrolments(status, is_trial, trial_expires_at, activates_on, group:training_groups(name))
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
    parent: { full_name: string | null; email: string | null; phone: string | null } | null
    enrolments: Array<{ status: string | null; is_trial: boolean | null; trial_expires_at: string | null; activates_on: string | null; group: { name: string } | null }> | null
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

  // ── 3. 30-day attendance window aggregated per player ──
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  let attendanceSummary = new Map<string, ReturnType<typeof summariseAttendance> extends Map<string, infer V> ? V : never>()
  if (playerIds.length > 0) {
    const { data: attRows } = await supabase
      .from('attendance')
      .select('player_id, session_date, present')
      .in('player_id', playerIds)
      .gte('session_date', thirtyDaysAgoIso)
    attendanceSummary = summariseAttendance((attRows || []) as AttendanceRow[])
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

  // ── 5. Reduce to flat row contract for the client table ──
  const tableRows: PlayersTableRow[] = players.map(p => {
    const subs = subsByPlayer.get(p.id) || null
    const att = attendanceSummary.get(p.id)
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
