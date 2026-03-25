import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import StatusBadge from '@/components/StatusBadge'
import ScoreBadge from '@/components/ScoreBadge'
import EmptyState from '@/components/EmptyState'
import type { UserRole } from '@/lib/types'
import { SCORE_CATEGORIES } from '@/lib/types'
import PlayerAvatar from '@/components/PlayerAvatar'
import StatCard from '@/components/StatCard'
import ReferralLink from './referrals/ReferralLink'
import UpsellBanner from '@/components/UpsellBanner'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, organisation_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const name = profile?.full_name?.split(' ')[0] || 'there'
  const orgId = profile?.organisation_id || ''

  if (role === 'parent') return <ParentDashboard userId={user.id} name={name} />
  if (role === 'coach') return <CoachDashboard userId={user.id} name={name} orgId={orgId} />
  return <AdminDashboard name={name} orgId={orgId} />
}

/* ─── PARENT DASHBOARD ─── */
async function ParentDashboard({ userId, name }: { userId: string; name: string }) {
  const supabase = await createClient()

  const { data: players } = await supabase
    .from('players')
    .select(`
      id, first_name, last_name, age_group, position, photo_url,
      enrolments(id, status, group:training_groups(name, day_of_week, time_slot, location))
    `)
    .eq('parent_id', userId)

  const playerIds = (players || []).map((p) => p.id)

  // Overdue payments count
  const { count: overdueCount } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', userId)
    .eq('status', 'overdue')

  // Unread messages count
  const { count: unreadCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false)

  // New reviews count (last 7 days)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const { count: newReviewCount } = await supabase
    .from('progress_reviews')
    .select('id', { count: 'exact', head: true })
    .in('player_id', playerIds.length > 0 ? playerIds : ['none'])
    .gte('review_date', weekAgo.toISOString().split('T')[0])

  // Upcoming unpaid payments (next 3)
  const { data: upcomingPayments } = await supabase
    .from('payments')
    .select('id, amount, amount_paid, status, description, due_date')
    .eq('parent_id', userId)
    .in('status', ['unpaid', 'overdue', 'partial'])
    .order('due_date', { ascending: true })
    .limit(3)

  // Latest messages (last 3)
  const { data: messages } = await supabase
    .from('messages')
    .select('id, subject, body, read, created_at, sender:profiles!messages_sender_id_fkey(full_name)')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(3)

  // Latest review per player for the children cards
  const { data: latestReviews } = await supabase
    .from('progress_reviews')
    .select('id, player_id, attitude, effort, technical_quality, game_understanding, confidence, physical_movement, review_date')
    .in('player_id', playerIds.length > 0 ? playerIds : ['none'])
    .order('review_date', { ascending: false })

  // This week's data
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Sunday
  const weekStartStr = weekStart.toISOString().split('T')[0]

  // Attendance this week
  const { data: weekAttendance } = await supabase
    .from('attendance')
    .select('id, present, session_date, player_id, group:training_groups(name)')
    .in('player_id', playerIds.length > 0 ? playerIds : ['none'])
    .gte('session_date', weekStartStr)
    .order('session_date', { ascending: false })

  // Reviews this week
  const { data: weekReviews } = await supabase
    .from('progress_reviews')
    .select('id, player_id, review_date, parent_summary, attitude, effort, technical_quality, game_understanding, confidence, physical_movement, coach:profiles!progress_reviews_coach_id_fkey(full_name)')
    .in('player_id', playerIds.length > 0 ? playerIds : ['none'])
    .gte('review_date', weekStartStr)
    .order('review_date', { ascending: false })

  // Achievements this week
  const { data: weekAchievements } = await supabase
    .from('player_achievements')
    .select('id, player_id, awarded_at, achievement:achievements(name, emoji)')
    .in('player_id', playerIds.length > 0 ? playerIds : ['none'])
    .gte('awarded_at', weekStartStr)

  // Recent attendance (last 5 per player) for children cards
  const { data: recentAttendanceAll } = await supabase
    .from('attendance')
    .select('player_id, present, session_date')
    .in('player_id', playerIds.length > 0 ? playerIds : ['none'])
    .order('session_date', { ascending: false })
    .limit(50)

  // Build recent attendance map (last 5 per player)
  const recentAttendanceMap = new Map<string, { present: boolean; session_date: string }[]>()
  for (const a of recentAttendanceAll || []) {
    const list = recentAttendanceMap.get(a.player_id) || []
    if (list.length < 5) {
      list.push({ present: a.present, session_date: a.session_date })
      recentAttendanceMap.set(a.player_id, list)
    }
  }

  // Build latest review summary map for children cards
  const latestReviewSummaryMap = new Map<string, string>()
  for (const r of weekReviews || []) {
    if (!latestReviewSummaryMap.has(r.player_id) && r.parent_summary) {
      latestReviewSummaryMap.set(r.player_id, r.parent_summary)
    }
  }


  // Build week data per player for digest
  const weekDataByPlayer = new Map<string, {
    attendance: { present: boolean; session_date: string; groupName: string }[]
    reviews: { parent_summary: string | null; coachName: string; review_date: string }[]
    achievements: { name: string; emoji: string }[]
  }>()
  for (const p of players || []) {
    weekDataByPlayer.set(p.id, { attendance: [], reviews: [], achievements: [] })
  }
  for (const a of weekAttendance || []) {
    const data = weekDataByPlayer.get(a.player_id)
    if (data) {
      data.attendance.push({
        present: a.present,
        session_date: a.session_date,
        groupName: (a.group as unknown as { name: string })?.name || '',
      })
    }
  }
  for (const r of weekReviews || []) {
    const data = weekDataByPlayer.get(r.player_id)
    if (data) {
      data.reviews.push({
        parent_summary: r.parent_summary,
        coachName: (r.coach as unknown as { full_name: string })?.full_name || 'Coach',
        review_date: r.review_date,
      })
    }
  }
  for (const a of weekAchievements || []) {
    const data = weekDataByPlayer.get(a.player_id)
    if (data) {
      const ach = a.achievement as unknown as { name: string; emoji: string }
      if (ach) data.achievements.push({ name: ach.name, emoji: ach.emoji })
    }
  }

  // Build today's sessions
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' })
  type EnrolmentRow = {
    id: string
    status: string
    group: { name: string; day_of_week: string | null; time_slot: string | null; location: string | null } | null
  }
  const todaysSessions: { playerName: string; groupName: string; timeSlot: string; location: string }[] = []
  for (const p of players || []) {
    for (const e of (p.enrolments as unknown as EnrolmentRow[]) || []) {
      if (e.status === 'active' && e.group?.day_of_week === today) {
        todaysSessions.push({
          playerName: p.first_name,
          groupName: e.group.name,
          timeSlot: e.group.time_slot || '',
          location: e.group.location || '',
        })
      }
    }
  }

  // Build a map of latest review score per player
  const latestReviewMap = new Map<string, { avgScore: number; date: string }>()
  for (const r of latestReviews || []) {
    if (!latestReviewMap.has(r.player_id)) {
      const avg = Math.round(
        (r.attitude + r.effort + r.technical_quality + r.game_understanding + r.confidence + r.physical_movement) / 6
      )
      latestReviewMap.set(r.player_id, { avgScore: avg, date: r.review_date })
    }
  }

  // Referral data for the refer card
  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('referral_code, organisation_id')
    .eq('id', userId)
    .single()
  const { data: parentOrg } = parentProfile?.organisation_id
    ? await supabase.from('organisations').select('slug').eq('id', parentProfile.organisation_id).single()
    : { data: null }
  const orgSlug = parentOrg?.slug || ''
  const referralCode = parentProfile?.referral_code || ''

  // ── Upsell status queries ──
  const [
    { count: attendedTrialCount },
    { count: activeEnrolmentCount },
    { count: activeSubscriptionCount },
  ] = await Promise.all([
    supabase
      .from('trial_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', userId)
      .eq('status', 'attended'),
    supabase
      .from('enrolments')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', userId)
      .eq('status', 'active'),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', userId)
      .eq('status', 'active'),
  ])

  const childCount = (players || []).length
  const firstChildName = (players || [])[0]?.first_name || null
  const hasAttendedTrial = (attendedTrialCount || 0) > 0
  const hasActiveEnrolments = (activeEnrolmentCount || 0) > 0
  const hasSubscription = (activeSubscriptionCount || 0) > 0

  // Determine best upsell to show
  type UpsellType = 'trial_to_class' | 'single_to_package' | 'package_to_subscription' | 'add_second_child' | 'refer_friend'
  let primaryUpsell: UpsellType | null = null
  if (hasAttendedTrial && !hasActiveEnrolments && !hasSubscription) {
    primaryUpsell = 'trial_to_class'
  } else if (hasActiveEnrolments && !hasSubscription) {
    primaryUpsell = 'package_to_subscription'
  } else if (hasSubscription && childCount === 1) {
    primaryUpsell = 'add_second_child'
  }

  // Find a recommended class to link upsells to (pick the one with most availability)
  let suggestedGroupId: string | null = null
  let suggestedGroupName: string | null = null
  if (primaryUpsell === 'trial_to_class') {
    const { data: availableGroups } = await supabase
      .from('training_groups')
      .select('id, name, max_capacity')
      .eq('organisation_id', parentOrg)
      .order('name')
      .limit(5)

    if (availableGroups && availableGroups.length > 0) {
      // Pick first available class
      suggestedGroupId = availableGroups[0].id
      suggestedGroupName = availableGroups[0].name
    }
  }

  // Compute extra stats for the hero section
  const totalAttendanceRecords = recentAttendanceAll || []
  const totalPresent = totalAttendanceRecords.filter(a => a.present).length
  const overallAttendanceRate = totalAttendanceRecords.length > 0 ? Math.round((totalPresent / totalAttendanceRecords.length) * 100) : 0

  // Calculate attendance streak (consecutive present)
  const sortedAttendance = [...totalAttendanceRecords].sort((a, b) => b.session_date.localeCompare(a.session_date))
  let attendanceStreak = 0
  for (const a of sortedAttendance) {
    if (a.present) attendanceStreak++
    else break
  }

  // Get greeting based on time of day
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Next upcoming session
  const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayIdx = new Date().getDay()
  let nextSession: { day: string; group: string; time: string } | null = null
  if (todaysSessions.length > 0) {
    nextSession = { day: 'Today', group: todaysSessions[0].groupName, time: todaysSessions[0].timeSlot }
  } else {
    // Find the next day with a session
    for (const p of players || []) {
      for (const e of (p.enrolments as unknown as EnrolmentRow[]) || []) {
        if (e.status === 'active' && e.group?.day_of_week) {
          const dayIdx = DAY_ORDER.indexOf(e.group.day_of_week)
          if (dayIdx > todayIdx) {
            if (!nextSession) {
              nextSession = { day: e.group.day_of_week, group: e.group.name, time: e.group.time_slot || '' }
            }
          }
        }
      }
    }
    // If nothing found this week, take the first session next week
    if (!nextSession) {
      for (const p of players || []) {
        for (const e of (p.enrolments as unknown as EnrolmentRow[]) || []) {
          if (e.status === 'active' && e.group?.day_of_week) {
            nextSession = { day: e.group.day_of_week, group: e.group.name, time: e.group.time_slot || '' }
            break
          }
        }
        if (nextSession) break
      }
    }
  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="max-w-lg mx-auto space-y-0">
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Hi {name} <span aria-hidden="true">&#128075;</span></h1>
            <p className="text-sm text-white/40 mt-0.5">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <Link href="/dashboard/messages" className="relative w-10 h-10 bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-xl flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {(unreadCount || 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{unreadCount}</span>
            )}
          </Link>
        </div>

        {/* ═══ ALERT BANNERS ═══ */}
        {((overdueCount || 0) > 0 || (unreadCount || 0) > 0) && (
          <div className="space-y-3 mb-0">
            {(overdueCount || 0) > 0 && (
              <Link href="/dashboard/payments" className="block group">
                <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/20 rounded-2xl px-5 py-4 flex items-center gap-3 group-hover:border-red-500/40 transition-all">
                  <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-400 flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-400">{overdueCount} Overdue Payment{overdueCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-red-400/60">Tap to view and pay</p>
                  </div>
                  <span className="text-red-400/60">&rarr;</span>
                </div>
              </Link>
            )}
            {(unreadCount || 0) > 0 && (
              <Link href="/dashboard/messages" className="block group">
                <div className="bg-[#4ecde6]/10 backdrop-blur-xl border border-[#4ecde6]/20 rounded-2xl px-5 py-4 flex items-center gap-3 group-hover:border-[#4ecde6]/40 transition-all">
                  <div className="w-10 h-10 bg-[#4ecde6]/20 rounded-xl flex items-center justify-center text-[#4ecde6] flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#4ecde6]">{unreadCount} New Message{unreadCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-[#4ecde6]/60">Tap to read</p>
                  </div>
                  <span className="text-[#4ecde6]/60">&rarr;</span>
                </div>
              </Link>
            )}
          </div>
        )}

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ NEXT SESSION CARD ═══ */}
        {nextSession && (
          <>
            <Link href="/dashboard/schedule" className="block group">
              <div className="bg-white/[0.05] backdrop-blur-xl border border-[#4ecde6]/20 rounded-2xl p-5 shadow-[0_0_20px_rgba(78,205,230,0.1)]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#4ecde6]/10 rounded-xl flex items-center justify-center border border-[#4ecde6]/20">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Next Session</p>
                    <p className="text-lg font-bold text-white mt-0.5">{nextSession.day} {nextSession.time}</p>
                    <p className="text-sm text-white/60">{nextSession.group}</p>
                  </div>
                  <span className="text-[#4ecde6]/60 text-lg group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
                <p className="text-xs text-[#4ecde6] font-medium mt-3 group-hover:underline">View Details &gt;</p>
              </div>
            </Link>
            <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />
          </>
        )}

        {/* ═══ UPSELL BANNER ═══ */}
        {primaryUpsell && (
          <>
            <UpsellBanner
              type={primaryUpsell}
              childName={firstChildName || undefined}
              slug={orgSlug || undefined}
              groupId={suggestedGroupId || undefined}
              groupName={suggestedGroupName || undefined}
            />
            <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />
          </>
        )}

        {/* ═══ MERCH UPSELL ═══ */}
        <Link href="/dashboard/shop" className="block group">
          <div className="bg-gradient-to-r from-[#4ecde6]/[0.08] to-transparent backdrop-blur-xl border border-[#4ecde6]/[0.15] rounded-2xl p-4 flex items-center gap-4 hover:border-[#4ecde6]/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#4ecde6]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">👕</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white group-hover:text-[#4ecde6] transition-colors">Get your academy kit!</p>
              <p className="text-xs text-white/40 mt-0.5">Personalised training tops, kits &amp; equipment</p>
            </div>
            <svg className="w-5 h-5 text-white/20 flex-shrink-0 ml-auto group-hover:text-[#4ecde6] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ QUICK STATS ═══ */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-[0_0_15px_rgba(78,205,230,0.05)]">
            <p className="text-xs text-white/40 font-medium">Children</p>
            <p className="text-2xl font-bold text-[#4ecde6] mt-1">{(players || []).length}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{(players || []).length === 1 ? 'Registered child' : 'Registered children'}</p>
          </div>
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-[0_0_15px_rgba(78,205,230,0.05)]">
            <p className="text-xs text-white/40 font-medium">Attendance</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{overallAttendanceRate}%</p>
            <p className="text-[10px] text-white/30 mt-0.5">Overall rate</p>
          </div>
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-[0_0_15px_rgba(78,205,230,0.05)]">
            <p className="text-xs text-white/40 font-medium">Session Streak</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{attendanceStreak > 0 ? attendanceStreak : '---'}</p>
            <p className="text-[10px] text-white/30 mt-0.5">Consecutive</p>
          </div>
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-[0_0_15px_rgba(78,205,230,0.05)]">
            <p className="text-xs text-white/40 font-medium">New Reviews</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">{newReviewCount || 0}</p>
            <p className="text-[10px] text-white/30 mt-0.5">This week</p>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ CHILDREN PROGRESS CARDS ═══ */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">Your Children</h2>
            <Link href="/dashboard/children" className="text-xs text-[#4ecde6] hover:underline font-medium">View all &rarr;</Link>
          </div>
          {(players || []).length > 0 ? (
            <div className="space-y-4">
              {(players || []).map((p, idx) => {
                const review = latestReviewMap.get(p.id)
                const recentAtt = recentAttendanceMap.get(p.id) || []
                const reviewSnippet = latestReviewSummaryMap.get(p.id)
                const presentCount = recentAtt.filter(a => a.present).length
                const attRate = recentAtt.length > 0 ? Math.round((presentCount / recentAtt.length) * 100) : 0
                const attStrokeDash = recentAtt.length > 0 ? (attRate / 100) * 251.2 : 0

                // Get active groups
                const activeGroups = ((p.enrolments as unknown as EnrolmentRow[]) || [])
                  .filter(e => e.status === 'active' && e.group)
                  .map(e => e.group!)

                return (
                  <div key={p.id} className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-[0_0_15px_rgba(78,205,230,0.05)]">
                    {/* Player header */}
                    <div className="flex items-start gap-4">
                      <div className="relative flex-shrink-0">
                        {p.photo_url ? (
                          <PlayerAvatar photoUrl={p.photo_url} firstName={p.first_name} lastName={p.last_name} size="lg" />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4ecde6] to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                            {p.first_name.charAt(0)}
                          </div>
                        )}
                        {review && (
                          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#0a0a0a] border-2 border-[#4ecde6] flex items-center justify-center">
                            <span className="text-xs font-bold text-[#4ecde6]">{review.avgScore}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-white">{p.first_name} {p.last_name}</h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {p.age_group && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#4ecde6]/10 text-[#4ecde6] border border-[#4ecde6]/20">{p.age_group}</span>
                          )}
                          {p.position && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">{p.position}</span>
                          )}
                        </div>
                      </div>
                      {/* Attendance ring */}
                      {recentAtt.length > 0 && (
                        <div className="flex-shrink-0 relative w-14 h-14">
                          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 90 90">
                            <circle cx="45" cy="45" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                            <circle cx="45" cy="45" r="40" fill="none" stroke={attRate >= 80 ? '#22c55e' : attRate >= 50 ? '#f59e0b' : '#ef4444'} strokeWidth="5" strokeLinecap="round" strokeDasharray="251.2" strokeDashoffset={251.2 - attStrokeDash} />
                          </svg>
                          <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${attRate >= 80 ? 'text-emerald-400' : attRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{attRate}%</span>
                        </div>
                      )}
                    </div>

                    {/* Recent attendance dots */}
                    {recentAtt.length > 0 && (
                      <div className="mt-4 flex items-center gap-1.5">
                        <span className="text-[10px] text-white/40 font-medium mr-1">Recent:</span>
                        {[...recentAtt].reverse().map((a, i) => (
                          <div
                            key={i}
                            className={`w-3.5 h-3.5 rounded-full border-2 ${a.present ? 'bg-emerald-400 border-emerald-500/30' : 'bg-red-400 border-red-500/30'}`}
                            title={`${a.session_date} - ${a.present ? 'Present' : 'Absent'}`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Active groups as pill badges */}
                    {activeGroups.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {activeGroups.slice(0, 3).map((g, i) => (
                          <span key={i} className="text-[10px] bg-[#4ecde6]/10 border border-[#4ecde6]/20 rounded-full px-2.5 py-1 font-medium text-[#4ecde6]">
                            {g.name} · {g.day_of_week}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Latest review snippet */}
                    {reviewSnippet && (
                      <div className="mt-3 bg-white/[0.03] border-l-2 border-[#4ecde6]/40 rounded-r-xl px-3 py-2.5">
                        <p className="text-xs text-white/60 italic leading-relaxed">
                          &ldquo;{reviewSnippet.length > 100 ? reviewSnippet.substring(0, 100) + '...' : reviewSnippet}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2">
                      <Link href={`/dashboard/players/${p.id}`} className="flex-1 text-center px-3 py-2 bg-[#4ecde6]/10 text-[#4ecde6] rounded-xl text-xs font-semibold hover:bg-[#4ecde6]/20 transition-colors border border-[#4ecde6]/20">
                        View Profile
                      </Link>
                      <Link href={`/dashboard/feedback?player=${p.id}`} className="flex-1 text-center px-3 py-2 bg-white/[0.05] text-white/60 rounded-xl text-xs font-semibold hover:bg-white/[0.1] transition-colors border border-white/[0.08]">
                        Progress Report
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 text-center shadow-[0_0_15px_rgba(78,205,230,0.05)]">
              <div className="w-12 h-12 bg-white/[0.05] rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              </div>
              <p className="text-sm text-white/40">No children registered yet.</p>
              <Link href="/dashboard/children" className="inline-block mt-3 px-5 py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-semibold hover:bg-[#4ecde6]/90 transition-colors">
                Add Your Child
              </Link>
            </div>
          )}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ THIS WEEK DIGEST ═══ */}
        {(players || []).length > 0 && (() => {
          const hasAnyActivity = Array.from(weekDataByPlayer.values()).some(
            d => d.attendance.length > 0 || d.reviews.length > 0 || d.achievements.length > 0
          )
          if (!hasAnyActivity) return null
          return (
            <>
              <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-[0_0_15px_rgba(78,205,230,0.05)]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-[#4ecde6]/10 rounded-lg flex items-center justify-center border border-[#4ecde6]/20">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">This Week&apos;s Report</h2>
                    <p className="text-[11px] text-white/30">
                      Week of {new Date(weekStartStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {(players || []).map((p) => {
                    const data = weekDataByPlayer.get(p.id)
                    const attended = data?.attendance.filter((a) => a.present).length || 0
                    const total = data?.attendance.length || 0
                    const hasReviews = (data?.reviews.length || 0) > 0
                    const hasAchievements = (data?.achievements.length || 0) > 0
                    const hasActivity = total > 0 || hasReviews || hasAchievements
                    if (!hasActivity) return null

                    return (
                      <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <PlayerAvatar photoUrl={p.photo_url} firstName={p.first_name} lastName={p.last_name} size="xs" />
                          <span className="text-sm font-semibold text-white">{p.first_name}</span>
                        </div>
                        <div className="space-y-2.5">
                          {total > 0 && (
                            <div className={`rounded-lg px-3 py-2 flex items-center justify-between ${attended === total ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                              <span className={`text-sm font-medium ${attended === total ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {attended}/{total} sessions
                              </span>
                              <div className="flex gap-1">
                                {data?.attendance.map((a, i) => (
                                  <span key={i} className={`w-2.5 h-2.5 rounded-full ${a.present ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                ))}
                              </div>
                            </div>
                          )}
                          {hasReviews && data?.reviews.map((r, i) => (
                            <div key={i} className="bg-white/[0.03] border-l-2 border-[#4ecde6]/40 rounded-r-lg px-3 py-2">
                              {r.parent_summary && (
                                <p className="text-sm text-white/60 italic">&ldquo;{r.parent_summary}&rdquo;</p>
                              )}
                              <p className="text-xs text-white/30 mt-1">&mdash; {r.coachName}</p>
                            </div>
                          ))}
                          {hasAchievements && (
                            <div className="flex flex-wrap gap-2">
                              {data?.achievements.map((a, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full px-3 py-1 text-xs font-semibold">
                                  {a.emoji} {a.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />
            </>
          )
        })()}

        {/* ═══ TODAY'S CLASSES ═══ */}
        {todaysSessions.length > 0 && (
          <>
            <div>
              <h2 className="text-base font-bold mb-4 flex items-center gap-2 text-white">
                <span className="relative w-2.5 h-2.5 bg-emerald-400 rounded-full">
                  <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                </span>
                Today&apos;s Classes
              </h2>
              <div className="space-y-3">
                {todaysSessions.map((s, i) => (
                  <Link key={i} href="/dashboard/schedule" className="block group">
                    <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl px-5 py-4 flex items-center gap-4 shadow-[0_0_15px_rgba(78,205,230,0.05)] hover:border-[#4ecde6]/20 transition-all">
                      <div className="w-10 h-10 bg-[#4ecde6]/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-[#4ecde6]/20">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white group-hover:text-[#4ecde6] transition-colors">{s.groupName}</p>
                        <p className="text-xs text-white/40 mt-0.5">{s.playerName}{s.location ? ` · ${s.location}` : ''}</p>
                      </div>
                      {s.timeSlot && (
                        <div className="text-right flex-shrink-0">
                          <div className="bg-[#4ecde6]/10 border border-[#4ecde6]/20 rounded-xl px-3 py-1.5">
                            <p className="text-sm font-bold text-[#4ecde6]">{s.timeSlot}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />
          </>
        )}

        {/* ═══ RECENT FEEDBACK ═══ */}
        {(weekReviews || []).length > 0 && (() => {
          const latestReview = (weekReviews || [])[0]
          const coachName = latestReview ? (latestReview.coach as unknown as { full_name: string })?.full_name || 'Coach' : ''
          return (
            <>
              <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-[0_0_15px_rgba(78,205,230,0.05)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <h2 className="text-sm font-bold text-white">Recent Feedback</h2>
                </div>
                {latestReview?.parent_summary && (
                  <p className="text-sm text-white/60 italic leading-relaxed">&ldquo;{latestReview.parent_summary}&rdquo;</p>
                )}
                <p className="text-xs text-white/30 mt-2">&mdash; {coachName}</p>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />
            </>
          )
        })()}

        {/* ═══ MESSAGES & PAYMENTS ═══ */}
        <div className="space-y-4">
          {/* Messages */}
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(78,205,230,0.05)]">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <h2 className="text-sm font-bold text-white">Messages</h2>
              </div>
              <Link href="/dashboard/messages" className="text-xs text-[#4ecde6] hover:underline font-medium">View all</Link>
            </div>
            <div className="p-5">
              {(messages || []).length > 0 ? (
                <div className="space-y-3">
                  {(messages || []).map((m) => (
                    <Link key={m.id} href="/dashboard/messages" className="block group">
                      <div className={`flex items-start gap-3 rounded-xl px-3 py-2.5 -mx-1 hover:bg-white/[0.03] transition-colors ${!m.read ? 'bg-[#4ecde6]/5' : ''}`}>
                        <div className="w-9 h-9 bg-gradient-to-br from-purple-500/20 to-[#4ecde6]/10 rounded-full flex items-center justify-center text-sm font-bold text-[#4ecde6] flex-shrink-0 mt-0.5">
                          {(m.sender as unknown as { full_name: string })?.full_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm text-white ${!m.read ? 'font-bold' : 'font-medium'}`}>{m.subject || 'Message'}</span>
                            <span className="text-[10px] text-white/30 flex-shrink-0 ml-2">{new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          </div>
                          <p className="text-xs text-white/40 truncate mt-0.5">{m.body}</p>
                        </div>
                        {!m.read && <div className="w-2 h-2 bg-[#4ecde6] rounded-full mt-2 flex-shrink-0" />}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <p className="text-xs text-white/30">No messages yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Payments */}
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(78,205,230,0.05)]">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                <h2 className="text-sm font-bold text-white">Payments</h2>
              </div>
              <Link href="/dashboard/payments" className="text-xs text-[#4ecde6] hover:underline font-medium">View all</Link>
            </div>
            <div className="p-5">
              {(upcomingPayments || []).length > 0 ? (
                <div className="space-y-3">
                  {(upcomingPayments || []).map((p) => {
                    const owing = Number(p.amount) - Number(p.amount_paid || 0)
                    return (
                      <div key={p.id} className="flex items-center gap-3 rounded-xl">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.status === 'overdue' ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={p.status === 'overdue' ? '#ef4444' : '#f59e0b'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{p.description || 'Payment'}</p>
                          <p className="text-xs text-white/40">
                            {p.due_date ? new Date(p.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No due date'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${p.status === 'overdue' ? 'text-red-400' : 'text-white'}`}>
                            &pound;{owing.toFixed(2)}
                          </p>
                          <Link href="/dashboard/payments" className="text-[10px] text-[#4ecde6] font-semibold hover:underline">
                            Pay now
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(34,197,94,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><polyline points="20 6 9 17 4 12"/></svg>
                  <p className="text-xs text-white/30">All payments up to date</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ REFER A FRIEND ═══ */}
        {referralCode && (
          <>
            <ReferralLink orgSlug={orgSlug} referralCode={referralCode} compact />
            <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />
          </>
        )}

        {/* ═══ QUICK ACTIONS GRID ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/dashboard/schedule" className="block group">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-center hover:border-[#4ecde6]/20 transition-all shadow-[0_0_15px_rgba(78,205,230,0.05)]">
              <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <p className="text-xs font-semibold text-white/60">Schedule</p>
            </div>
          </Link>
          <Link href="/dashboard/payments" className="block group">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-center hover:border-[#4ecde6]/20 transition-all shadow-[0_0_15px_rgba(78,205,230,0.05)]">
              <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              <p className="text-xs font-semibold text-white/60">Payments</p>
            </div>
          </Link>
          <Link href="/dashboard/messages" className="block group">
            <div className="relative bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-center hover:border-[#4ecde6]/20 transition-all shadow-[0_0_15px_rgba(78,205,230,0.05)]">
              <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              {(unreadCount || 0) > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{unreadCount}</span>
              )}
              <p className="text-xs font-semibold text-white/60">Messages</p>
            </div>
          </Link>
          <Link href="/dashboard/feedback" className="block group">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-center hover:border-[#4ecde6]/20 transition-all shadow-[0_0_15px_rgba(78,205,230,0.05)]">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <p className="text-xs font-semibold text-white/60">Progress</p>
            </div>
          </Link>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ MORE ACTIONS ═══ */}
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          <Link href="/dashboard/upgrade" className="block group">
            <div className="bg-[#4ecde6]/10 rounded-xl border border-[#4ecde6]/20 p-3 text-center hover:border-[#4ecde6]/40 transition-all">
              <div className="w-8 h-8 bg-[#4ecde6]/10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:scale-110 transition-transform">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <p className="text-[10px] font-semibold text-[#4ecde6]">Upgrade</p>
            </div>
          </Link>
          <Link href="/dashboard/achievements" className="block group">
            <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-3 text-center hover:border-white/[0.15] transition-all">
              <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:scale-110 transition-transform">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
              </div>
              <p className="text-[10px] font-medium text-white/40">Awards</p>
            </div>
          </Link>
          <Link href="/dashboard/gallery" className="block group">
            <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-3 text-center hover:border-white/[0.15] transition-all">
              <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:scale-110 transition-transform">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <p className="text-[10px] font-medium text-white/40">Gallery</p>
            </div>
          </Link>
          <Link href="/dashboard/events" className="block group">
            <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-3 text-center hover:border-white/[0.15] transition-all">
              <div className="w-8 h-8 bg-pink-500/10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:scale-110 transition-transform">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>
              </div>
              <p className="text-[10px] font-medium text-white/40">Events</p>
            </div>
          </Link>
          <Link href="/dashboard/waivers" className="block group">
            <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-3 text-center hover:border-white/[0.15] transition-all">
              <div className="w-8 h-8 bg-teal-500/10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:scale-110 transition-transform">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <p className="text-[10px] font-medium text-white/40">Waivers</p>
            </div>
          </Link>
          <Link href="/dashboard/referrals" className="block group">
            <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-3 text-center hover:border-white/[0.15] transition-all">
              <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:scale-110 transition-transform">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
              <p className="text-[10px] font-medium text-white/40">Refer</p>
            </div>
          </Link>
          <Link href="/dashboard/account" className="block group">
            <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-3 text-center hover:border-white/[0.15] transition-all">
              <div className="w-8 h-8 bg-gray-500/10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:scale-110 transition-transform">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
              <p className="text-[10px] font-medium text-white/40">Account</p>
            </div>
          </Link>
        </div>

        {/* ═══ BOOK SESSION CTA ═══ */}
        <div className="pt-4">
          <Link href="/book" className="block w-full text-center py-3.5 bg-[#4ecde6] text-[#0a0a0a] rounded-2xl text-sm font-bold hover:bg-[#4ecde6]/90 transition-colors shadow-[0_0_20px_rgba(78,205,230,0.3)]">
            Book Next Session
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ─── ADMIN DASHBOARD ─── */
async function AdminDashboard({ name, orgId }: { name: string; orgId: string }) {
  const supabase = await createClient()

  // Key stats
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })

  const { count: totalParents } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'parent')

  const { count: activeSubs } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  // Monthly revenue (paid payments this month)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const { data: paidThisMonth } = await supabase
    .from('payments')
    .select('amount_paid')
    .eq('status', 'paid')
    .gte('paid_date', monthStart)

  const monthlyRevenue = (paidThisMonth || []).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)

  // Previous month revenue for trend
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
  const { data: prevMonthPaid } = await supabase
    .from('payments')
    .select('amount_paid')
    .eq('status', 'paid')
    .gte('paid_date', prevMonthStart)
    .lte('paid_date', prevMonthEnd)
  const prevRevenue = (prevMonthPaid || []).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
  const revenueTrend = prevRevenue > 0 ? Math.round(((monthlyRevenue - prevRevenue) / prevRevenue) * 100) : 0

  // Player count trend (this month vs last)
  const { count: newPlayersThisMonth } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart)

  const { count: newPlayersLastMonth } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', prevMonthStart)
    .lt('created_at', monthStart)

  const playerTrend = (newPlayersLastMonth || 0) > 0
    ? Math.round((((newPlayersThisMonth || 0) - (newPlayersLastMonth || 0)) / (newPlayersLastMonth || 1)) * 100)
    : 0

  // Weekly revenue for sparkline (last 4 weeks)
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const { data: recentPaidPayments } = await supabase
    .from('payments')
    .select('amount_paid, paid_date')
    .eq('status', 'paid')
    .gte('paid_date', fourWeeksAgo.toISOString().split('T')[0])
    .order('paid_date', { ascending: true })

  // Build weekly sparkline data
  const weeklyRevenue = [0, 0, 0, 0]
  for (const p of recentPaidPayments || []) {
    const d = new Date(p.paid_date)
    const weekIdx = Math.min(3, Math.floor((Date.now() - d.getTime()) / (7 * 24 * 60 * 60 * 1000)))
    weeklyRevenue[3 - weekIdx] += Number(p.amount_paid || 0)
  }

  // Today's classes
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' })
  const { data: todaysGroups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .eq('day_of_week', today)
    .order('time_slot', { ascending: true })

  // Player counts per group today
  const todaysGroupIds = (todaysGroups || []).map((g) => g.id)
  const { data: todaysEnrolments } = await supabase
    .from('enrolments')
    .select('group_id')
    .in('group_id', todaysGroupIds.length > 0 ? todaysGroupIds : ['none'])
    .eq('status', 'active')

  const groupPlayerCounts = new Map<string, number>()
  for (const e of todaysEnrolments || []) {
    groupPlayerCounts.set(e.group_id, (groupPlayerCounts.get(e.group_id) || 0) + 1)
  }

  // Recent activity: latest 5 enrolments
  const { data: recentEnrolments } = await supabase
    .from('enrolments')
    .select('id, status, enrolled_at, player:players(first_name, last_name), group:training_groups(name)')
    .order('enrolled_at', { ascending: false })
    .limit(5)

  // Recent activity: latest 5 payments
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('id, amount, status, description, created_at, parent:profiles!payments_parent_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(5)

  // Recent activity: latest 5 messages
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('id, subject, created_at, sender:profiles!messages_sender_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(5)

  // Overdue payments
  const { count: overdueCount } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'overdue')

  // Build unified activity feed
  const activityFeed: { type: 'enrolment' | 'payment' | 'message'; name: string; detail: string; date: string; amount?: string; status?: string }[] = []
  for (const e of recentEnrolments || []) {
    const pl = e.player as unknown as { first_name: string; last_name: string }
    const gr = e.group as unknown as { name: string }
    activityFeed.push({
      type: 'enrolment',
      name: `${pl?.first_name || ''} ${pl?.last_name || ''}`.trim(),
      detail: gr?.name || 'Group',
      date: e.enrolled_at,
      status: e.status,
    })
  }
  for (const p of recentPayments || []) {
    const pa = p.parent as unknown as { full_name: string }
    activityFeed.push({
      type: 'payment',
      name: pa?.full_name || 'Parent',
      detail: p.description || 'Payment',
      date: p.created_at,
      amount: `£${Number(p.amount).toFixed(2)}`,
      status: p.status,
    })
  }
  for (const m of recentMessages || []) {
    const se = m.sender as unknown as { full_name: string }
    activityFeed.push({
      type: 'message',
      name: se?.full_name || 'Unknown',
      detail: m.subject || 'Message',
      date: m.created_at,
    })
  }
  activityFeed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Relative time helper
  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="max-w-2xl mx-auto space-y-0">
        {/* ═══ HEADER ═══ */}
        <div className="mb-6">
          <p className="text-xs text-white/30 font-medium tracking-widest uppercase">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-2">Hi {name}</h1>
          <p className="text-sm text-white/40 mt-1">Admin Dashboard</p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ TODAY'S FOCUS ═══ */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-[#4ecde6]/20 rounded-2xl p-5 shadow-[0_0_20px_rgba(78,205,230,0.1)]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Today&apos;s Focus</p>
            <span className="px-2.5 py-0.5 bg-[#4ecde6]/10 border border-[#4ecde6]/20 rounded-full text-[10px] font-semibold text-[#4ecde6]">Sessions</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#4ecde6]/10 rounded-xl flex items-center justify-center border border-[#4ecde6]/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div>
              <p className="text-xs text-white/40">Sessions booked</p>
              <p className="text-3xl font-bold text-white">{(todaysGroups || []).length}</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ REVENUE CARD ═══ */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-[0_0_15px_rgba(78,205,230,0.05)]">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-1">Monthly Revenue</p>
          <p className="text-3xl font-bold text-white">&pound;{monthlyRevenue.toFixed(0)}</p>
          {revenueTrend !== 0 && (
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-xs font-semibold ${revenueTrend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {revenueTrend > 0 ? '+' : ''}{revenueTrend}%
              </span>
              <span className="text-[10px] text-white/30">vs last month</span>
            </div>
          )}
          {/* Mini sparkline */}
          <div className="mt-4 flex items-end gap-1 h-8">
            {weeklyRevenue.map((val, i) => {
              const max = Math.max(...weeklyRevenue, 1)
              const h = Math.max((val / max) * 100, 8)
              return (
                <div key={i} className="flex-1 bg-[#4ecde6]/20 rounded-sm relative overflow-hidden" style={{ height: `${h}%` }}>
                  <div className="absolute inset-0 bg-[#4ecde6]/40 rounded-sm" />
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-white/30 mt-2">Weekly revenue (last 4 weeks)</p>
          <div className="mt-3 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#4ecde6]/60 to-[#4ecde6] rounded-full" style={{ width: `${Math.min((monthlyRevenue / Math.max(prevRevenue, 1)) * 50, 100)}%` }} />
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ STAT CARDS ROW ═══ */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/players" className="block">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-[0_0_15px_rgba(78,205,230,0.05)] hover:border-[#4ecde6]/20 transition-all">
              <p className="text-xs text-white/40 font-medium">Active Players</p>
              <p className="text-2xl font-bold text-[#4ecde6] mt-1">{totalPlayers || 0}</p>
              <p className="text-[10px] text-white/30 mt-0.5">Total players</p>
              {playerTrend !== 0 && (
                <span className={`text-[10px] font-semibold ${playerTrend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {playerTrend > 0 ? '+' : ''}{playerTrend}%
                </span>
              )}
            </div>
          </Link>
          <Link href="/dashboard/schedule" className="block">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-[0_0_15px_rgba(78,205,230,0.05)] hover:border-[#4ecde6]/20 transition-all">
              <p className="text-xs text-white/40 font-medium">Sessions Today</p>
              <p className="text-2xl font-bold text-[#4ecde6] mt-1">{(todaysGroups || []).length}</p>
              <p className="text-[10px] text-white/30 mt-0.5">Total classes</p>
            </div>
          </Link>
          <Link href="/dashboard/parents" className="block">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-[0_0_15px_rgba(78,205,230,0.05)] hover:border-[#4ecde6]/20 transition-all">
              <p className="text-xs text-white/40 font-medium">Parents</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">{totalParents || 0}</p>
              <p className="text-[10px] text-white/30 mt-0.5">Registered</p>
            </div>
          </Link>
          <Link href="/dashboard/subscriptions" className="block">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-[0_0_15px_rgba(78,205,230,0.05)] hover:border-[#4ecde6]/20 transition-all">
              <p className="text-xs text-white/40 font-medium">Active Subs</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{activeSubs || 0}</p>
              <p className="text-[10px] text-white/30 mt-0.5">Subscriptions</p>
            </div>
          </Link>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ OVERDUE ALERT ═══ */}
        {(overdueCount || 0) > 0 && (
          <>
            <Link href="/dashboard/payments?status=overdue" className="block group">
              <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/20 rounded-2xl px-5 py-4 flex items-center justify-between hover:border-red-500/40 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <span className="text-sm font-semibold text-red-400">
                    {overdueCount} overdue payment{overdueCount !== 1 ? 's' : ''} require attention
                  </span>
                </div>
                <span className="text-red-400/60 text-sm group-hover:translate-x-1 transition-transform">&rarr;</span>
              </div>
            </Link>
            <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />
          </>
        )}

        {/* ═══ TODAY'S SCHEDULE ═══ */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(78,205,230,0.05)]">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <h2 className="text-sm font-bold text-white">Today&apos;s Schedule</h2>
            </div>
            <Link href="/dashboard/schedule" className="text-xs text-[#4ecde6] hover:underline font-medium">Full schedule</Link>
          </div>
          <div className="p-5">
            {(todaysGroups || []).length > 0 ? (
              <div className="space-y-3">
                {(todaysGroups || []).map((g, i) => {
                  const playerCount = groupPlayerCounts.get(g.id) || 0
                  return (
                    <div key={g.id} className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 hover:border-[#4ecde6]/20 transition-all">
                      <div className="w-10 h-10 bg-[#4ecde6]/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-[#4ecde6]/20">
                        <div className="w-3 h-3 rounded-full bg-[#4ecde6]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{g.name}</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {(g.coach as unknown as { full_name: string })?.full_name || 'No coach assigned'}
                          {g.location ? ` · ${g.location}` : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {g.time_slot && <p className="text-sm font-bold text-[#4ecde6]">{g.time_slot}</p>}
                        <div className="flex items-center gap-1 mt-1">
                          <div className="w-14 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full bg-[#4ecde6]/60 rounded-full" style={{ width: `${Math.min((playerCount / 20) * 100, 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-white/40 font-medium">{playerCount}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p className="text-xs text-white/30">No classes scheduled for today.</p>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ ACTIVITY FEED ═══ */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(78,205,230,0.05)]">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              <h2 className="text-sm font-bold text-white">Recent Activity</h2>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard/enrolments" className="text-[10px] text-[#4ecde6] hover:underline font-medium">Enrolments</Link>
              <span className="text-white/10">|</span>
              <Link href="/dashboard/payments" className="text-[10px] text-[#4ecde6] hover:underline font-medium">Payments</Link>
              <span className="text-white/10">|</span>
              <Link href="/dashboard/messages" className="text-[10px] text-[#4ecde6] hover:underline font-medium">Messages</Link>
            </div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {activityFeed.length > 0 ? (
              activityFeed.slice(0, 10).map((item, i) => (
                <div key={`${item.type}-${i}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    item.type === 'enrolment' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                    item.type === 'payment' ? 'bg-blue-500/10 border border-blue-500/20' :
                    'bg-purple-500/10 border border-purple-500/20'
                  }`}>
                    {item.type === 'enrolment' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                    )}
                    {item.type === 'payment' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    )}
                    {item.type === 'message' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <p className="text-xs text-white/40 truncate">{item.detail}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {item.amount && <p className="text-xs font-semibold text-white">{item.amount}</p>}
                    {item.status && <StatusBadge status={item.status} />}
                    <p className="text-[10px] text-white/30 mt-0.5">{relativeTime(item.date)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                <p className="text-xs text-white/30">No recent activity.</p>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ ACTION BUTTONS ═══ */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/players?add=1" className="block">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl py-3.5 text-center hover:border-[#4ecde6]/20 transition-all shadow-[0_0_15px_rgba(78,205,230,0.05)] flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span className="text-sm font-semibold text-[#4ecde6]">Add Player</span>
            </div>
          </Link>
          <Link href="/dashboard/session-notes?add=1" className="block">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl py-3.5 text-center hover:border-[#4ecde6]/20 transition-all shadow-[0_0_15px_rgba(78,205,230,0.05)] flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span className="text-sm font-semibold text-[#4ecde6]">Create Session</span>
            </div>
          </Link>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ QUICK ACTIONS ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/dashboard/messages?add=1" className="block group">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-center hover:border-[#4ecde6]/20 transition-all shadow-[0_0_15px_rgba(78,205,230,0.05)]">
              <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <p className="text-xs font-semibold text-white/60">Announce</p>
            </div>
          </Link>
          <Link href="/dashboard/reports" className="block group">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-center hover:border-[#4ecde6]/20 transition-all shadow-[0_0_15px_rgba(78,205,230,0.05)]">
              <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <p className="text-xs font-semibold text-white/60">Analytics</p>
            </div>
          </Link>
          <Link href="/dashboard/payments" className="block group">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-center hover:border-[#4ecde6]/20 transition-all shadow-[0_0_15px_rgba(78,205,230,0.05)]">
              <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              <p className="text-xs font-semibold text-white/60">Payments</p>
            </div>
          </Link>
          <Link href="/dashboard/schedule" className="block group">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-center hover:border-[#4ecde6]/20 transition-all shadow-[0_0_15px_rgba(78,205,230,0.05)]">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <p className="text-xs font-semibold text-white/60">Schedule</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ─── COACH DASHBOARD ─── */
async function CoachDashboard({ userId, name, orgId }: { userId: string; name: string; orgId: string }) {
  const supabase = await createClient()

  // Coach's groups
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' })

  const { data: myGroups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location')
    .eq('coach_id', userId)

  const myGroupIds = (myGroups || []).map((g) => g.id)

  // Today's classes for this coach
  const todaysClasses = (myGroups || []).filter((g) => g.day_of_week === today)

  // Enrolled players per group (for today's classes)
  const todaysClassIds = todaysClasses.map((g) => g.id)
  const { data: enrolledPlayers } = await supabase
    .from('enrolments')
    .select('group_id, player:players(id, first_name, last_name, photo_url)')
    .in('group_id', todaysClassIds.length > 0 ? todaysClassIds : ['none'])
    .eq('status', 'active')

  const classPlayersMap = new Map<string, { id: string; first_name: string; last_name: string; photo_url: string | null }[]>()
  for (const e of enrolledPlayers || []) {
    const player = e.player as unknown as { id: string; first_name: string; last_name: string; photo_url: string | null }
    if (!player) continue
    const list = classPlayersMap.get(e.group_id) || []
    list.push(player)
    classPlayersMap.set(e.group_id, list)
  }

  // Recent reviews by this coach
  const { data: recentReviews } = await supabase
    .from('progress_reviews')
    .select('id, review_date, parent_summary, player:players(first_name, last_name), attitude, effort, technical_quality, game_understanding, confidence, physical_movement')
    .eq('coach_id', userId)
    .order('review_date', { ascending: false })
    .limit(5)

  // Unread messages for this coach
  const { data: unreadMessages } = await supabase
    .from('messages')
    .select('id, subject, body, created_at, sender:profiles!messages_sender_id_fkey(full_name)')
    .eq('recipient_id', userId)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(5)

  const { count: unreadCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false)

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="max-w-2xl mx-auto space-y-0">
        {/* ═══ HEADER ═══ */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Hi {name}</h1>
          <p className="text-sm text-white/40 mt-1">
            You have {todaysClasses.length} class{todaysClasses.length !== 1 ? 'es' : ''} today
            {(unreadCount || 0) > 0 && ` and ${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`}.
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ COACH STATS ═══ */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/dashboard/schedule" className="block">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-center shadow-[0_0_15px_rgba(78,205,230,0.05)] hover:border-[#4ecde6]/20 transition-all">
              <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <p className="text-xl font-bold text-[#4ecde6]">{(myGroups || []).length}</p>
              <p className="text-[10px] text-white/40 mt-0.5">My Groups</p>
            </div>
          </Link>
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-center shadow-[0_0_15px_rgba(78,205,230,0.05)]">
            <div className="w-9 h-9 bg-[#4ecde6]/10 border border-[#4ecde6]/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <p className="text-xl font-bold text-[#4ecde6]">{todaysClasses.length}</p>
            <p className="text-[10px] text-white/40 mt-0.5">Today&apos;s Classes</p>
          </div>
          <Link href="/dashboard/reviews" className="block">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-center shadow-[0_0_15px_rgba(78,205,230,0.05)] hover:border-[#4ecde6]/20 transition-all">
              <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <p className="text-xl font-bold text-emerald-400">{(recentReviews || []).length}</p>
              <p className="text-[10px] text-white/40 mt-0.5">Reviews</p>
            </div>
          </Link>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        {/* ═══ UNREAD MESSAGES ALERT ═══ */}
        {(unreadCount || 0) > 0 && (
          <>
            <Link href="/dashboard/messages" className="block group">
              <div className="bg-[#4ecde6]/10 backdrop-blur-xl border border-[#4ecde6]/20 rounded-2xl px-5 py-4 flex items-center justify-between hover:border-[#4ecde6]/40 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#4ecde6]/20 rounded-xl flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <span className="text-sm font-medium text-[#4ecde6]">
                    {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-[#4ecde6]/60 text-sm group-hover:translate-x-1 transition-transform">View &rarr;</span>
              </div>
            </Link>
            <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />
          </>
        )}

        {/* ═══ TODAY'S CLASSES ═══ */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(78,205,230,0.05)]">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">My Classes Today</h2>
            <Link href="/dashboard/schedule" className="text-xs text-[#4ecde6] hover:underline font-medium">Full schedule</Link>
          </div>
          <div className="p-5">
            {todaysClasses.length > 0 ? (
              <div className="space-y-4">
                {todaysClasses.map((g) => {
                  const players = classPlayersMap.get(g.id) || []
                  return (
                    <div key={g.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{g.name}</p>
                          {g.location && <p className="text-xs text-white/40">{g.location}</p>}
                        </div>
                        {g.time_slot && <p className="text-sm font-bold text-[#4ecde6]">{g.time_slot}</p>}
                      </div>
                      {players.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {players.map((p) => (
                            <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.05] border border-white/[0.08] rounded-full text-xs text-white/60">
                              <PlayerAvatar photoUrl={p.photo_url} firstName={p.first_name} lastName={p.last_name} size="xs" />
                              {p.first_name} {p.last_name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-white/30 mt-1">No players enrolled.</p>
                      )}
                      <div className="mt-3">
                        <Link href={'/dashboard/session/' + g.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4ecde6] text-[#0a0a0a] rounded-lg text-xs font-semibold hover:bg-[#4ecde6]/90 transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          Start Session
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p className="text-xs text-white/30">No classes scheduled for today.</p>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ═══ RECENT REVIEWS ═══ */}
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(78,205,230,0.05)]">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Recent Reviews</h2>
              <Link href="/dashboard/reviews" className="text-xs text-[#4ecde6] hover:underline font-medium">View all</Link>
            </div>
            <div className="p-5">
              {(recentReviews || []).length > 0 ? (
                <div className="space-y-3">
                  {(recentReviews || []).map((r) => (
                    <div key={r.id} className="border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">
                          {(r.player as unknown as { first_name: string; last_name: string })?.first_name}{' '}
                          {(r.player as unknown as { first_name: string; last_name: string })?.last_name}
                        </span>
                        <span className="text-xs text-white/30">{new Date(r.review_date).toLocaleDateString()}</span>
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {SCORE_CATEGORIES.map((cat) => (
                          <div key={cat.key} className="flex flex-col items-center gap-0.5">
                            <ScoreBadge score={r[cat.key] as number} />
                            <span className="text-[9px] text-white/30">{cat.label.substring(0, 4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <p className="text-xs text-white/30">No reviews written yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* ═══ UNREAD MESSAGES ═══ */}
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(78,205,230,0.05)]">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Unread Messages</h2>
              <Link href="/dashboard/messages" className="text-xs text-[#4ecde6] hover:underline font-medium">View all</Link>
            </div>
            <div className="p-5">
              {(unreadMessages || []).length > 0 ? (
                <div className="space-y-3">
                  {(unreadMessages || []).map((m) => (
                    <Link key={m.id} href="/dashboard/messages" className="block group">
                      <div className="flex items-center gap-3 rounded-xl px-2 py-2 -mx-1 hover:bg-white/[0.03] transition-colors">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 text-[#4ecde6] text-xs font-bold flex-shrink-0">
                          {(m.sender as unknown as { full_name: string })?.full_name?.charAt(0) || '?'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">{m.subject || 'Message'}</span>
                            <span className="text-[10px] text-white/30 font-normal">{new Date(m.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-white/40 text-xs truncate font-normal">{m.body}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <p className="text-xs text-white/30">No unread messages.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
