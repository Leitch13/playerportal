import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { progressReportEmail } from '@/lib/email-templates'

const SCORE_CATEGORIES = [
  { key: 'attitude', label: 'Attitude' },
  { key: 'effort', label: 'Effort' },
  { key: 'technical_quality', label: 'Technical Quality' },
  { key: 'game_understanding', label: 'Game Understanding' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'physical_movement', label: 'Physical Movement' },
]

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Verify caller is a coach/admin
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { playerId, scores, strengths, focusAreas, coachComment } = await request.json()
  if (!playerId) {
    return NextResponse.json({ error: 'Missing playerId' }, { status: 400 })
  }

  // Get player + parent
  const { data: player } = await supabase
    .from('players')
    .select('id, first_name, last_name, parent_id, profiles!players_parent_id_fkey(full_name, email)')
    .eq('id', playerId)
    .single()

  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const parent = player.profiles as unknown as { full_name: string; email: string } | null
  if (!parent?.email) return NextResponse.json({ error: 'No parent email' }, { status: 400 })

  // Get org name
  const { data: orgId } = await supabase.rpc('get_my_org')
  const { data: org } = await supabase.from('organisations').select('name').eq('id', orgId).single()

  // Build scores array
  const scoreList = SCORE_CATEGORIES.map(cat => ({
    category: cat.label,
    score: Number(scores?.[cat.key] || 0),
  }))
  const overallScore = scoreList.reduce((sum, s) => sum + s.score, 0) / scoreList.length

  // Parse strengths and focus areas
  const strengthsList: string[] = (strengths || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const focusList: string[] = (focusAreas || '').split(',').map((s: string) => s.trim()).filter(Boolean)

  // Auto-derive if empty
  if (strengthsList.length === 0) {
    scoreList.filter(s => s.score >= 4).forEach(s => strengthsList.push(s.category))
  }
  if (focusList.length === 0) {
    scoreList.filter(s => s.score <= 2).forEach(s => focusList.push(s.category))
  }

  // Get attendance stats
  const { count: totalSessions } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)

  const { count: presentCount } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .eq('status', 'present')

  const sessionsAttended = presentCount || 0
  const attendanceRate = (totalSessions || 0) > 0
    ? Math.round((sessionsAttended / (totalSessions || 1)) * 100)
    : 0

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const template = progressReportEmail({
    parentName: parent.full_name?.split(' ')[0] || 'there',
    childName: `${player.first_name} ${player.last_name}`,
    academyName: org?.name || 'Your Academy',
    overallScore,
    scores: scoreList,
    strengths: strengthsList,
    focusAreas: focusList,
    attendanceRate,
    sessionsAttended,
    coachComment: coachComment || undefined,
    reportUrl: `${appUrl}/dashboard/players/${playerId}/report`,
  })

  const result = await sendEmail({ to: parent.email, ...template })

  // Also create a notification
  await supabase.from('notifications').insert({
    profile_id: player.parent_id,
    organisation_id: orgId,
    type: 'progress',
    title: `New progress report for ${player.first_name}`,
    body: `Coach has submitted a new review. Overall score: ${overallScore.toFixed(1)}/5`,
    link: `/dashboard/players/${playerId}/report`,
  })

  return NextResponse.json({ ...result, success: true })
}
