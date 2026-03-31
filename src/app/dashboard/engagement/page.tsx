import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'
import EngagementPage from './EngagementPage'
import AdminEngagement from './AdminEngagement'

export default async function EngagementRoute() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, organisation_id, phone, address, secondary_contact_name, secondary_contact_phone')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole

  if (role === 'admin' || role === 'coach') {
    const orgId = profile?.organisation_id || ''

    // Fetch all parents with their engagement data
    const { data: parents } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .eq('organisation_id', orgId)
      .eq('role', 'parent')

    const parentIds = (parents || []).map(p => p.id)

    // Get all attendance for these parents' children
    const { data: allPlayers } = await supabase
      .from('players')
      .select('id, parent_id, first_name, last_name')
      .in('parent_id', parentIds.length > 0 ? parentIds : ['none'])

    const playerIdsByParent = new Map<string, string[]>()
    for (const p of allPlayers || []) {
      const list = playerIdsByParent.get(p.parent_id) || []
      list.push(p.id)
      playerIdsByParent.set(p.parent_id, list)
    }

    const allPlayerIds = (allPlayers || []).map(p => p.id)

    const { data: allAttendance } = await supabase
      .from('attendance')
      .select('player_id, present, session_date')
      .in('player_id', allPlayerIds.length > 0 ? allPlayerIds : ['none'])
      .order('session_date', { ascending: false })

    // Get payment status per parent
    const { data: allPayments } = await supabase
      .from('payments')
      .select('parent_id, status')
      .in('parent_id', parentIds.length > 0 ? parentIds : ['none'])

    // Get referrals per parent
    const { data: allReferrals } = await supabase
      .from('referrals')
      .select('referrer_id')
      .in('referrer_id', parentIds.length > 0 ? parentIds : ['none'])

    // Build parent engagement data
    const parentEngagementData = (parents || []).map(parent => {
      const pIds = playerIdsByParent.get(parent.id) || []
      const attendance = (allAttendance || []).filter(a => pIds.includes(a.player_id))
      const presentCount = attendance.filter(a => a.present).length
      const attendanceRate = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0

      // Streak
      const sorted = [...attendance].sort((a, b) => b.session_date.localeCompare(a.session_date))
      let streak = 0
      for (const a of sorted) {
        if (a.present) streak++
        else break
      }

      // Payment
      const payments = (allPayments || []).filter(p => p.parent_id === parent.id)
      const hasOverdue = payments.some(p => p.status === 'overdue')
      const hasPaid = payments.some(p => p.status === 'paid')
      const paymentStatus: 'current' | 'overdue' | 'none' = hasOverdue ? 'overdue' : hasPaid ? 'current' : 'none'

      // Referrals
      const referralCount = (allReferrals || []).filter(r => r.referrer_id === parent.id).length

      // Profile completeness
      const profileComplete = !!(parent.full_name && parent.phone)

      return {
        id: parent.id,
        name: parent.full_name || parent.email || 'Unknown',
        email: parent.email || '',
        attendanceRate,
        currentStreak: streak,
        paymentStatus,
        referralCount,
        profileComplete,
        totalSessions: attendance.length,
      }
    })

    return <AdminEngagement parents={parentEngagementData} orgName="" />
  }

  // Parent view — gather engagement data
  const orgId = profile?.organisation_id || ''

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('parent_id', user.id)

  const playerIds = (players || []).map(p => p.id)

  // All attendance
  const { data: attendance } = await supabase
    .from('attendance')
    .select('player_id, present, session_date')
    .in('player_id', playerIds.length > 0 ? playerIds : ['none'])
    .order('session_date', { ascending: false })

  const totalPresent = (attendance || []).filter(a => a.present).length
  const totalAttendance = (attendance || []).length
  const attendanceRate = totalAttendance > 0 ? Math.round((totalPresent / totalAttendance) * 100) : 0

  // Streak
  const sorted = [...(attendance || [])].sort((a, b) => b.session_date.localeCompare(a.session_date))
  let currentStreak = 0
  let bestStreak = 0
  let tempStreak = 0
  for (const a of sorted) {
    if (a.present) {
      tempStreak++
      if (currentStreak === tempStreak - 1) currentStreak = tempStreak
      bestStreak = Math.max(bestStreak, tempStreak)
    } else {
      tempStreak = 0
    }
  }

  // Payment status
  const { data: payments } = await supabase
    .from('payments')
    .select('status')
    .eq('parent_id', user.id)

  const hasOverdue = (payments || []).some(p => p.status === 'overdue')
  const hasPaid = (payments || []).some(p => p.status === 'paid')
  const paymentStatus: 'current' | 'overdue' | 'none' = hasOverdue ? 'overdue' : hasPaid ? 'current' : 'none'

  // Referrals
  const { data: referrals } = await supabase
    .from('referrals')
    .select('id, status, created_at')
    .eq('referrer_id', user.id)

  const referralCount = (referrals || []).length

  // Profile completeness
  const profileComplete = !!(profile?.full_name && profile?.phone && profile?.address)

  // Build calendar data (last 90 days)
  const calendarData: { date: string; attended: boolean }[] = []
  for (const a of attendance || []) {
    calendarData.push({ date: a.session_date, attended: a.present })
  }

  // Build streak history from attendance
  const streakHistory: { startDate: string; length: number }[] = []
  let runStart: string | null = null
  let runLen = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].present) {
      if (!runStart) runStart = sorted[i].session_date
      runLen++
    } else {
      if (runStart && runLen > 0) {
        streakHistory.push({ startDate: runStart, length: runLen })
      }
      runStart = null
      runLen = 0
    }
  }
  if (runStart && runLen > 0) {
    streakHistory.push({ startDate: runStart, length: runLen })
  }

  // Count total parents in org for leaderboard position
  const { count: totalParents } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organisation_id', orgId)
    .eq('role', 'parent')

  // Get org name
  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', orgId)
    .single()

  const childName = (players || [])[0]?.first_name || 'your child'

  return (
    <EngagementPage
      attendanceRate={attendanceRate}
      currentStreak={currentStreak}
      bestStreak={bestStreak}
      paymentStatus={paymentStatus}
      referralCount={referralCount}
      profileComplete={profileComplete}
      childName={childName}
      calendarData={calendarData}
      streakHistory={streakHistory}
      totalParents={totalParents || 0}
      orgName={org?.name || 'your academy'}
      totalSessions={totalAttendance}
    />
  )
}
