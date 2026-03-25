import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BarChart from '@/components/BarChart'
import LineChart from '@/components/LineChart'
import AttendanceHeatmap from '@/components/AttendanceHeatmap'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') redirect('/dashboard')

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
    .select('session_date, status')
    .eq('organisation_id', orgId)
    .eq('status', 'present')
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
    .select('training_group_id')
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-text-light text-sm mt-1">Track your academy&apos;s performance</p>
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

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="font-bold mb-1">Revenue</h3>
          <p className="text-xs text-text-light mb-4">Monthly revenue over the last 6 months</p>
          <BarChart data={revenueData} prefix="£" barColor="#059669" />
        </div>
        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="font-bold mb-1">Player Growth</h3>
          <p className="text-xs text-text-light mb-4">Cumulative player count over time</p>
          <LineChart data={growthData} lineColor="#4ecde6" />
        </div>
      </div>

      {/* Heatmap + Top Classes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="font-bold mb-1">Attendance by Day</h3>
          <p className="text-xs text-text-light mb-4">Which days are busiest</p>
          <AttendanceHeatmap data={heatmapData} />
        </div>

        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="font-bold mb-1">Top Classes</h3>
          <p className="text-xs text-text-light mb-4">Sorted by fill rate</p>
          <div className="space-y-3">
            {classStats.slice(0, 6).map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-text-light">{c.enrolled}/{c.capacity}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
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
              <p className="text-sm text-text-light">No classes yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Signups */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h3 className="font-bold mb-1">Recent Signups</h3>
        <p className="text-xs text-text-light mb-4">Last 10 players who joined</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-semibold text-text-light">Player</th>
                <th className="text-left py-2 font-semibold text-text-light">Group</th>
                <th className="text-right py-2 font-semibold text-text-light">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(recentPlayers || []).map((p) => {
                const name = (p as Record<string, unknown>).full_name as string ||
                  `${(p as Record<string, unknown>).first_name || ''} ${(p as Record<string, unknown>).last_name || ''}`.trim()
                const enrols = (p as Record<string, unknown>).enrolments as Array<{ group: { name: string } | null }> | null
                const groupName = enrols?.[0]?.group?.name || '—'
                return (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2.5 font-medium">{name}</td>
                    <td className="py-2.5 text-text-light">{groupName}</td>
                    <td className="py-2.5 text-right text-text-light">
                      {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
              {(!recentPlayers || recentPlayers.length === 0) && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-text-light">No players yet</td>
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
    <div className="bg-white rounded-2xl border border-border p-5">
      <p className="text-xs font-medium text-text-light mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-text-light mt-0.5">{sub}</p>
    </div>
  )
}
