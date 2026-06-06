import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import ScoreBadge from '@/components/ScoreBadge'
import StatusBadge from '@/components/StatusBadge'
import { SCORE_CATEGORIES } from '@/lib/types'
import { normalizeCategories, type ScoringCategory } from '@/lib/scoring-categories'
import PlayerProfileEditor from './PlayerProfileEditor'
import QuickLinkCanva from './QuickLinkCanva'
import PlayerAvatar from '@/components/PlayerAvatar'
import PhotoUpload from '@/components/PhotoUpload'
import RadarChart from '@/components/RadarChart'
import PlayerTimeline from '@/components/PlayerTimeline'
import type { TimelineItem } from '@/components/PlayerTimeline'
import AttendanceStreak from '@/components/AttendanceStreak'
import PlayerLevelEditor from './PlayerLevelEditor'
// Sprint 7 — Archive replaces destructive Delete. DeletePlayerButton was
// removed this sprint (it cascaded through 9 FK'd tables wiping attendance,
// progress, awards, camps, makeup, waitlist, documents, etc).
import ArchivePlayerModal from './ArchivePlayerModal'
import RestorePlayerButton from './RestorePlayerButton'
import AddToGroupButton from './AddToGroupButton'
// Sprint 8b v1 — Move Class action surfaced per active enrolment row.
import MoveClassAction from './MoveClassAction'
// Sprint 12 — pure derive layer (no I/O, no Stripe call).
// Sprint 12b — adds aggregateExposure + deriveTrialFirstChargeLabel.
import {
  deriveSubscriptionDisplay,
  deriveNextPaymentLabel,
  deriveEnrolmentDisplay,
  aggregateExposure,
  deriveTrialFirstChargeLabel,
  fmtMoney,
  fmtInterval,
  type Tone,
} from '@/lib/subscription-derive'

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'parent'
  const orgId = profile?.organisation_id || ''

  // Fetch custom scoring categories for this org
  const { data: dbScoringCategories } = await supabase
    .from('scoring_categories')
    .select('*')
    .eq('organisation_id', orgId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  const scoringCategories = normalizeCategories(dbScoringCategories as ScoringCategory[] | null)

  // Fetch player with parent info
  const { data: player } = await supabase
    .from('players')
    .select('*, parent:profiles!players_parent_id_fkey(full_name, email, phone, address, secondary_contact_name, secondary_contact_phone)')
    .eq('id', id)
    .single()

  if (!player) redirect('/dashboard/players')

  // If parent, ensure they own this player
  if (role === 'parent' && player.parent_id !== user.id) {
    redirect('/dashboard/children')
  }

  // Fetch reviews
  const { data: reviews } = await supabase
    .from('progress_reviews')
    .select('*, coach:profiles!progress_reviews_coach_id_fkey(full_name)')
    .eq('player_id', id)
    .order('review_date', { ascending: false })
    .limit(5)

  // Fetch attendance
  const { data: attendance } = await supabase
    .from('attendance')
    .select('id, present, session_date, group:training_groups(name)')
    .eq('player_id', id)
    .order('session_date', { ascending: false })
    .limit(20)

  const totalSessions = (attendance || []).length
  const presentCount = (attendance || []).filter((a) => a.present).length
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0

  // Sprint 12 — extended enrolments SELECT.
  //
  // Adds the columns the player profile needs to answer "what class is
  // this player in, when did they join, is it a trial" within 5 seconds
  // of opening the page:
  //   • enrolled_at, activates_on, is_trial, trial_expires_at
  //   • embedded coach name via training_groups.coach_id → profiles
  //
  // All read-only. RLS unchanged (existing org-scoped policies cover
  // both `enrolments` and `training_groups`).
  const { data: enrolments } = await supabase
    .from('enrolments')
    .select(`
      id, status, group_id,
      enrolled_at, activates_on, is_trial, trial_expires_at,
      group:training_groups(
        name, day_of_week, time_slot, location,
        coach:profiles!training_groups_coach_id_fkey(full_name)
      )
    `)
    .eq('player_id', id)

  // Sprint 12 — Membership card subscription SELECT.
  //
  // Read-only. Pulls every subscription row for this player so the
  // page can show ALL active-ish subs (the prod audit found cases of
  // duplicate subs — we surface that rather than hide it). Explicit
  // org filter for defence-in-depth even though RLS already enforces
  // org scoping on `subscriptions` (077 lockdown).
  const { data: playerSubscriptions } = await supabase
    .from('subscriptions')
    .select(`
      id, status, stripe_subscription_id, plan_id, training_group_id,
      current_period_start, current_period_end,
      cancel_at_period_end, cancelled_at, start_date, created_at,
      plan:subscription_plans(name, amount, interval, sessions_per_month, class_type),
      group:training_groups(name)
    `)
    .eq('player_id', id)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  // Fetch documents
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('player_id', id)
    .order('created_at', { ascending: false })

  // Fetch achievements
  const { data: achievements } = await supabase
    .from('player_achievements')
    .select('id, awarded_at, achievement:achievements(name, emoji, description)')
    .eq('player_id', id)
    .order('awarded_at', { ascending: false })
    .limit(10)

  // Fetch session notes that mention this player
  const { data: sessionNotes } = await supabase
    .from('session_notes')
    .select('id, session_date, title, notes, players_of_note, group:training_groups(name)')
    .ilike('players_of_note', '%' + player.first_name + '%')
    .order('session_date', { ascending: false })
    .limit(10)

  const parent = player.parent as unknown as {
    full_name: string
    email: string
    phone: string | null
    address: string | null
    secondary_contact_name: string | null
    secondary_contact_phone: string | null
  }

  const isStaff = role === 'admin' || role === 'coach'

  // Fetch training groups for add-to-group (staff only)
  const { data: trainingGroups } = isStaff
    ? await supabase
        .from('training_groups')
        .select('id, name, day_of_week, time_slot')
        .eq('organisation_id', orgId)
        .order('name')
    : { data: null }

  // Calculate attendance streaks
  const sortedAttendance = [...(attendance || [])].sort(
    (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  )

  let currentStreak = 0
  for (const a of sortedAttendance) {
    if (a.present) currentStreak++
    else break
  }

  let bestStreak = 0
  let tempStreak = 0
  for (const a of sortedAttendance) {
    if (a.present) {
      tempStreak++
      if (tempStreak > bestStreak) bestStreak = tempStreak
    } else {
      tempStreak = 0
    }
  }

  // Build radar chart scores from latest review using custom categories.
  // Per-class-type scoring: filter to categories the player has actually been scored on,
  // otherwise Soccer Tots players show empty bars for "Tactical IQ" etc.
  const latestReview = (reviews || [])[0]
  const latestJsonScores = latestReview ? (latestReview as Record<string, unknown>).scores as Record<string, number> | null : null
  const LEGACY_KEYS = ['attitude', 'effort', 'technical_quality', 'game_understanding', 'confidence', 'physical_movement']
  const playerScoredKeys = new Set<string>()
  for (const review of reviews || []) {
    const r = review as Record<string, unknown>
    const rs = r.scores as Record<string, number> | null | undefined
    if (rs) Object.keys(rs).forEach((k) => playerScoredKeys.add(k))
    for (const k of LEGACY_KEYS) {
      if (r[k] != null) playerScoredKeys.add(k)
    }
  }
  const filteredCategoriesForPlayer = scoringCategories.filter((c) => playerScoredKeys.has(c.key))
  const displayCategories = filteredCategoriesForPlayer.length > 0 ? filteredCategoriesForPlayer : scoringCategories
  const radarScores = latestReview
    ? displayCategories.map((cat) => ({
        label: cat.label,
        value: (latestJsonScores?.[cat.key] ?? (latestReview[cat.key as keyof typeof latestReview] as number)) || 0,
      }))
    : []

  // Build timeline items
  const timelineItems: TimelineItem[] = []

  // Add reviews to timeline
  for (const r of reviews || []) {
    timelineItems.push({
      type: 'review',
      date: r.review_date,
      title: `Progress Review by ${(r.coach as unknown as { full_name: string })?.full_name || 'Coach'}`,
      subtitle: r.strengths ? `Strengths: ${r.strengths}` : undefined,
      icon: '\u{1F4CB}',
      color: 'rgba(78, 205, 230, 0.3)',
    })
  }

  // Add absences to timeline (absences only, to keep it interesting)
  for (const a of attendance || []) {
    if (!a.present) {
      timelineItems.push({
        type: 'attendance',
        date: a.session_date,
        title: `Missed session`,
        subtitle: (a.group as unknown as { name: string })?.name || undefined,
        icon: '\u{274C}',
        color: 'rgba(239, 68, 68, 0.2)',
      })
    }
  }

  // Add achievements to timeline
  for (const ach of achievements || []) {
    const achievement = ach.achievement as unknown as { name: string; emoji: string; description: string } | null
    if (achievement) {
      timelineItems.push({
        type: 'achievement',
        date: ach.awarded_at,
        title: `${achievement.emoji} ${achievement.name}`,
        subtitle: achievement.description || undefined,
        icon: '\u{1F3C6}',
        color: 'rgba(245, 158, 11, 0.3)',
      })
    }
  }

  // Add session notes to timeline
  for (const note of sessionNotes || []) {
    timelineItems.push({
      type: 'note',
      date: note.session_date,
      title: note.title || 'Session Note',
      subtitle: (note.group as unknown as { name: string })?.name
        ? `${(note.group as unknown as { name: string }).name} — mentioned in coach notes`
        : 'Mentioned in coach notes',
      icon: '\u{1F4DD}',
      color: 'rgba(99, 102, 241, 0.2)',
    })
  }

  // Sort timeline by date desc
  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-6">
      {/* ═══ CINEMATIC HEADER ═══ */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#0e1518] via-[#0a0a0a] to-[#0a0a0a] p-6 sm:p-8">
        {/* Ambient brand glow */}
        <div className="absolute -top-24 -right-20 w-[400px] h-[400px] rounded-full blur-[120px] opacity-20 pointer-events-none bg-[#4ecde6]" />
        <div className="absolute -bottom-24 -left-20 w-[300px] h-[300px] rounded-full blur-[120px] opacity-10 pointer-events-none bg-purple-500" />
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <Link href={isStaff ? '/dashboard/players' : '/dashboard/children'} className="relative inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors mb-5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to {isStaff ? 'players' : 'children'}
        </Link>

        <div className="relative flex items-start gap-4 sm:gap-5">
        <div className="flex-shrink-0">
          <div className="relative">
            {/* Glow ring around avatar */}
            <div className="absolute inset-0 rounded-full blur-md opacity-50 bg-gradient-to-br from-[#4ecde6] to-purple-500" />
            <div className="relative">
              {isStaff ? (
                <PhotoUpload
                  playerId={player.id}
                  currentPhotoUrl={player.photo_url}
                  firstName={player.first_name}
                  lastName={player.last_name}
                  size="xl"
                />
              ) : (
                <PlayerAvatar
                  photoUrl={player.photo_url}
                  firstName={player.first_name}
                  lastName={player.last_name}
                  size="xl"
                />
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-1">{player.first_name} {player.last_name}</h1>
          <div className="flex flex-wrap gap-2 mt-1">
            {isStaff ? (
              <PlayerLevelEditor
                playerId={player.id}
                playingLevel={player.playing_level}
                leagueLevel={player.league_level}
              />
            ) : (
              <>
                {player.playing_level && (() => {
                  const levelColors: Record<string, string> = { beginner: 'bg-green-500/15 text-green-400', development: 'bg-blue-500/15 text-blue-400', intermediate: 'bg-amber-500/15 text-amber-400', advanced: 'bg-purple-500/15 text-purple-400', elite: 'bg-red-500/15 text-red-400' }
                  const levelLabels: Record<string, string> = { beginner: 'Beginner', development: 'Development', intermediate: 'Intermediate', advanced: 'Advanced', elite: 'Elite' }
                  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelColors[player.playing_level] || 'bg-white/10 text-white'}`}>{levelLabels[player.playing_level] || player.playing_level}</span>
                })()}
                {player.league_level && (() => {
                  const leagueColors: Record<string, string> = { recreational: 'bg-gray-500/15 text-gray-400', grassroots: 'bg-lime-500/15 text-lime-400', b_league: 'bg-sky-500/15 text-sky-400', a_league: 'bg-orange-500/15 text-orange-400', academy: 'bg-violet-500/15 text-violet-400', professional: 'bg-rose-500/15 text-rose-400' }
                  const leagueLabels: Record<string, string> = { recreational: 'Recreational', grassroots: 'Grassroots', b_league: 'B League', a_league: 'A League', academy: 'Academy', professional: 'Pro Development' }
                  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${leagueColors[player.league_level] || 'bg-white/10 text-white'}`}>{leagueLabels[player.league_level] || player.league_level}</span>
                })()}
              </>
            )}
            {player.age_group && <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white font-medium">{player.age_group}</span>}
            {player.position && <span className="px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent font-medium">{player.position}</span>}
            {player.kit_size && <span className="px-2 py-0.5 rounded-full text-xs bg-white/[0.05] text-white/60 font-medium">Kit: {player.kit_size}</span>}
          </div>
        </div>
        <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
          <div>
            <div className="text-3xl font-bold text-accent">{attendanceRate}%</div>
            <div className="text-xs text-white/60">Attendance</div>
          </div>
          <Link
            href={`/dashboard/players/${id}/passport`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
          >
            <span>{'\u{1F3AE}'}</span> Passport
          </Link>
          <Link
            href={`/dashboard/players/${id}/report`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            <span>{'\u{1F4C4}'}</span> Progress Report
          </Link>
          <Link
            href={`/dashboard/players/${id}/report/print`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Download PDF
          </Link>
          <Link
            href={`/dashboard/players/${id}/highlights`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-500/15 to-pink-500/15 text-purple-400 hover:from-purple-500/25 hover:to-pink-500/25 transition-colors border border-purple-500/10"
          >
            <span>{'\u{2728}'}</span> Monthly Highlights
          </Link>
        </div>
        </div>
      </div>

      {/* Radar Chart + Attendance Streak */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {radarScores.length > 0 ? (
          <Card title="Skills Overview">
            <RadarChart scores={radarScores} />
            <p className="text-xs text-white/60 text-center mt-2">
              Based on latest review ({new Date(latestReview.review_date).toLocaleDateString()})
            </p>
          </Card>
        ) : (
          <Card>
            <div className="text-center py-8">
              <div className="text-4xl mb-2">{'\u{26BD}'}</div>
              <p className="text-sm text-white/60">No reviews yet</p>
              <p className="text-xs text-white/60 mt-1">Skills chart will appear after the first progress review</p>
            </div>
          </Card>
        )}
        <AttendanceStreak
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          rate={attendanceRate}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Player Info */}
        <Card title="Player Information">
          {isStaff ? (
            <PlayerProfileEditor player={player} />
          ) : (
            <div className="space-y-2 text-sm">
              {player.date_of_birth && <p><span className="text-white/60">DOB:</span> {new Date(player.date_of_birth).toLocaleDateString()}</p>}
              {player.position && <p><span className="text-white/60">Position:</span> {player.position}</p>}
              {player.school && <p><span className="text-white/60">School:</span> {player.school}</p>}
              {player.kit_size && <p><span className="text-white/60">Kit Size:</span> {player.kit_size}</p>}
              {player.notes && <p><span className="text-white/60">Notes:</span> {player.notes}</p>}
            </div>
          )}
        </Card>

        {/* Parent / Emergency Contact */}
        <Card title="Contact Details">
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{parent?.full_name}</p>
              <p className="text-white/60">{parent?.email}</p>
              {parent?.phone && <p className="text-white/60">{parent.phone}</p>}
              {parent?.address && <p className="text-white/60">{parent.address}</p>}
            </div>
            {(player.emergency_contact_name || parent?.secondary_contact_name) && (
              <div className="pt-2 border-t border-white/[0.08]">
                <p className="text-xs text-white/60 font-medium mb-1">Emergency / Secondary Contact</p>
                {player.emergency_contact_name && (
                  <p>{player.emergency_contact_name} {player.emergency_contact_phone && `— ${player.emergency_contact_phone}`}</p>
                )}
                {parent?.secondary_contact_name && (
                  <p>{parent.secondary_contact_name} {parent?.secondary_contact_phone && `— ${parent.secondary_contact_phone}`}</p>
                )}
              </div>
            )}
            {player.medical_info && (
              <div className="pt-2 border-t border-white/[0.08]">
                <p className="text-xs text-white/60 font-medium mb-1">Medical Info</p>
                <p className="text-danger">{player.medical_info}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ─── Sprint 12: Membership card ────────────────────────────────
          Read-only display of all subscription rows attached to this
          player. Surfaces:
            • subscription status (Active / Trialing / Past due / etc.)
            • plan name + amount + billing interval
            • next charge date (derived from current_period_end)
            • cancellation status (cancel_at_period_end → "cancelling X")
          Empty state matches the user-approved copy.
       ──────────────────────────────────────────────────────────────── */}
      {(() => {
        type SubRow = {
          id: string
          status: string | null
          stripe_subscription_id: string | null
          plan_id: string | null
          training_group_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean | null
          cancelled_at: string | null
          start_date: string | null
          created_at: string | null
          plan: {
            name: string | null
            amount: number | null
            interval: string | null
            sessions_per_month: number | null
            class_type: string | null
          } | null
          group: { name: string | null } | null
        }
        const subs = ((playerSubscriptions || []) as unknown as SubRow[])
        const subsToRender = subs

        // Sprint 12b: aggregate monthly exposure across all contributing
        // subs (skips cancelled + cancel_at_period_end). Renders above
        // the row list when N > 1.
        const aggregate = aggregateExposure(subsToRender.map((s) => ({
          status: s.status,
          cancel_at_period_end: s.cancel_at_period_end,
          current_period_end: s.current_period_end,
          plan: s.plan ? { amount: s.plan.amount, interval: s.plan.interval } : null,
        })))
        const showAggregate = subsToRender.length > 1 && aggregate.contributingCount > 0
        const aggregateNextDateLabel = aggregate.nextBillingDate
          ? new Date(aggregate.nextBillingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : ''

        return (
          <Card title="Membership">
            {subsToRender.length === 0 ? (
              <p className="text-sm text-white/55 py-2" data-testid="player-membership-empty">
                No active subscription found.
              </p>
            ) : (
              <div className="space-y-3" data-testid="player-membership-list">
                {/* Sprint 12b — aggregate warning panel.
                    Visible only when N > 1 contributing subs exist.
                    Wording matches the approved spec exactly:
                      "⚠ Multiple subscriptions detected. Total monthly
                       exposure: £X / month across N subscriptions.
                       Next billing date: <date>."
                    The trailing "Next billing date" clause is omitted
                    when no shared next billing date is available. */}
                {showAggregate && (
                  <div
                    className="rounded-xl border border-amber-500/40 bg-amber-500/[0.08] p-3"
                    data-testid="player-membership-aggregate"
                  >
                    <p className="text-sm font-bold text-amber-200" data-testid="player-membership-aggregate-text">
                      ⚠ Multiple subscriptions detected. Total monthly exposure:{' '}
                      <span data-testid="player-membership-aggregate-total">
                        {fmtMoney(aggregate.totalMonthly)} / month
                      </span>{' '}
                      across {aggregate.contributingCount} subscription{aggregate.contributingCount === 1 ? '' : 's'}.
                      {aggregateNextDateLabel && (
                        <> Next billing date:{' '}
                          <span data-testid="player-membership-aggregate-next-date">
                            {aggregateNextDateLabel}
                          </span>.
                        </>
                      )}
                    </p>
                  </div>
                )}

                {subsToRender.map((s) => {
                  const d = deriveSubscriptionDisplay({
                    status: s.status,
                    cancel_at_period_end: s.cancel_at_period_end,
                    cancelled_at: s.cancelled_at,
                    current_period_end: s.current_period_end,
                    start_date: s.start_date,
                  })
                  const nextPayment = deriveNextPaymentLabel({
                    status: s.status,
                    cancel_at_period_end: s.cancel_at_period_end,
                    cancelled_at: s.cancelled_at,
                    current_period_end: s.current_period_end,
                    start_date: s.start_date,
                  })
                  // Sprint 12b — combined trial-first-charge sentence.
                  // When this returns a non-empty string we render it INSTEAD OF
                  // the "trial ends X" detail line and the separate "Next charge"
                  // row, so the trial-end date and the first-ever-charge fact
                  // are presented as one causal statement.
                  const trialFirstCharge = deriveTrialFirstChargeLabel({
                    status: s.status,
                    current_period_end: s.current_period_end,
                    amount: s.plan?.amount,
                  })
                  const isTrialing = !!trialFirstCharge
                  const planName = s.plan?.name || (s.plan ? 'Unnamed plan' : 'Plan unavailable')
                  const amount = s.plan?.amount
                  const intervalLabel = fmtInterval(s.plan?.interval, s.plan?.sessions_per_month)
                  const moneyLabel = amount != null ? fmtMoney(Number(amount)) : ''
                  const startedLabel = s.start_date
                    ? new Date(s.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : s.created_at
                      ? new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : ''

                  return (
                    <div
                      key={s.id}
                      data-testid="player-membership-row"
                      data-subscription-id={s.id}
                      data-subscription-status={s.status || ''}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2"
                    >
                      {/* Headline: status badge + plan + amount */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <TonedPill label={d.label} tone={d.tone} testId="player-membership-status" />
                            <span className="text-sm font-bold text-white" data-testid="player-membership-plan">{planName}</span>
                          </div>
                          {/* Status detail — suppressed for trialing subs in
                              favour of the combined trial-first-charge line
                              rendered below. */}
                          {!isTrialing && d.detail && (
                            <p className="text-[11px] text-white/55 mt-0.5" data-testid="player-membership-status-detail">{d.detail}</p>
                          )}
                        </div>
                        {moneyLabel && (
                          <div className="text-right shrink-0">
                            <span className="text-base font-bold text-white" data-testid="player-membership-amount">
                              {moneyLabel}
                            </span>
                            <span className="text-[11px] text-white/55 ml-1">{intervalLabel}</span>
                          </div>
                        )}
                      </div>

                      {/* Sprint 12b — combined trial-first-charge sentence for
                          trialing subs only. Renders INSTEAD OF the disconnected
                          "trial ends X" + "Next charge: X" pair. */}
                      {isTrialing && (
                        <p
                          className="text-[12px] text-amber-200 bg-amber-500/[0.08] border border-amber-500/25 rounded-lg px-3 py-2"
                          data-testid="player-membership-trial-first-charge"
                        >
                          {trialFirstCharge}
                        </p>
                      )}

                      {/* Meta rows. For non-trialing subs we surface "Next charge"
                          here. For trialing subs the combined sentence above
                          already covers the date, so we skip it. */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-white/60">
                        {startedLabel && (
                          <div>
                            <span className="text-white/40">Started:</span>{' '}
                            <span className="text-white/85" data-testid="player-membership-started">{startedLabel}</span>
                          </div>
                        )}
                        {!isTrialing && nextPayment && (
                          <div>
                            <span className="text-white/40">Next charge:</span>{' '}
                            <span className="text-emerald-300" data-testid="player-membership-next-payment">{nextPayment}</span>
                          </div>
                        )}
                        {s.group?.name && (
                          <div>
                            <span className="text-white/40">For class:</span>{' '}
                            <span className="text-white/85">{s.group.name}</span>
                          </div>
                        )}
                        {s.plan?.class_type && (
                          <div>
                            <span className="text-white/40">Class type:</span>{' '}
                            <span className="text-white/85">{s.plan.class_type}</span>
                          </div>
                        )}
                      </div>

                      {/* Admin-only Stripe sub id (faded). Coaches don't see it. */}
                      {role === 'admin' && s.stripe_subscription_id && (
                        <p
                          className="text-[10px] text-white/30 font-mono pt-1 border-t border-white/[0.06] truncate"
                          data-testid="player-membership-stripe-id"
                          title={s.stripe_subscription_id}
                        >
                          {s.stripe_subscription_id}
                        </p>
                      )}
                    </div>
                  )
                })}
                {/* Sprint 12b — the pre-existing italic "Multiple subscriptions
                    found" footer is REPLACED by the aggregate panel above.
                    Footer no longer rendered to avoid duplicate signal. */}
              </div>
            )}
          </Card>
        )
      })()}

      {/* ─── Sprint 12: Classes card (was: "Sessions") ──────────────────
          Per enrolment, surfaces coach + day/time/location + enrolled
          date + activates_on (for Stage 3 future-start) + trial expiry
          (when is_trial). Status badge is the enrolment status, NEVER
          the subscription status — kept strictly separate per sprint
          spec.
       ──────────────────────────────────────────────────────────────── */}
      <Card title="Classes" action={isStaff ? (
        <AddToGroupButton
          playerId={id}
          groups={(trainingGroups || []).map((g) => ({ id: g.id, name: g.name, day_of_week: g.day_of_week, time_slot: g.time_slot }))}
          existingGroupIds={(enrolments || []).map((e) => (e as unknown as { group_id: string }).group_id).filter(Boolean)}
        />
      ) : undefined}>
        {(() => {
          type EnrRow = {
            id: string
            status: string
            is_trial: boolean | null
            enrolled_at: string | null
            activates_on: string | null
            trial_expires_at: string | null
            group: {
              name: string
              day_of_week: string | null
              time_slot: string | null
              location: string | null
              coach: { full_name: string | null } | null
            } | null
          }
          const enrs = ((enrolments || []) as unknown as EnrRow[])
          // Active-ish enrolments shown first; cancelled muted below.
          const activeIsh = enrs.filter((e) => e.status !== 'cancelled' && e.status !== 'inactive')
          const ended = enrs.filter((e) => e.status === 'cancelled' || e.status === 'inactive')
          const hasAny = enrs.length > 0
          const hasActive = activeIsh.length > 0

          // Sprint 12b — when any subscription on this player is in
          // 'trialing' status, the Classes card relabels each genuinely
          // active (non-trial) enrolment to "Class active · membership
          // trialing" so the page's Active enrolment pill and Trialing
          // membership pill no longer read as conflicting.
          const trialingMembership = ((playerSubscriptions || []) as unknown as Array<{ status: string | null }>)
            .some((s) => (s.status || '').toLowerCase() === 'trialing')

          if (!hasAny) {
            return (
              <p className="text-sm text-white/55 py-2" data-testid="player-classes-empty">
                No active class enrolment found.
              </p>
            )
          }

          return (
            <div className="space-y-3" data-testid="player-classes-list">
              {hasActive
                ? activeIsh.map((e) => {
                    // Sprint 8b v1 — staff get a "Move class" action on
                    // each active/pending row. Parents don't.
                    const eAny = e as unknown as { group_id: string }
                    const moveAction = isStaff && eAny.group_id ? (
                      <MoveClassAction
                        enrolmentId={e.id}
                        sourceGroupId={eAny.group_id}
                        sourceGroupName={e.group?.name || 'this class'}
                        playerId={id}
                        playerFirstName={player.first_name}
                        playerLastName={player.last_name}
                        organisationId={orgId}
                      />
                    ) : undefined
                    return (
                      <ClassRow
                        key={e.id}
                        enr={e}
                        trialingMembership={trialingMembership}
                        action={moveAction}
                      />
                    )
                  })
                : (
                  <p className="text-sm text-white/55 py-2" data-testid="player-classes-empty">
                    No active class enrolment found.
                  </p>
                )}
              {ended.length > 0 && (
                <details className="pt-2 border-t border-white/[0.06]">
                  <summary className="text-[11px] text-white/45 cursor-pointer hover:text-white/65 transition-colors">
                    {ended.length} cancelled enrolment{ended.length === 1 ? '' : 's'}
                  </summary>
                  <div className="mt-2 space-y-2 opacity-70">
                    {ended.map((e) => <ClassRow key={e.id} enr={e} />)}
                  </div>
                </details>
              )}
            </div>
          )
        })()}
      </Card>

      {/* Achievements */}
      {(achievements || []).length > 0 && (
        <Card title="Achievements">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(achievements || []).map((ach) => {
              const achievement = ach.achievement as unknown as { name: string; emoji: string; description: string } | null
              if (!achievement) return null
              return (
                <div
                  key={ach.id}
                  className="flex flex-col items-center text-center p-3 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:border-accent/30 transition-colors"
                >
                  <span className="text-3xl mb-1">{achievement.emoji}</span>
                  <span className="text-xs font-medium text-text">{achievement.name}</span>
                  <span className="text-[10px] text-white/60 mt-0.5">
                    {new Date(ach.awarded_at).toLocaleDateString()}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Progress Reviews */}
      {(reviews || []).length > 0 && (
        <Card title="Progress Reviews" action={<Link href="/dashboard/feedback" className="text-sm text-primary hover:underline">View all</Link>}>
          <div className="space-y-4">
            {(reviews || []).map((r) => (
              <div key={r.id} className="border-b border-white/[0.08] pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/60">
                    {new Date(r.review_date).toLocaleDateString()}
                    {' · '}{(r.coach as unknown as { full_name: string })?.full_name}
                  </span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-2">
                  {displayCategories.map((cat) => {
                    const jsonScores = (r as Record<string, unknown>).scores as Record<string, number> | null
                    const score = jsonScores?.[cat.key] ?? (r as Record<string, unknown>)[cat.key] as number
                    if (score == null) return null
                    return (
                      <div key={cat.key} className="flex flex-col items-center gap-0.5">
                        <ScoreBadge score={score} />
                        <span className="text-[10px] text-white/60">{cat.label}</span>
                      </div>
                    )
                  })}
                </div>
                {r.strengths && <p className="text-sm"><span className="text-accent font-medium">Strengths:</span> {r.strengths}</p>}
                {r.focus_next && <p className="text-sm"><span className="text-warning font-medium">Focus:</span> {r.focus_next}</p>}
                {r.parent_summary && <p className="text-sm bg-white/[0.05] rounded-lg p-3 mt-2">{r.parent_summary}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Activity Timeline */}
      {timelineItems.length > 0 && (
        <Card title="Activity Timeline">
          <PlayerTimeline items={timelineItems} />
        </Card>
      )}

      {/* Canva Documents — featured with embeds */}
      {(() => {
        const canvaDocs = (documents || []).filter((d) => d.doc_type === 'canva')
        const otherDocs = (documents || []).filter((d) => d.doc_type !== 'canva')

        // Convert Canva URL to embed URL
        function getCanvaEmbedUrl(url: string): string | null {
          // Canva share URLs: https://www.canva.com/design/XXXXX/YYYYY/view
          // Embed: add ?embed at the end
          if (url.includes('canva.com/design/')) {
            const cleanUrl = url.split('?')[0]
            return `${cleanUrl}?embed`
          }
          return null
        }

        return (
          <>
            {/* Canva docs with embeds */}
            {canvaDocs.length > 0 && (
              <Card title="Canva Player Notes" action={isStaff ? <Link href={`/dashboard/documents?player=${id}`} className="text-sm text-primary hover:underline">Manage</Link> : undefined}>
                <div className="space-y-4">
                  {canvaDocs.map((d) => {
                    const embedUrl = getCanvaEmbedUrl(d.url as string)
                    return (
                      <div key={d.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <a href={d.url as string} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-purple-400 hover:underline flex items-center gap-1.5">
                            <span>🎨</span> {d.title}
                          </a>
                          <span className="text-xs text-white/60">{new Date(d.created_at).toLocaleDateString()}</span>
                        </div>
                        {embedUrl && (
                          <div className="rounded-lg overflow-hidden border border-purple-500/20">
                            <iframe
                              src={embedUrl}
                              className="w-full"
                              style={{ height: '450px', border: 'none' }}
                              allowFullScreen
                              title={d.title as string}
                            />
                          </div>
                        )}
                        {!embedUrl && (
                          <a
                            href={d.url as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-purple-500/10 border border-purple-500/20 rounded-lg p-6 text-center hover:bg-purple-500/15 transition-colors"
                          >
                            <span className="text-3xl block mb-2">🎨</span>
                            <span className="text-sm font-medium text-purple-400">Open in Canva</span>
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Quick link Canva button (staff only) */}
            {isStaff && (
              <QuickLinkCanva playerId={id} parentId={player.parent_id as string} userId={user.id} orgId={orgId} />
            )}

            {/* Other documents */}
            {otherDocs.length > 0 && (
              <Card title="Documents" action={isStaff ? <Link href={`/dashboard/documents?player=${id}`} className="text-sm text-primary hover:underline">Manage</Link> : undefined}>
                <div className="divide-y divide-border">
                  {otherDocs.map((d) => {
                    const icons: Record<string, string> = { pdf: '📄', image: '🖼️', video: '🎥', link: '🔗' }
                    return (
                      <div key={d.id} className="py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{icons[d.doc_type as string] || '📁'}</span>
                          <div>
                            <a href={d.url as string} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                              {d.title}
                            </a>
                            {d.description && <p className="text-xs text-white/60">{d.description as string}</p>}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/[0.05] text-white/60">{d.folder as string}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </>
        )
      })()}

      {/* Recent Attendance */}
      {(attendance || []).length > 0 && (
        <Card title="Recent Attendance">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Group</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(attendance || []).map((a) => (
                  <tr key={a.id} className="border-b border-white/[0.08] last:border-0">
                    <td className="py-2">{new Date(a.session_date).toLocaleDateString()}</td>
                    <td className="py-2">{(a.group as unknown as { name: string })?.name || '—'}</td>
                    <td className="py-2">
                      <span className={`inline-block w-2 h-2 rounded-full mr-1 ${a.present ? 'bg-accent' : 'bg-danger'}`} />
                      {a.present ? 'Present' : 'Absent'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sprint 7 — Archive zone (Admin only). Replaces the destructive
          Delete Player flow with a reversible archive that preserves
          attendance, progress, awards, payments, and messaging history. */}
      {role === 'admin' && (
        (player as { archived_at?: string | null }).archived_at ? (
          <div className="border border-amber-500/30 rounded-xl p-5 bg-amber-500/[0.04]">
            <h3 className="text-sm font-semibold text-amber-300 mb-1">Archived player</h3>
            <p className="text-xs text-white/55 mb-4">
              Archived on {new Date((player as { archived_at: string }).archived_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              {(player as { archive_reason?: string | null }).archive_reason
                ? ` — ${String((player as { archive_reason: string }).archive_reason).replace(/_/g, ' ')}`
                : ''}.
              History is preserved. Restoring reactivates the player record only — re-enrol them manually after restore.
            </p>
            <RestorePlayerButton
              playerId={id}
              playerName={`${player.first_name} ${player.last_name}`}
            />
          </div>
        ) : (
          <div className="border border-amber-500/20 rounded-xl p-5 bg-amber-500/[0.03]">
            <h3 className="text-sm font-semibold text-amber-300 mb-1">Archive zone</h3>
            <p className="text-xs text-white/55 mb-4">
              Archive hides this player from daily operations. Attendance, reports, payments, awards, and messaging history are preserved. You can restore at any time.
            </p>
            <ArchivePlayerModal
              playerId={id}
              playerName={`${player.first_name} ${player.last_name}`}
              hasActiveSubscription={(playerSubscriptions || []).some(
                (s: { status?: string | null; stripe_subscription_id?: string | null }) =>
                  s.status === 'active' && !!s.stripe_subscription_id
              )}
            />
          </div>
        )
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────
 *  Sprint 12 helpers — kept inline so the page is one file.
 *  Pure presentational. No state, no I/O.
 * ────────────────────────────────────────────────────────────────────── */

function TonedPill({
  label,
  tone,
  testId,
}: {
  label: string
  tone: Tone
  testId?: string
}) {
  const cls = TONE_PILL[tone] || TONE_PILL.muted
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}
      data-testid={testId}
      data-tone={tone}
    >
      {label}
    </span>
  )
}

const TONE_PILL: Record<Tone, string> = {
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  amber:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
  red:     'bg-red-500/20 text-red-300 border-red-500/30',
  violet:  'bg-violet-500/20 text-violet-300 border-violet-500/30',
  muted:   'bg-white/10 text-white/60 border-white/15',
}

type EnrRowProps = {
  enr: {
    id: string
    status: string
    is_trial: boolean | null
    enrolled_at: string | null
    activates_on: string | null
    trial_expires_at: string | null
    group: {
      name: string
      day_of_week: string | null
      time_slot: string | null
      location: string | null
      coach: { full_name: string | null } | null
    } | null
  }
  /** Sprint 12b — set true when the player has any subscription in
   *  'trialing' status. When the enrolment itself is NOT a trial
   *  (is_trial = false) but the membership is, the pill label is
   *  upgraded from "Active" to the spec-approved
   *  "Class active · membership trialing" so the page no longer reads
   *  as a conflict between an active class and a trialing sub. */
  trialingMembership?: boolean
  /**
   * Sprint 8b v1 — optional action node rendered in the row footer.
   * Today's only caller passes the Move Class button when the row is
   * active and the viewer is staff.
   */
  action?: React.ReactNode
}

function ClassRow({ enr, trialingMembership, action }: EnrRowProps) {
  const baseDisplay = deriveEnrolmentDisplay({ status: enr.status, is_trial: enr.is_trial })
  // Sprint 12b — only relabel when the enrolment is genuinely active
  // (status='active', not a trial-flagged row) AND the player has a
  // trialing membership. The pill colour stays emerald — only the text
  // changes to "Class active · membership trialing" per spec.
  const showDuringTrial = !!trialingMembership && enr.status === 'active' && !enr.is_trial
  const d = showDuringTrial
    ? { label: 'Class active · membership trialing', tone: baseDisplay.tone }
    : baseDisplay
  const coachName = enr.group?.coach?.full_name || null
  const dateRows = [
    enr.enrolled_at
      ? { label: 'Enrolled', value: new Date(enr.enrolled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
      : null,
    enr.activates_on
      ? { label: 'Activates', value: new Date(enr.activates_on + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
      : null,
    enr.is_trial && enr.trial_expires_at
      ? { label: 'Trial expires', value: new Date(enr.trial_expires_at + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
      : null,
  ].filter((v): v is { label: string; value: string } => !!v)

  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-1.5"
      data-testid="player-class-row"
      data-enrolment-id={enr.id}
      data-enrolment-status={enr.status}
    >
      {/* Headline: name + day/time/location + status pill */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white truncate" data-testid="player-class-name">{enr.group?.name || '—'}</div>
          <div className="text-[11px] text-white/55 mt-0.5">
            {enr.group?.day_of_week && <span>{enr.group.day_of_week}</span>}
            {enr.group?.time_slot && <span> · {enr.group.time_slot}</span>}
            {enr.group?.location && <span> · {enr.group.location}</span>}
          </div>
        </div>
        <TonedPill label={d.label} tone={d.tone} testId="player-class-status" />
      </div>

      {/* Coach line */}
      {coachName && (
        <div className="text-[11px] text-white/55" data-testid="player-class-coach">
          <span className="text-white/40">Coach:</span> <span className="text-white/80">{coachName}</span>
        </div>
      )}

      {/* Dates */}
      {dateRows.length > 0 && (
        <div
          className="flex items-center gap-3 flex-wrap text-[11px] text-white/55 pt-0.5"
          data-testid="player-class-dates"
        >
          {dateRows.map((d) => (
            <span key={d.label}>
              <span className="text-white/40">{d.label}:</span> <span className="text-white/80">{d.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Sprint 8b v1 — optional row action (Move Class). Only the
          active enrolment rows get this from the caller. */}
      {action && (
        <div className="flex justify-end pt-1.5 border-t border-white/[0.04]">
          {action}
        </div>
      )}
    </div>
  )
}
