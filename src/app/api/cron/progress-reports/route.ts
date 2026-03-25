import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { progressReportEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

const SCORE_CATEGORIES = [
  { key: 'attitude', label: 'Attitude' },
  { key: 'effort', label: 'Effort' },
  { key: 'technical_quality', label: 'Technical Quality' },
  { key: 'game_understanding', label: 'Game Understanding' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'physical_movement', label: 'Physical Movement' },
]

// Runs daily — finds reviews from the last 24 hours and emails parents
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'

  // Find reviews from the last 24 hours that haven't been emailed
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: reviews } = await supabase
    .from('progress_reviews')
    .select(`
      id, attitude, effort, technical_quality, game_understanding, confidence, physical_movement,
      strengths, focus_areas, parent_summary,
      player:players!progress_reviews_player_id_fkey(
        id, first_name, last_name, parent_id,
        parent:profiles!players_parent_id_fkey(full_name, email)
      ),
      coach:profiles!progress_reviews_coach_id_fkey(full_name),
      organisation:organisations!progress_reviews_organisation_id_fkey(name)
    `)
    .gte('created_at', since)

  let sent = 0

  for (const review of reviews || []) {
    const player = review.player as unknown as {
      id: string; first_name: string; last_name: string; parent_id: string
      parent: { full_name: string; email: string } | null
    } | null
    const coach = review.coach as unknown as { full_name: string } | null
    const org = review.organisation as unknown as { name: string } | null

    if (!player?.parent?.email) continue

    // Calculate scores
    const scores = SCORE_CATEGORIES.map(cat => ({
      category: cat.label,
      score: Number((review as Record<string, unknown>)[cat.key] || 0),
    }))
    const overallScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length

    // Get strengths and focus areas
    const strengths: string[] = (review.strengths as string || '').split(',').map((s: string) => s.trim()).filter(Boolean)
    const focusAreas: string[] = (review.focus_areas as string || '').split(',').map((s: string) => s.trim()).filter(Boolean)

    // Auto-derive strengths/focus from scores if not manually set
    if (strengths.length === 0) {
      scores.filter(s => s.score >= 4).forEach(s => strengths.push(s.category))
    }
    if (focusAreas.length === 0) {
      scores.filter(s => s.score <= 2).forEach(s => focusAreas.push(s.category))
    }

    // Get attendance stats
    const { count: totalSessions } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', player.id)

    const { count: presentCount } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', player.id)
      .eq('status', 'present')

    const sessionsAttended = presentCount || 0
    const attendanceRate = (totalSessions || 0) > 0
      ? Math.round((sessionsAttended / (totalSessions || 1)) * 100)
      : 0

    const template = progressReportEmail({
      parentName: player.parent.full_name?.split(' ')[0] || 'there',
      childName: `${player.first_name} ${player.last_name}`,
      academyName: org?.name || 'Your Academy',
      overallScore,
      scores,
      strengths,
      focusAreas,
      attendanceRate,
      sessionsAttended,
      coachComment: (review.parent_summary as string) || undefined,
      reportUrl: `${appUrl}/dashboard/players/${player.id}/report`,
    })

    await sendEmail({ to: player.parent.email, ...template })
    sent++
  }

  return NextResponse.json({ checked: (reviews || []).length, sent })
}
