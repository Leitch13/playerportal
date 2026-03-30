import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'
import InsightsClient from './InsightsClient'

export default async function AttendanceInsightsPage() {
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

  const role = (profile?.role || 'parent') as UserRole
  if (role === 'parent') redirect('/dashboard')

  // ─── Date boundaries ───
  const now = new Date()
  const ninetyDaysAgo = new Date(now)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const fourteenDaysAgo = new Date(now)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // ─── Fetch all data in parallel ───
  const [
    { data: attendance90 },
    { data: players },
    { data: groups },
    { data: enrolments },
  ] = await Promise.all([
    supabase
      .from('attendance')
      .select('id, player_id, group_id, session_date, present')
      .gte('session_date', fmt(ninetyDaysAgo))
      .order('session_date', { ascending: false }),
    supabase
      .from('players')
      .select('id, first_name, last_name, parent_id'),
    supabase
      .from('training_groups')
      .select('id, name, day_of_week'),
    supabase
      .from('enrolments')
      .select('player_id, group_id, status')
      .eq('status', 'active'),
  ])

  const allAttendance = attendance90 || []
  const allPlayers = players || []
  const allGroups = groups || []
  const allEnrolments = enrolments || []

  // ─── Overview: Average Attendance Rate ───
  const totalRecords = allAttendance.length
  const presentCount = allAttendance.filter((a) => a.present).length
  const avgRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0

  // Previous 90-day window for trend comparison (days 91-180)
  const oneEightyDaysAgo = new Date(now)
  oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180)
  const { data: prevAttendance } = await supabase
    .from('attendance')
    .select('id, present')
    .gte('session_date', fmt(oneEightyDaysAgo))
    .lt('session_date', fmt(ninetyDaysAgo))

  const prevRecords = prevAttendance || []
  const prevPresent = prevRecords.filter((a) => a.present).length
  const prevRate = prevRecords.length > 0 ? Math.round((prevPresent / prevRecords.length) * 100) : 0
  const rateTrend = avgRate - prevRate

  // ─── Sessions this month ───
  const thisMonthSessions = new Set(
    allAttendance
      .filter((a) => a.session_date >= monthStart)
      .map((a) => `${a.group_id}_${a.session_date}`)
  ).size

  // ─── Most / Least attended class ───
  const groupAttendanceMap: Record<string, { present: number; total: number }> = {}
  for (const a of allAttendance) {
    if (!groupAttendanceMap[a.group_id]) {
      groupAttendanceMap[a.group_id] = { present: 0, total: 0 }
    }
    groupAttendanceMap[a.group_id].total++
    if (a.present) groupAttendanceMap[a.group_id].present++
  }

  const groupRates = Object.entries(groupAttendanceMap).map(([gid, stats]) => {
    const group = allGroups.find((g) => g.id === gid)
    return {
      groupId: gid,
      name: group?.name || 'Unknown',
      rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      present: stats.present,
      total: stats.total,
    }
  }).sort((a, b) => b.rate - a.rate)

  const mostAttended = groupRates[0] || null
  const leastAttended = groupRates.length > 1 ? groupRates[groupRates.length - 1] : null

  // ─── At-Risk Players (below 60% in last 30 days) ───
  const last30Attendance = allAttendance.filter((a) => a.session_date >= fmt(thirtyDaysAgo))
  const playerAttMap: Record<string, { present: number; total: number; lastDate: string }> = {}
  for (const a of last30Attendance) {
    if (!playerAttMap[a.player_id]) {
      playerAttMap[a.player_id] = { present: 0, total: 0, lastDate: a.session_date }
    }
    playerAttMap[a.player_id].total++
    if (a.present) {
      playerAttMap[a.player_id].present++
      if (a.session_date > playerAttMap[a.player_id].lastDate) {
        playerAttMap[a.player_id].lastDate = a.session_date
      }
    }
  }

  // Also check players with zero attendance in last 30 days but who are enrolled
  for (const enr of allEnrolments) {
    if (!playerAttMap[enr.player_id]) {
      // Find last attended date from full 90-day data
      const playerRecords = allAttendance
        .filter((a) => a.player_id === enr.player_id && a.present)
        .sort((a, b) => b.session_date.localeCompare(a.session_date))
      playerAttMap[enr.player_id] = {
        present: 0,
        total: 0,
        lastDate: playerRecords[0]?.session_date || '',
      }
    }
  }

  const atRiskPlayers = Object.entries(playerAttMap)
    .map(([pid, stats]) => {
      const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
      const player = allPlayers.find((p) => p.id === pid)
      if (!player) return null
      const daysSinceLast = stats.lastDate
        ? Math.floor((now.getTime() - new Date(stats.lastDate).getTime()) / (1000 * 60 * 60 * 24))
        : 999
      return {
        playerId: pid,
        name: `${player.first_name} ${player.last_name}`,
        parentId: player.parent_id,
        rate,
        lastDate: stats.lastDate || null,
        daysSinceLast,
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null && p.rate < 60)
    .sort((a, b) => a.rate - b.rate)

  // ─── Weekly Attendance Trend (last 12 weeks) ───
  const weeklyTrend: { week: string; rate: number; present: number; total: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() - i * 7)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekStart.getDate() - 7)
    const weekRecords = allAttendance.filter(
      (a) => a.session_date >= fmt(weekStart) && a.session_date < fmt(weekEnd)
    )
    const wPresent = weekRecords.filter((a) => a.present).length
    const wTotal = weekRecords.length
    const weekNum = Math.ceil(
      (weekEnd.getTime() - new Date(weekEnd.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
    weeklyTrend.push({
      week: `W${weekNum}`,
      rate: wTotal > 0 ? Math.round((wPresent / wTotal) * 100) : 0,
      present: wPresent,
      total: wTotal,
    })
  }

  // ─── Day-of-Week Heatmap ───
  const dayMap: Record<string, { present: number; total: number }> = {
    Mon: { present: 0, total: 0 },
    Tue: { present: 0, total: 0 },
    Wed: { present: 0, total: 0 },
    Thu: { present: 0, total: 0 },
    Fri: { present: 0, total: 0 },
    Sat: { present: 0, total: 0 },
    Sun: { present: 0, total: 0 },
  }
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  for (const a of allAttendance) {
    const dayIdx = new Date(a.session_date + 'T12:00:00').getDay()
    const dayName = dayNames[dayIdx]
    dayMap[dayName].total++
    if (a.present) dayMap[dayName].present++
  }
  const dayOfWeekData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => ({
    day: d,
    rate: dayMap[d].total > 0 ? Math.round((dayMap[d].present / dayMap[d].total) * 100) : 0,
    present: dayMap[d].present,
    total: dayMap[d].total,
  }))

  // ─── Class Comparison ───
  const classComparison = groupRates.map((g) => {
    const enrolledCount = allEnrolments.filter((e) => e.group_id === g.groupId).length
    return {
      ...g,
      enrolledCount,
    }
  })

  // ─── Recent No-Shows (last 14 days) ───
  const recentNoShows = allAttendance
    .filter((a) => !a.present && a.session_date >= fmt(fourteenDaysAgo))
    .map((a) => {
      const player = allPlayers.find((p) => p.id === a.player_id)
      const group = allGroups.find((g) => g.id === a.group_id)
      return {
        id: a.id,
        playerName: player ? `${player.first_name} ${player.last_name}` : 'Unknown',
        parentId: player?.parent_id || null,
        className: group?.name || 'Unknown',
        date: a.session_date,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50)

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance Insights</h1>
        <a
          href="/dashboard/attendance"
          className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Back to Attendance
        </a>
      </div>
      <InsightsClient
        avgRate={avgRate}
        rateTrend={rateTrend}
        thisMonthSessions={thisMonthSessions}
        mostAttended={mostAttended}
        leastAttended={leastAttended}
        atRiskPlayers={atRiskPlayers}
        weeklyTrend={weeklyTrend}
        dayOfWeekData={dayOfWeekData}
        classComparison={classComparison}
        recentNoShows={recentNoShows}
      />
    </div>
  )
}
