import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import BarChart from '@/components/BarChart'
import LineChart from '@/components/LineChart'
import AttendanceHeatmap from '@/components/AttendanceHeatmap'
import RevenueForecast from '@/components/RevenueForecast'

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

  // ── MRR forecast — same logic as the home-page widget ──
  const { count: activeSubCount } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('organisation_id', orgId)
    .eq('status', 'active')

  const { data: subForecastRows } = await supabase
    .from('subscriptions')
    .select('status, plan:subscription_plans(amount, interval)')
    .eq('organisation_id', orgId)
    .in('status', ['active', 'past_due', 'trialing'])

  let forecastMrr = 0
  let forecastAtRiskMrr = 0
  let forecastAtRiskCount = 0
  let forecastTrialingMrr = 0
  let forecastTrialingCount = 0
  for (const row of subForecastRows || []) {
    const plan = row.plan as unknown as { amount: number | string; interval?: string } | null
    if (!plan) continue
    const amount = Number(plan.amount) || 0
    const monthly = plan.interval === 'year' ? amount / 12 : amount
    if (row.status === 'active') forecastMrr += monthly
    else if (row.status === 'past_due') {
      forecastAtRiskMrr += monthly
      forecastAtRiskCount += 1
    } else if (row.status === 'trialing') {
      forecastTrialingMrr += monthly
      forecastTrialingCount += 1
    }
  }
  const forecastArr = forecastMrr * 12

  // Fetch org slug for the empty-state CTA
  const { data: orgDataForForecast } = await supabase
    .from('organisations')
    .select('slug')
    .eq('id', orgId)
    .single()
  const forecastBookingSlug = orgDataForForecast?.slug as string | undefined

  // ── Top classes by fill rate ──
  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name, max_capacity, coach_id, day_of_week, time_slot')
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

  // ════════════════════════════════════════════════════════════════════
  // TIER 7 ANALYTICS — added 2026-05-26
  // ════════════════════════════════════════════════════════════════════

  // ── T7.1 Coach activity dashboard ──
  // For each coach: reviews completed (90d), unique players scored, attendance rate of their groups (180d)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const oneEightyDaysAgo = new Date()
  oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180)

  const { data: coaches } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('organisation_id', orgId)
    .in('role', ['coach', 'admin'])

  const { data: coachReviews } = await supabase
    .from('progress_reviews')
    .select('coach_id, player_id, review_date')
    .eq('organisation_id', orgId)
    .gte('review_date', ninetyDaysAgo.toISOString().split('T')[0])

  // Map of group_id → coach_id (groups owned by a coach)
  const groupCoachMap = new Map<string, string>()
  for (const g of (groups || []) as Array<{ id: string; coach_id?: string }>) {
    if (g.coach_id) groupCoachMap.set(g.id, g.coach_id)
  }

  const { data: coachAttendance } = await supabase
    .from('attendance')
    .select('group_id, present')
    .eq('organisation_id', orgId)
    .gte('session_date', oneEightyDaysAgo.toISOString().split('T')[0])

  const coachReviewCount = new Map<string, number>()
  const coachPlayersScored = new Map<string, Set<string>>()
  for (const r of coachReviews || []) {
    coachReviewCount.set(r.coach_id, (coachReviewCount.get(r.coach_id) || 0) + 1)
    if (!coachPlayersScored.has(r.coach_id)) coachPlayersScored.set(r.coach_id, new Set())
    coachPlayersScored.get(r.coach_id)!.add(r.player_id)
  }

  const coachAttendTotal = new Map<string, number>()
  const coachAttendPresent = new Map<string, number>()
  for (const a of coachAttendance || []) {
    const cid = groupCoachMap.get(a.group_id)
    if (!cid) continue
    coachAttendTotal.set(cid, (coachAttendTotal.get(cid) || 0) + 1)
    if (a.present) coachAttendPresent.set(cid, (coachAttendPresent.get(cid) || 0) + 1)
  }

  const coachStats = (coaches || [])
    .map((c) => {
      const reviews = coachReviewCount.get(c.id) || 0
      const playersScored = coachPlayersScored.get(c.id)?.size || 0
      const total = coachAttendTotal.get(c.id) || 0
      const present = coachAttendPresent.get(c.id) || 0
      const rate = total > 0 ? Math.round((present / total) * 100) : null
      return {
        id: c.id,
        name: c.full_name,
        role: c.role,
        reviews,
        playersScored,
        attendanceRate: rate,
        attendanceSampleSize: total,
      }
    })
    .sort((a, b) => b.reviews - a.reviews)

  // ── T7.2 Class fill rate heatmap ──
  // 7×4 grid of (day_of_week × time-of-day bucket) showing average fill % across classes that occupy that cell
  const TIME_BUCKETS = [
    { key: 'morning', label: 'AM', range: [6, 12] as [number, number] },
    { key: 'lunch', label: 'Lunch', range: [12, 15] as [number, number] },
    { key: 'afternoon', label: 'Afternoon', range: [15, 18] as [number, number] },
    { key: 'evening', label: 'Evening', range: [18, 22] as [number, number] },
  ]
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  function parseHourFromTimeSlot(slot: string | null | undefined): number | null {
    if (!slot) return null
    const m = slot.match(/(\d{1,2})(?::(\d{2}))?/)
    if (!m) return null
    const h = parseInt(m[1], 10)
    return Number.isFinite(h) ? h : null
  }
  function bucketForHour(h: number): number {
    for (let i = 0; i < TIME_BUCKETS.length; i++) {
      const [lo, hi] = TIME_BUCKETS[i].range
      if (h >= lo && h < hi) return i
    }
    return -1
  }

  type HeatCell = { fillSum: number; count: number; classes: Array<{ name: string; fill: number }> }
  const heatGrid: HeatCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: TIME_BUCKETS.length }, () => ({ fillSum: 0, count: 0, classes: [] }))
  )

  for (const g of (groups || []) as Array<{ id: string; name: string; max_capacity?: number; day_of_week?: string; time_slot?: string }>) {
    const dayKey = (g.day_of_week || '').toLowerCase()
    const dayIdx = DAY_KEYS.indexOf(dayKey)
    if (dayIdx < 0) continue
    const hour = parseHourFromTimeSlot(g.time_slot)
    if (hour == null) continue
    const bucketIdx = bucketForHour(hour)
    if (bucketIdx < 0) continue
    const enrolled = enrolCountMap.get(g.id) || 0
    const capacity = g.max_capacity || 20
    const fill = Math.round((enrolled / capacity) * 100)
    const cell = heatGrid[dayIdx][bucketIdx]
    cell.fillSum += fill
    cell.count += 1
    cell.classes.push({ name: g.name, fill })
  }

  // ── T7.3 Parent engagement scoring ──
  // Heuristic score 0–100 based on signals we already have. Real login tracking would require
  // querying auth.users.last_sign_in_at via a service-role function — left for later.
  const { data: parentRows } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at')
    .eq('organisation_id', orgId)
    .eq('role', 'parent')

  const parentIds = (parentRows || []).map((p) => p.id)

  const { data: parentChildren } = parentIds.length > 0
    ? await supabase
        .from('players')
        .select('id, parent_id')
        .in('parent_id', parentIds)
    : { data: [] }

  const childrenByParent = new Map<string, string[]>()
  for (const c of parentChildren || []) {
    if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, [])
    childrenByParent.get(c.parent_id)!.push(c.id)
  }

  // Recent attendance for these children
  const allChildIds = (parentChildren || []).map((c) => c.id)
  const thirtyDaysAgoIso = new Date()
  thirtyDaysAgoIso.setDate(thirtyDaysAgoIso.getDate() - 30)
  const { data: recentAttendance } = allChildIds.length > 0
    ? await supabase
        .from('attendance')
        .select('player_id, present, session_date')
        .in('player_id', allChildIds)
        .gte('session_date', thirtyDaysAgoIso.toISOString().split('T')[0])
    : { data: [] }

  const attendByChild = new Map<string, { total: number; present: number }>()
  for (const a of recentAttendance || []) {
    if (!attendByChild.has(a.player_id)) attendByChild.set(a.player_id, { total: 0, present: 0 })
    const rec = attendByChild.get(a.player_id)!
    rec.total += 1
    if (a.present) rec.present += 1
  }

  // Active enrolments per parent's child
  const enrolmentByChild = new Map<string, string[]>()
  for (const e of enrolments || []) {
    const pid = (e as Record<string, string>).player_id
    if (!pid) continue
    if (!enrolmentByChild.has(pid)) enrolmentByChild.set(pid, [])
    enrolmentByChild.get(pid)!.push(((e as Record<string, string>).training_group_id || (e as Record<string, string>).group_id) || '')
  }

  // Subscriptions by parent
  const { data: parentSubsRows } = parentIds.length > 0
    ? await supabase
        .from('subscriptions')
        .select('parent_id, status')
        .eq('organisation_id', orgId)
        .in('parent_id', parentIds)
    : { data: [] }

  const subsByParent = new Map<string, string[]>()
  for (const s of parentSubsRows || []) {
    const pid = (s as Record<string, string>).parent_id
    if (!pid) continue
    if (!subsByParent.has(pid)) subsByParent.set(pid, [])
    subsByParent.get(pid)!.push(s.status)
  }

  const parentEngagement = (parentRows || []).map((p) => {
    const children = childrenByParent.get(p.id) || []
    const childCount = children.length
    let score = 30 // baseline for existing on the platform
    const reasons: string[] = []

    // Subscription health
    const subs = subsByParent.get(p.id) || []
    const hasActive = subs.includes('active') || subs.includes('trialing')
    const hasPastDue = subs.includes('past_due')
    if (hasActive) { score += 30; reasons.push('Active sub') }
    if (hasPastDue) { score -= 25; reasons.push('Payment issue') }
    if (!hasActive && !hasPastDue && subs.length === 0 && childCount > 0) {
      score -= 15
      reasons.push('No subscription')
    }

    // Recent attendance — most reliable engagement signal
    let attendTotal = 0
    let attendPresent = 0
    for (const cid of children) {
      const a = attendByChild.get(cid)
      if (!a) continue
      attendTotal += a.total
      attendPresent += a.present
    }
    if (attendTotal > 0) {
      const rate = attendPresent / attendTotal
      if (rate >= 0.85) { score += 25; reasons.push(`${Math.round(rate*100)}% attendance`) }
      else if (rate >= 0.5) { score += 10; reasons.push(`${Math.round(rate*100)}% attendance`) }
      else { score -= 20; reasons.push(`Only ${Math.round(rate*100)}% attendance`) }
    } else if (childCount > 0 && hasActive) {
      score -= 10
      reasons.push('No recent attendance')
    }

    // Multiple children = stickier
    if (childCount >= 2) { score += 10; reasons.push(`${childCount} children`) }

    score = Math.max(0, Math.min(100, score))
    let band: 'champion' | 'engaged' | 'at_risk' | 'churning'
    if (score >= 75) band = 'champion'
    else if (score >= 50) band = 'engaged'
    else if (score >= 25) band = 'at_risk'
    else band = 'churning'

    return { id: p.id, name: p.full_name, email: p.email, score, band, reasons, childCount }
  })

  const engagementCounts = {
    champion: parentEngagement.filter((p) => p.band === 'champion').length,
    engaged: parentEngagement.filter((p) => p.band === 'engaged').length,
    at_risk: parentEngagement.filter((p) => p.band === 'at_risk').length,
    churning: parentEngagement.filter((p) => p.band === 'churning').length,
  }
  // Surface the at-risk parents prominently — these are the churn candidates
  const atRiskParents = parentEngagement
    .filter((p) => p.band === 'at_risk' || p.band === 'churning')
    .sort((a, b) => a.score - b.score)
    .slice(0, 8)

  // ── T7.4 Funnel analytics ──
  // Real page-view tracking would need an events table. For now, we approximate from existing data:
  //   Step 1: Parent signed up (profiles.role='parent')
  //   Step 2: Added at least one child (players exists with parent_id)
  //   Step 3: At least one enrolment for any of their children
  //   Step 4: Active or trialing subscription
  // Window: last 60 days.
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const recentParents = (parentRows || []).filter(
    (p) => new Date(p.created_at) >= sixtyDaysAgo
  )

  let funnel_signups = recentParents.length
  let funnel_added_child = 0
  let funnel_enrolled = 0
  let funnel_subscribed = 0

  for (const p of recentParents) {
    const childIds = childrenByParent.get(p.id) || []
    if (childIds.length > 0) {
      funnel_added_child++
      const hasEnrolment = childIds.some((cid) => (enrolmentByChild.get(cid)?.length || 0) > 0)
      if (hasEnrolment) {
        funnel_enrolled++
        const subs = subsByParent.get(p.id) || []
        if (subs.includes('active') || subs.includes('trialing')) {
          funnel_subscribed++
        }
      }
    }
  }
  const funnelSteps = [
    { label: 'Signed up', count: funnel_signups, color: '#4ecde6' },
    { label: 'Added a child', count: funnel_added_child, color: '#8b5cf6' },
    { label: 'Booked a class', count: funnel_enrolled, color: '#f59e0b' },
    { label: 'Subscribed', count: funnel_subscribed, color: '#059669' },
  ]

  // ── T7.5 Cohort retention ──
  // Group parents by signup month for the last 6 months. For each cohort, calculate retention
  // at month-0, month-1, ... month-5 where "retained" = has at least one active enrolment
  // OR an active/trialing subscription in that month.
  function monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  function monthLabel(d: Date): string {
    return d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
  }

  const cohortMonths: { key: string; label: string; date: Date }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    cohortMonths.push({ key: monthKey(d), label: monthLabel(d), date: new Date(d) })
  }

  // Build parents-by-cohort-month
  const parentsByCohort = new Map<string, string[]>()
  for (const p of parentRows || []) {
    const k = monthKey(new Date(p.created_at))
    if (!parentsByCohort.has(k)) parentsByCohort.set(k, [])
    parentsByCohort.get(k)!.push(p.id)
  }

  // Pull all enrolments with created_at for retention computation
  const { data: cohortEnrolments } = await supabase
    .from('enrolments')
    .select('player_id, status, enrolled_at')
    .eq('organisation_id', orgId)

  // Map child → parent
  const parentOfChild = new Map<string, string>()
  for (const c of parentChildren || []) {
    parentOfChild.set(c.id, c.parent_id)
  }

  // For each cohort × each subsequent month, count parents who were "active" that month.
  // Active = had at least one enrolment created on or before that month's end and not cancelled before its start.
  // (Heuristic; without a proper monthly snapshot table this is the best signal we have.)
  type CohortRow = { cohortKey: string; label: string; size: number; retention: (number | null)[] }
  const cohortRows: CohortRow[] = cohortMonths.map((cohort) => {
    const cohortParentIds = parentsByCohort.get(cohort.key) || []
    const size = cohortParentIds.length
    const retention: (number | null)[] = []

    for (let monthOffset = 0; monthOffset < cohortMonths.length; monthOffset++) {
      const targetIdx = cohortMonths.findIndex((c) => c.key === cohort.key) + monthOffset
      if (targetIdx >= cohortMonths.length || size === 0) {
        retention.push(null)
        continue
      }
      const targetMonth = cohortMonths[targetIdx].date
      const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0)

      let activeThisMonth = 0
      for (const pid of cohortParentIds) {
        const childIds = childrenByParent.get(pid) || []
        // Check if any child had an enrolment that was active during target month
        const wasActive = childIds.some((cid) => {
          const enrols = (cohortEnrolments || []).filter((e) => e.player_id === cid)
          return enrols.some((e) => {
            if (!e.enrolled_at) return false
            const enrolDate = new Date(e.enrolled_at)
            if (enrolDate > monthEnd) return false
            // If cancelled, we don't know when so we assume cancellation already happened
            // for any enrolment whose status is cancelled and target month is the most recent
            // Simpler: count if status is active OR if status=cancelled but only at the cohort month and the month right after
            if (e.status === 'cancelled') {
              return monthOffset === 0
            }
            return true
          })
        })
        if (wasActive) activeThisMonth++
      }
      retention.push(size > 0 ? Math.round((activeThisMonth / size) * 100) : 0)
    }
    return { cohortKey: cohort.key, label: cohort.label, size, retention }
  })

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-white/40 text-sm mt-1">Track your academy&apos;s performance</p>
      </div>

      {/* Recurring revenue forecast — true MRR (not what landed in the bank). */}
      <RevenueForecast
        mrr={forecastMrr}
        arr={forecastArr}
        activeSubs={activeSubCount || 0}
        atRiskMrr={forecastAtRiskMrr}
        atRiskCount={forecastAtRiskCount}
        trialingCount={forecastTrialingCount}
        trialingMrr={forecastTrialingMrr}
        bookingSlug={forecastBookingSlug}
      />

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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TIER 7 ANALYTICS — Coach activity, fill-rate heatmap,        */}
      {/* engagement scoring, funnel, cohort retention                  */}
      {/* ═══════════════════════════════════════════════════════════ */}

      <div className="pt-2 border-t border-white/[0.06]">
        <h2 className="text-lg font-bold text-white mb-1">Deep Insights</h2>
        <p className="text-xs text-white/40">
          The signals you need to spot rockstars, plug leaks, and predict churn before it happens
        </p>
      </div>

      {/* T7.1 — Coach activity dashboard */}
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 transition-all duration-200 hover:border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-white">Coach Activity</h3>
          <span className="text-[10px] uppercase tracking-wider text-white/40">Last 90 days</span>
        </div>
        <p className="text-xs text-white/40 mb-4">Reviews completed, unique players scored, and attendance rate of their groups</p>
        {coachStats.length === 0 ? (
          <p className="text-sm text-white/40">No coaches yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 font-semibold text-white/50 text-xs uppercase">Coach</th>
                  <th className="text-left py-2 font-semibold text-white/50 text-xs uppercase">Role</th>
                  <th className="text-right py-2 font-semibold text-white/50 text-xs uppercase">Reviews</th>
                  <th className="text-right py-2 font-semibold text-white/50 text-xs uppercase">Players</th>
                  <th className="text-right py-2 font-semibold text-white/50 text-xs uppercase">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {coachStats.map((c) => {
                  const isRockstar = c.reviews >= 10
                  const rateColor = c.attendanceRate == null
                    ? '#64748b'
                    : c.attendanceRate >= 80 ? '#059669'
                    : c.attendanceRate >= 60 ? '#f59e0b'
                    : '#ef4444'
                  return (
                    <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-2.5 font-medium text-white">
                        {isRockstar && <span className="mr-1.5">⭐</span>}
                        {c.name}
                      </td>
                      <td className="py-2.5 text-white/60 capitalize">{c.role}</td>
                      <td className="py-2.5 text-right font-semibold text-white">{c.reviews}</td>
                      <td className="py-2.5 text-right text-white/80">{c.playersScored}</td>
                      <td className="py-2.5 text-right font-semibold" style={{ color: rateColor }}>
                        {c.attendanceRate == null ? '—' : `${c.attendanceRate}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* T7.2 — Class fill rate heatmap */}
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 transition-all duration-200 hover:border-[#2a2a2a]">
        <h3 className="font-bold text-white mb-1">Class Fill Rate Heatmap</h3>
        <p className="text-xs text-white/40 mb-4">Average fill % across all classes that run in each slot — empty cells = no class scheduled</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="py-2 pr-3 text-left font-semibold text-white/50 uppercase tracking-wider"></th>
                {TIME_BUCKETS.map((b) => (
                  <th key={b.key} className="py-2 px-1 text-center font-semibold text-white/50 uppercase tracking-wider">
                    {b.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((dayLabel, dayIdx) => (
                <tr key={dayLabel}>
                  <td className="py-1 pr-3 font-semibold text-white/60 text-right">{dayLabel}</td>
                  {TIME_BUCKETS.map((b, bIdx) => {
                    const cell = heatGrid[dayIdx][bIdx]
                    if (cell.count === 0) {
                      return (
                        <td key={b.key} className="p-1">
                          <div className="h-10 rounded-md bg-white/[0.02] border border-dashed border-white/[0.04]" />
                        </td>
                      )
                    }
                    const avg = Math.round(cell.fillSum / cell.count)
                    const bg = avg >= 90 ? 'rgba(239,68,68,0.65)'
                      : avg >= 70 ? 'rgba(245,158,11,0.65)'
                      : avg >= 40 ? 'rgba(5,150,105,0.65)'
                      : 'rgba(78,205,230,0.35)'
                    return (
                      <td key={b.key} className="p-1">
                        <div
                          className="h-10 rounded-md flex items-center justify-center font-bold text-white text-sm"
                          style={{ background: bg }}
                          title={cell.classes.map((c) => `${c.name}: ${c.fill}%`).join('\n')}
                        >
                          {avg}%
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-4 mt-4 text-[10px] text-white/40">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'rgba(78,205,230,0.35)' }} />Underfilled (&lt;40%)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'rgba(5,150,105,0.65)' }} />Healthy (40-70%)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'rgba(245,158,11,0.65)' }} />Filling up (70-90%)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'rgba(239,68,68,0.65)' }} />Nearly full (90%+)</span>
        </div>
      </div>

      {/* T7.3 — Parent engagement scoring + at-risk list */}
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 transition-all duration-200 hover:border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-white">Parent Engagement</h3>
          <span className="text-[10px] uppercase tracking-wider text-white/40">Heuristic 0–100</span>
        </div>
        <p className="text-xs text-white/40 mb-4">Based on sub status, recent attendance, and child count — at-risk parents are your churn candidates</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">{engagementCounts.champion}</div>
            <div className="text-[10px] text-white/60 mt-0.5 uppercase tracking-wider">Champions</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">{engagementCounts.engaged}</div>
            <div className="text-[10px] text-white/60 mt-0.5 uppercase tracking-wider">Engaged</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{engagementCounts.at_risk}</div>
            <div className="text-[10px] text-white/60 mt-0.5 uppercase tracking-wider">At Risk</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{engagementCounts.churning}</div>
            <div className="text-[10px] text-white/60 mt-0.5 uppercase tracking-wider">Churning</div>
          </div>
        </div>

        {atRiskParents.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Reach Out — Lowest Scores First</p>
            <div className="space-y-2">
              {atRiskParents.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{
                      background: p.band === 'churning' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: p.band === 'churning' ? '#fca5a5' : '#fcd34d',
                    }}
                  >
                    {p.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.name}</p>
                    <p className="text-xs text-white/50 truncate">{p.email}</p>
                  </div>
                  <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-[50%]">
                    {p.reasons.slice(0, 3).map((r, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/60 whitespace-nowrap"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* T7.4 — Funnel analytics */}
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 transition-all duration-200 hover:border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-white">Signup Funnel</h3>
          <span className="text-[10px] uppercase tracking-wider text-white/40">Last 60 days</span>
        </div>
        <p className="text-xs text-white/40 mb-5">Drop-off at each step — find your leaks</p>
        {funnelSteps[0].count === 0 ? (
          <p className="text-sm text-white/40">No new signups in the last 60 days</p>
        ) : (
          <div className="space-y-3">
            {funnelSteps.map((step, i) => {
              const pctOfFirst = funnelSteps[0].count > 0 ? (step.count / funnelSteps[0].count) * 100 : 0
              const prevCount = i === 0 ? null : funnelSteps[i - 1].count
              const dropoffPct = prevCount && prevCount > 0
                ? Math.round(((prevCount - step.count) / prevCount) * 100)
                : null
              return (
                <div key={step.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-white">{step.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-white">{step.count}</span>
                      {dropoffPct != null && dropoffPct > 0 && (
                        <span className="text-red-400">−{dropoffPct}%</span>
                      )}
                    </div>
                  </div>
                  <div className="h-3 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pctOfFirst}%`,
                        background: step.color,
                        boxShadow: `0 0 12px ${step.color}40`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
            <div className="pt-3 mt-2 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-white/40 uppercase tracking-wider text-[10px]">Signup → child</p>
                <p className="font-bold text-white text-sm mt-0.5">
                  {funnel_signups > 0 ? Math.round((funnel_added_child / funnel_signups) * 100) : 0}%
                </p>
              </div>
              <div>
                <p className="text-white/40 uppercase tracking-wider text-[10px]">Child → enrolment</p>
                <p className="font-bold text-white text-sm mt-0.5">
                  {funnel_added_child > 0 ? Math.round((funnel_enrolled / funnel_added_child) * 100) : 0}%
                </p>
              </div>
              <div>
                <p className="text-white/40 uppercase tracking-wider text-[10px]">Enrolment → subscribed</p>
                <p className="font-bold text-white text-sm mt-0.5">
                  {funnel_enrolled > 0 ? Math.round((funnel_subscribed / funnel_enrolled) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* T7.5 — Cohort retention */}
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 transition-all duration-200 hover:border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-white">Cohort Retention</h3>
          <span className="text-[10px] uppercase tracking-wider text-white/40">Last 6 months</span>
        </div>
        <p className="text-xs text-white/40 mb-4">% of parents from each signup month who were still active in subsequent months</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="py-2 px-2 text-left font-semibold text-white/50 uppercase tracking-wider">Cohort</th>
                <th className="py-2 px-2 text-center font-semibold text-white/50 uppercase tracking-wider">Size</th>
                {cohortMonths.map((_, i) => (
                  <th key={i} className="py-2 px-2 text-center font-semibold text-white/50 uppercase tracking-wider">
                    M{i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohortRows.map((row) => (
                <tr key={row.cohortKey} className="border-t border-white/[0.04]">
                  <td className="py-2 px-2 font-medium text-white">{row.label}</td>
                  <td className="py-2 px-2 text-center text-white/60">{row.size || '—'}</td>
                  {row.retention.map((v, i) => {
                    if (v == null) {
                      return <td key={i} className="py-2 px-1"><div className="h-8 rounded bg-white/[0.02]" /></td>
                    }
                    const bg = v >= 80 ? 'rgba(5,150,105,0.55)'
                      : v >= 50 ? 'rgba(245,158,11,0.55)'
                      : v >= 20 ? 'rgba(239,68,68,0.45)'
                      : 'rgba(239,68,68,0.7)'
                    return (
                      <td key={i} className="py-2 px-1">
                        <div
                          className="h-8 rounded flex items-center justify-center font-bold text-white text-xs"
                          style={{ background: bg }}
                        >
                          {v}%
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {cohortRows.every((r) => r.size === 0) && (
                <tr>
                  <td colSpan={cohortMonths.length + 2} className="py-6 text-center text-white/40">
                    No cohort data yet — parents need to sign up over multiple months for this table to populate
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-white/30 mt-3">
          M0 = signup month, M1 = one month later, etc. &quot;Active&quot; means at least one non-cancelled enrolment for any of the parent&apos;s children.
        </p>
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
