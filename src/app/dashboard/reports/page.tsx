import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import type { UserRole } from '@/lib/types'
import RevenueChart from './RevenueChart'
import GrowthChart from './GrowthChart'

export default async function ReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  if (role === 'parent') redirect('/dashboard')

  // ─── Gather all stats ───
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, age_group, parent_id, position, created_at')

  const { data: attendance } = await supabase
    .from('attendance')
    .select('player_id, present, session_date')

  const { data: payments } = await supabase
    .from('payments')
    .select('parent_id, amount, amount_paid, status, created_at, paid_date, due_date')

  const { data: reviews } = await supabase
    .from('progress_reviews')
    .select('player_id, attitude, effort, technical_quality, game_understanding, confidence, physical_movement, review_date')

  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name')

  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('player_id, group_id, status, enrolled_at')
    .eq('status', 'active')

  const { data: parents } = await supabase
    .from('profiles')
    .select('id, full_name, created_at')
    .eq('role', 'parent')

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status, created_at, plan:subscription_plans(amount)')

  // ─── Attendance Report ───
  const playerAttendance = (players || []).map((p) => {
    const records = (attendance || []).filter((a) => a.player_id === p.id)
    const total = records.length
    const present = records.filter((a) => a.present).length
    const rate = total > 0 ? Math.round((present / total) * 100) : 0
    return { ...p, total, present, absent: total - present, rate }
  }).sort((a, b) => b.rate - a.rate)

  // ─── Payment Summary ───
  const totalDue = (payments || []).reduce((s, p) => s + Number(p.amount), 0)
  const totalCollected = (payments || []).reduce((s, p) => s + Number(p.amount_paid || 0), 0)
  const totalOutstanding = totalDue - totalCollected
  const overduePayments = (payments || []).filter((p) => p.status === 'overdue')
  const overdueAmount = overduePayments.reduce((s, p) => s + (Number(p.amount) - Number(p.amount_paid || 0)), 0)

  // ─── Revenue by Month (last 6 months) ───
  const monthlyRevenue: { label: string; collected: number; due: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const monthLabel = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const monthPayments = (payments || []).filter((p) => {
      const created = p.created_at?.substring(0, 7)
      return created === monthStr
    })

    const collected = monthPayments.reduce((s, p) => s + Number(p.amount_paid || 0), 0)
    const due = monthPayments.reduce((s, p) => s + Number(p.amount), 0)

    // Add subscription revenue
    const activeSubs = (subscriptions || []).filter((s) => s.status === 'active')
    const subRevenue = activeSubs.reduce((sum, s) => {
      const plan = s.plan as unknown as { amount: number } | null
      return sum + (plan ? Number(plan.amount) : 0)
    }, 0)

    monthlyRevenue.push({
      label: monthLabel,
      collected: collected + (i === 0 ? subRevenue : 0), // Only add sub revenue to current month
      due: due + (i === 0 ? subRevenue : 0),
    })
  }

  // ─── Player Growth (last 6 months) ───
  const playerGrowth: { label: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString()
    const count = (players || []).filter((p) => p.created_at && p.created_at <= monthEnd).length
    playerGrowth.push({
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
      value: count,
    })
  }

  // Per-parent payment summary
  const parentPayments = (parents || []).map((parent) => {
    const pPayments = (payments || []).filter((p) => p.parent_id === parent.id)
    const due = pPayments.reduce((s, p) => s + Number(p.amount), 0)
    const paid = pPayments.reduce((s, p) => s + Number(p.amount_paid || 0), 0)
    return { ...parent, due, paid, outstanding: due - paid, hasOverdue: pPayments.some((p) => p.status === 'overdue') }
  }).filter((p) => p.due > 0).sort((a, b) => b.outstanding - a.outstanding)

  // ─── Group Sizes ───
  const groupStats = (groups || []).map((g) => {
    const count = (enrolments || []).filter((e) => e.group_id === g.id).length
    return { ...g, count }
  }).sort((a, b) => b.count - a.count)

  // ─── Average Scores ───
  const scoreCategories = ['attitude', 'effort', 'technical_quality', 'game_understanding', 'confidence', 'physical_movement'] as const
  const playerScores = (players || []).map((p) => {
    const pReviews = (reviews || []).filter((r) => r.player_id === p.id)
    if (pReviews.length === 0) return null
    const latestReview = pReviews.sort((a, b) => b.review_date.localeCompare(a.review_date))[0]
    const avg = scoreCategories.reduce((sum, cat) => sum + Number(latestReview[cat]), 0) / scoreCategories.length
    return { ...p, avg: Math.round(avg * 10) / 10, reviewCount: pReviews.length }
  }).filter(Boolean).sort((a, b) => (b?.avg || 0) - (a?.avg || 0)) as Array<{ first_name: string; last_name: string; avg: number; reviewCount: number }>

  // ─── Subscription Stats ───
  const activeSubs = (subscriptions || []).filter((s) => s.status === 'active')
  const monthlyRecurring = activeSubs.reduce((sum, s) => {
    const plan = s.plan as unknown as { amount: number } | null
    return sum + (plan ? Number(plan.amount) : 0)
  }, 0)

  // ─── Attendance rate over time ───
  const attendanceOverTime: { label: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthRecords = (attendance || []).filter((a) => a.session_date?.substring(0, 7) === monthStr)
    const total = monthRecords.length
    const present = monthRecords.filter((a) => a.present).length
    const rate = total > 0 ? Math.round((present / total) * 100) : 0
    attendanceOverTime.push({
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
      value: rate,
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports & Analytics</h1>

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{(players || []).length}</div>
            <div className="text-xs text-text-light">Total Players</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">&pound;{totalCollected.toFixed(0)}</div>
            <div className="text-xs text-text-light">Collected</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-warning' : 'text-accent'}`}>&pound;{totalOutstanding.toFixed(0)}</div>
            <div className="text-xs text-text-light">Outstanding</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className={`text-2xl font-bold ${overdueAmount > 0 ? 'text-danger' : 'text-accent'}`}>&pound;{overdueAmount.toFixed(0)}</div>
            <div className="text-xs text-text-light">Overdue</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">&pound;{monthlyRecurring.toFixed(0)}</div>
            <div className="text-xs text-text-light">Monthly Recurring</div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Revenue (Last 6 Months)">
          <RevenueChart months={monthlyRevenue} />
        </Card>

        <Card title="Growth Trends">
          <div className="space-y-6">
            <GrowthChart data={playerGrowth} title="Player Growth" />
            <GrowthChart data={attendanceOverTime} title="Attendance Rate %" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Report */}
        <Card title="Attendance by Player">
          {playerAttendance.length === 0 ? (
            <p className="text-sm text-text-light">No attendance data yet.</p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-surface-dark">
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 font-medium">Player</th>
                    <th className="text-center py-1.5 font-medium">Sessions</th>
                    <th className="text-center py-1.5 font-medium">Present</th>
                    <th className="text-center py-1.5 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {playerAttendance.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-1.5">{p.first_name} {p.last_name}</td>
                      <td className="py-1.5 text-center">{p.total}</td>
                      <td className="py-1.5 text-center">{p.present}</td>
                      <td className="py-1.5 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-12 bg-surface-dark rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${p.rate >= 80 ? 'bg-accent' : p.rate >= 50 ? 'bg-warning' : 'bg-danger'}`}
                              style={{ width: `${p.rate}%` }}
                            />
                          </div>
                          <span className={`font-medium ${p.rate >= 80 ? 'text-accent' : p.rate >= 50 ? 'text-warning' : 'text-danger'}`}>
                            {p.rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Payment Report by Parent */}
        <Card title="Payments by Family">
          {parentPayments.length === 0 ? (
            <p className="text-sm text-text-light">No payment data yet.</p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-surface-dark">
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 font-medium">Parent</th>
                    <th className="text-right py-1.5 font-medium">Due</th>
                    <th className="text-right py-1.5 font-medium">Paid</th>
                    <th className="text-right py-1.5 font-medium">Owed</th>
                  </tr>
                </thead>
                <tbody>
                  {parentPayments.map((p) => (
                    <tr key={p.id} className={`border-b border-border last:border-0 ${p.hasOverdue ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                      <td className="py-1.5">
                        {p.full_name}
                        {p.hasOverdue && <span className="text-xs text-danger ml-1">OVERDUE</span>}
                      </td>
                      <td className="py-1.5 text-right">&pound;{p.due.toFixed(0)}</td>
                      <td className="py-1.5 text-right text-accent">&pound;{p.paid.toFixed(0)}</td>
                      <td className="py-1.5 text-right font-medium">
                        <span className={p.outstanding > 0 ? 'text-warning' : 'text-accent'}>
                          &pound;{p.outstanding.toFixed(0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Group Sizes */}
        <Card title="Group Sizes">
          {groupStats.length === 0 ? (
            <p className="text-sm text-text-light">No groups yet.</p>
          ) : (
            <div className="space-y-2">
              {groupStats.map((g) => (
                <div key={g.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{g.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-surface-dark rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, (g.count / Math.max(...groupStats.map((gs) => gs.count), 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-primary w-8 text-right">{g.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Player Scores */}
        <Card title="Player Scores (Latest Review)">
          {playerScores.length === 0 ? (
            <p className="text-sm text-text-light">No reviews yet.</p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-surface-dark">
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 font-medium">Player</th>
                    <th className="text-center py-1.5 font-medium">Avg Score</th>
                    <th className="text-center py-1.5 font-medium">Reviews</th>
                  </tr>
                </thead>
                <tbody>
                  {playerScores.map((p, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-1.5">{p.first_name} {p.last_name}</td>
                      <td className="py-1.5 text-center">
                        <span className={`font-bold ${p.avg >= 4 ? 'text-accent' : p.avg >= 3 ? 'text-primary' : 'text-warning'}`}>
                          {p.avg}
                        </span>
                      </td>
                      <td className="py-1.5 text-center text-text-light">{p.reviewCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
