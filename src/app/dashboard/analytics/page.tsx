import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import BarChart from '@/components/BarChart'
import LineChart from '@/components/LineChart'
import AttendanceHeatmap from '@/components/AttendanceHeatmap'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') redirect('/dashboard')
  await requireFeature('analytics')

  const { data: orgId } = await supabase.rpc('get_my_org')

  // ── Revenue by month (last 6 months) ──
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const { data: payments } = await supabase
    .from('payments')
    .select('amount, created_at, status')
    .eq('organisation_id', orgId)
    .gte('created_at', sixMonthsAgo.toISOString())

  const revenueByMonth = new Map<string, number>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
    revenueByMonth.set(key, 0)
  }
  for (const p of payments || []) {
    if (p.status === 'failed') continue
    const d = new Date(p.created_at)
    const key = d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
    if (revenueByMonth.has(key)) {
      revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + Number(p.amount))
    }
  }
  const revenueData = Array.from(revenueByMonth.entries()).map(([label, value]) => ({
    label,
    value: Math.round(value),
  }))
  const totalRevenue = revenueData.reduce((sum, d) => sum + d.value, 0)

  // ── Player growth (cumulative by month) ──
  const { data: allPlayers } = await supabase
    .from('players')
    .select('created_at')
    .eq('organisation_id', orgId)
    .order('created_at')

  const playersByMonth = new Map<string, number>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
    playersByMonth.set(key, 0)
  }
  let cumulative = 0
  const sortedPlayers = [...(allPlayers || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  // Count players before our 6-month window
  for (const p of sortedPlayers) {
    if (new Date(p.created_at) < sixMonthsAgo) {
      cumulative++
    }
  }
  for (const [key] of playersByMonth) {
    const monthPlayers = sortedPlayers.filter((p) => {
      const d = new Date(p.created_at)
      return d.toLocaleString('en-GB', { month: 'short', year: '2-digit' }) === key
    })
    cumulative += monthPlayers.length
    playersByMonth.set(key, cumulative)
  }
  const growthData = Array.from(playersByMonth.entries()).map(([label, value]) => ({
    label,
    value,
  }))
  const totalPlayers = allPlayers?.length || 0

  // ── Attendance heatmap (by day of week) ──
  const { data: attendanceRecords } = await supabase
    .from('attendance')
    .select('session_date, present')
    .eq('organisation_id', orgId)
    .eq('present', true)
    .gte('session_date', sixMonthsAgo.toISOString().split('T')[0])

  const dayCountMap = new Map<number, number>()
  for (const a of attendanceRecords || []) {
    const dayIndex = (new Date(a.session_date).getDay() + 6) % 7 // Convert to Mon=0
    dayCountMap.set(dayIndex, (dayCountMap.get(dayIndex) || 0) + 1)
  }
  const heatmapData = Array.from({ length: 7 }, (_, i) => ({
    day: i,
    hour: 0,
    count: dayCountMap.get(i) || 0,
  }))

  // ── Active subscriptions ──
  const { count: activeSubs } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('organisation_id', orgId)
    .eq('status', 'active')

  // ── Top classes by fill rate ──
  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name, max_capacity')
    .eq('organisation_id', orgId)

  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('training_group_id, player_id')
    .eq('organisation_id', orgId)
    .eq('status', 'active')

  const enrolCountMap = new Map<string, number>()
  for (const e of enrolments || []) {
    const gid = (e as Record<string, string>).training_group_id || (e as Record<string, string>).group_id
    if (gid) enrolCountMap.set(gid, (enrolCountMap.get(gid) || 0) + 1)
  }

  const classStats = (groups || [])
    .map((g) => {
      const enrolled = enrolCountMap.get(g.id) || 0
      const capacity = g.max_capacity || 20
      return {
        name: g.name,
        enrolled,
        capacity,
        fillRate: Math.round((enrolled / capacity) * 100),
      }
    })
    .sort((a, b) => b.fillRate - a.fillRate)

  // ── Player retention rate ──
  // Players created 3+ months ago who still have an active enrolment
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const { data: oldPlayers } = await supabase
    .from('players')
    .select('id')
    .eq('organisation_id', orgId)
    .lte('created_at', threeMonthsAgo.toISOString())

  const oldPlayerIds = (oldPlayers || []).map((p) => p.id)
  let retainedCount = 0
  if (oldPlayerIds.length > 0) {
    const { data: retainedEnrolments } = await supabase
      .from('enrolments')
      .select('player_id')
      .eq('organisation_id', orgId)
      .eq('status', 'active')
      .in('player_id', oldPlayerIds)

    const uniqueRetained = new Set((retainedEnrolments || []).map((e) => e.player_id))
    retainedCount = uniqueRetained.size
  }
  const retentionRate = oldPlayerIds.length > 0
    ? Math.round((retainedCount / oldPlayerIds.length) * 100)
    : 100
  const retentionColor = retentionRate >= 80 ? '#059669' : retentionRate >= 50 ? '#f59e0b' : '#ef4444'

  // ── Churn tracking (cancelled enrolments in last 30 days) ──
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: allEnrolments } = await supabase
    .from('enrolments')
    .select('status, enrolled_at')
    .eq('organisation_id', orgId)

  const totalEnrolmentCount = (allEnrolments || []).length
  const cancelledRecent = (allEnrolments || []).filter(
    (e) => e.status === 'cancelled' && e.enrolled_at && new Date(e.enrolled_at) >= thirtyDaysAgo
  )
  // Cancelled enrolments whose enrolled_at falls within the last 30 days
  const churnCount = cancelledRecent.length
  const churnRate = totalEnrolmentCount > 0
    ? Math.round((churnCount / totalEnrolmentCount) * 100)
    : 0

  // ── Top classes by attendance rate ──
  const { data: attendanceByGroup } = await supabase
    .from('attendance')
    .select('group_id, present')
    .eq('organisation_id', orgId)
    .eq('present', true)
    .gte('session_date', sixMonthsAgo.toISOString().split('T')[0])

  const attendanceCountMap = new Map<string, number>()
  for (const a of attendanceByGroup || []) {
    const gid = a.group_id
    if (gid) attendanceCountMap.set(gid, (attendanceCountMap.get(gid) || 0) + 1)
  }

  const classAttendanceStats = (groups || [])
    .map((g) => {
      const enrolled = enrolCountMap.get(g.id) || 0
      const attended = attendanceCountMap.get(g.id) || 0
      // Attendance rate: total present marks / enrolled players (normalised)
      const attendanceRate = enrolled > 0 ? Math.round((attended / enrolled) * 100 / 6) : 0 // divided by ~6 months
      return {
        name: g.name,
        enrolled,
        attended,
        attendanceRate: Math.min(attendanceRate, 100),
      }
    })
    .sort((a, b) => b.attendanceRate - a.attendanceRate)
    .slice(0, 5)

  // ── Revenue per player ──
  const activePlayerCount = enrolments?.length
    ? new Set(enrolments.map((e) => (e as Record<string, string>).player_id)).size
    : 0
  const revenuePerPlayer = activePlayerCount > 0
    ? Math.round(totalRevenue / activePlayerCount)
    : 0

  // ── Recent signups ──
  const { data: recentPlayers } = await supabase
    .from('players')
    .select('id, full_name, created_at, enrolments(group:training_groups(name))')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(10)

  // Monthly growth %
  const lastMonth = growthData.length >= 2 ? growthData[growthData.length - 2].value : 0
  const thisMonth = growthData.length >= 1 ? growthData[growthData.length - 1].value : 0
  const monthlyGrowth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-white/40 text-sm mt-1">Track your academy&apos;s performance</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Revenue" value={`£${totalRevenue.toLocaleString()}`} sub="Last 6 months" color="#059669" />
        <MetricCard label="Total Players" value={totalPlayers.toString()} sub="All time" color="#4ecde6" />
        <MetricCard label="Active Subscriptions" value={(activeSubs || 0).toString()} sub="Current" color="#8b5cf6" />
        <MetricCard
          label="Monthly Growth"
          value={`${monthlyGrowth > 0 ? '+' : ''}${monthlyGrowth}%`}
          sub="Players"
          color={monthlyGrowth >= 0 ? '#059669' : '#ef4444'}
        />
      </div>

      {/* Retention, Churn & Revenue per player */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-5 transition-all duration-200 hover:border-[#2a2a2a]">
          <p className="text-xs font-medium text-white/40 mb-1">Player Retention</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold" style={{ color: retentionColor }}>{retentionRate}%</p>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: retentionColor + '20',
                color: retentionColor,
              }}
            >
              {retentionRate >= 80 ? 'Healthy' : retentionRate >= 50 ? 'At Risk' : 'Critical'}
            </span>
          </div>
          <p className="text-[10px] text-white/40 mt-0.5">
            {retainedCount} of {oldPlayerIds.length} players from 3+ months ago still active
          </p>
        </div>

        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-5 transition-all duration-200 hover:border-[#2a2a2a]">
          <p className="text-xs font-medium text-white/40 mb-1">Churn</p>
          <p className="text-2xl font-bold" style={{ color: churnRate > 10 ? '#ef4444' : churnRate > 5 ? '#f59e0b' : '#059669' }}>
            {churnCount} <span className="text-sm font-medium text-white/40">cancelled</span>
          </p>
          <p className="text-[10px] text-white/40 mt-0.5">
            {churnRate}% of {totalEnrolmentCount} total enrolments
          </p>
        </div>

        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-5 transition-all duration-200 hover:border-[#2a2a2a]">
          <p className="text-xs font-medium text-white/40 mb-1">Revenue per Player</p>
          <p className="text-2xl font-bold" style={{ color: '#8b5cf6' }}>
            &pound;{revenuePerPlayer.toLocaleString()}
          </p>
          <p className="text-[10px] text-white/40 mt-0.5">
            &pound;{totalRevenue.toLocaleString()} across {activePlayerCount} active players (6 mo)
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 transition-all duration-200 hover:border-[#2a2a2a]">
          <h3 className="font-bold text-white mb-1">Revenue</h3>
          <p className="text-xs text-white/40 mb-4">Monthly revenue over the last 6 months</p>
          <BarChart data={revenueData} prefix="£" barColor="#059669" />
        </div>
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 transition-all duration-200 hover:border-[#2a2a2a]">
          <h3 className="font-bold text-white mb-1">Player Growth</h3>
          <p className="text-xs text-white/40 mb-4">Cumulative player count over time</p>
          <LineChart data={growthData} lineColor="#4ecde6" />
        </div>
      </div>

      {/* Heatmap + Top Classes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 transition-all duration-200 hover:border-[#2a2a2a]">
          <h3 className="font-bold text-white mb-1">Attendance by Day</h3>
          <p className="text-xs text-white/40 mb-4">Which days are busiest</p>
          <AttendanceHeatmap data={heatmapData} />
        </div>

        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 transition-all duration-200 hover:border-[#2a2a2a]">
          <h3 className="font-bold text-white mb-1">Top Classes</h3>
          <p className="text-xs text-white/40 mb-4">Sorted by fill rate</p>
          <div className="space-y-3">
            {classStats.slice(0, 6).map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{c.name}</span>
                    <span className="text-xs text-white/40">{c.enrolled}/{c.capacity}</span>
                  </div>
                  <div className="w-full bg-white/[0.06] rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${c.fillRate}%`,
                        backgroundColor: c.fillRate >= 90 ? '#ef4444' : c.fillRate >= 70 ? '#f59e0b' : '#059669',
                      }}
                    />
                  </div>
                </div>
                <span
                  className="text-xs font-bold min-w-[36px] text-right"
                  style={{ color: c.fillRate >= 90 ? '#ef4444' : c.fillRate >= 70 ? '#f59e0b' : '#059669' }}
                >
                  {c.fillRate}%
                </span>
              </div>
            ))}
            {classStats.length === 0 && (
              <p className="text-sm text-white/40">No classes yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Classes by Attendance Rate */}
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 transition-all duration-200 hover:border-[#2a2a2a]">
        <h3 className="font-bold text-white mb-1">Top Classes by Attendance</h3>
        <p className="text-xs text-white/40 mb-4">Ranked by attendance rate over the last 6 months</p>
        <div className="space-y-3">
          {classAttendanceStats.map((c, i) => (
            <div key={c.name} className="flex items-center gap-3">
              <span className="text-xs font-bold text-white/30 min-w-[20px]">#{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{c.name}</span>
                  <span className="text-xs text-white/40">{c.attended} sessions attended</span>
                </div>
                <div className="w-full bg-white/[0.06] rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${c.attendanceRate}%`,
                      backgroundColor: c.attendanceRate >= 80 ? '#059669' : c.attendanceRate >= 50 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
              </div>
              <span
                className="text-xs font-bold min-w-[36px] text-right"
                style={{ color: c.attendanceRate >= 80 ? '#059669' : c.attendanceRate >= 50 ? '#f59e0b' : '#ef4444' }}
              >
                {c.attendanceRate}%
              </span>
            </div>
          ))}
          {classAttendanceStats.length === 0 && (
            <p className="text-sm text-white/40">No attendance data yet</p>
          )}
        </div>
      </div>

      {/* Recent Signups */}
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 transition-all duration-200 hover:border-[#2a2a2a]">
        <h3 className="font-bold text-white mb-1">Recent Signups</h3>
        <p className="text-xs text-white/40 mb-4">Last 10 players who joined</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-2 font-semibold text-white/50 text-xs uppercase">Player</th>
                <th className="text-left py-2 font-semibold text-white/50 text-xs uppercase">Group</th>
                <th className="text-right py-2 font-semibold text-white/50 text-xs uppercase">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(recentPlayers || []).map((p) => {
                const name = (p as Record<string, unknown>).full_name as string ||
                  `${(p as Record<string, unknown>).first_name || ''} ${(p as Record<string, unknown>).last_name || ''}`.trim()
                const enrols = (p as Record<string, unknown>).enrolments as Array<{ group: { name: string } | null }> | null
                const groupName = enrols?.[0]?.group?.name || '—'
                return (
                  <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2.5 font-medium text-white">{name}</td>
                    <td className="py-2.5 text-white/60">{groupName}</td>
                    <td className="py-2.5 text-right text-white/60">
                      {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
              {(!recentPlayers || recentPlayers.length === 0) && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-white/40">No players yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-5 transition-all duration-200 hover:border-[#2a2a2a]">
      <p className="text-xs font-medium text-white/40 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>
    </div>
  )
}
