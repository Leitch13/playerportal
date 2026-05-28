import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, sendEmailBatch } from '@/lib/email'
import { monthlyHighlightsEmail } from '@/lib/email-templates'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Runs on the 1st of each month — sends highlight reel notifications
// to parents whose children had 5+ sessions the previous month.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  // Calculate last month's date range
  const now = new Date()
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthStart = lastMonthDate.toISOString().split('T')[0]
  const monthEnd = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0]
  const monthLabel = lastMonthDate.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  // Get all attendance records for last month, grouped by player
  const { data: attendanceRows } = await supabase
    .from('attendance')
    .select('player_id, present')
    .gte('session_date', monthStart)
    .lte('session_date', monthEnd)

  if (!attendanceRows || attendanceRows.length === 0) {
    return NextResponse.json({ message: 'No attendance records for last month', sent: 0 })
  }

  // Group by player, count sessions attended
  const playerStats = new Map<string, { total: number; attended: number }>()
  for (const row of attendanceRows) {
    const pid = row.player_id as string
    const stats = playerStats.get(pid) || { total: 0, attended: 0 }
    stats.total++
    if (row.present) stats.attended++
    playerStats.set(pid, stats)
  }

  // Filter to players with 5+ sessions attended
  const eligiblePlayerIds = Array.from(playerStats.entries())
    .filter(([, stats]) => stats.attended >= 5)
    .map(([pid]) => pid)

  if (eligiblePlayerIds.length === 0) {
    return NextResponse.json({ message: 'No players with 5+ sessions', sent: 0 })
  }

  // Fetch player details with parent info
  const { data: players } = await supabase
    .from('players')
    .select(`
      id, first_name, last_name, organisation_id,
      parent:profiles!players_parent_id_fkey(full_name, email)
    `)
    .in('id', eligiblePlayerIds)

  // Fetch organisation names
  const orgIds = [...new Set((players || []).map((p) => p.organisation_id).filter(Boolean))]
  const orgMap = new Map<string, string>()
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from('organisations')
      .select('id, name')
      .in('id', orgIds)
    for (const org of orgs || []) {
      orgMap.set(org.id, org.name)
    }
  }

  const jobs: Parameters<typeof sendEmail>[0][] = []

  for (const player of players || []) {
    const parent = player.parent as unknown as { full_name: string; email: string } | null
    if (!parent?.email) continue

    const stats = playerStats.get(player.id)
    if (!stats) continue

    const attendanceRate = stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0
    const academyName = orgMap.get(player.organisation_id as string) || 'Your Academy'

    const template = monthlyHighlightsEmail({
      parentName: parent.full_name?.split(' ')[0] || 'there',
      childName: `${player.first_name} ${player.last_name}`,
      academyName,
      monthLabel,
      sessionsAttended: stats.attended,
      attendanceRate,
      highlightsUrl: `${appUrl}/dashboard/players/${player.id}/highlights`,
    })

    jobs.push({ to: parent.email, ...template })
  }

  const { sent } = await sendEmailBatch(jobs)

  return NextResponse.json({
    month: monthLabel,
    eligiblePlayers: eligiblePlayerIds.length,
    sent,
  })
}
