import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SCORE_CATEGORIES } from '@/lib/types'
import { normalizeCategories, type ScoringCategory } from '@/lib/scoring-categories'
import HighlightReel from './HighlightReel'

export default async function HighlightsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const role = profile?.role || 'parent'
  const orgId = profile?.organisation_id || ''

  // Fetch player
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .single()

  if (!player) redirect('/dashboard/players')

  // Access check
  if (role === 'parent' && player.parent_id !== user.id) {
    redirect('/dashboard/children')
  }

  // Fetch custom scoring categories
  const { data: dbScoringCats } = await supabase
    .from('scoring_categories')
    .select('*')
    .eq('organisation_id', orgId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  const scoringCategories = normalizeCategories(dbScoringCats as ScoringCategory[] | null)

  // Fetch organisation for branding
  const { data: organisation } = await supabase
    .from('organisations')
    .select('name, logo_url, primary_color, slug')
    .eq('id', orgId)
    .single()

  // Determine the month to show highlights for (current month)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Fetch attendance for the month
  const { data: monthAttendance } = await supabase
    .from('attendance')
    .select('id, present, session_date')
    .eq('player_id', id)
    .gte('session_date', monthStart)
    .lte('session_date', monthEnd)
    .order('session_date', { ascending: true })

  const sessions = monthAttendance || []
  const sessionsAttended = sessions.filter((a) => a.present).length
  const totalSessions = sessions.length
  const attendanceRate = totalSessions > 0 ? Math.round((sessionsAttended / totalSessions) * 100) : 0

  // Calculate current streak from all attendance (not just this month)
  const { data: allAttendance } = await supabase
    .from('attendance')
    .select('present, session_date')
    .eq('player_id', id)
    .order('session_date', { ascending: false })
    .limit(50)

  let currentStreak = 0
  for (const a of allAttendance || []) {
    if (a.present) currentStreak++
    else break
  }

  // Fetch reviews for the month
  const { data: monthReviews } = await supabase
    .from('progress_reviews')
    .select('*, coach:profiles!progress_reviews_coach_id_fkey(full_name)')
    .eq('player_id', id)
    .gte('review_date', monthStart)
    .lte('review_date', monthEnd)
    .order('review_date', { ascending: false })
    .limit(5)

  // If no reviews this month, get the latest review overall
  let reviewsToUse = monthReviews || []
  if (reviewsToUse.length === 0) {
    const { data: latestReview } = await supabase
      .from('progress_reviews')
      .select('*, coach:profiles!progress_reviews_coach_id_fkey(full_name)')
      .eq('player_id', id)
      .order('review_date', { ascending: false })
      .limit(1)
    reviewsToUse = latestReview || []
  }

  // Find the best skill from the latest review
  const latestReview = reviewsToUse[0] || null
  let starSkill: { label: string; score: number } | null = null
  if (latestReview) {
    let bestScore = 0
    let bestLabel = ''
    for (const cat of scoringCategories) {
      const score = (latestReview[cat.key as keyof typeof latestReview] as number) || 0
      if (score > bestScore) {
        bestScore = score
        bestLabel = cat.label
      }
    }
    if (bestScore > 0) {
      starSkill = { label: bestLabel, score: bestScore }
    }
  }

  // Coach quote: use parent_summary or strengths from latest review
  const coachQuote = latestReview?.parent_summary || latestReview?.strengths || null
  const coachName = latestReview
    ? (latestReview.coach as unknown as { full_name: string })?.full_name || 'Coach'
    : null

  // Fetch achievements earned this month
  const { data: monthAchievements } = await supabase
    .from('player_achievements')
    .select('id, awarded_at, achievement:achievements(name, emoji, description)')
    .eq('player_id', id)
    .gte('awarded_at', monthStart)
    .lte('awarded_at', monthEnd)
    .order('awarded_at', { ascending: false })

  const achievements = (monthAchievements || []).map((ach) => {
    const achievement = ach.achievement as unknown as {
      name: string
      emoji: string
      description: string
    } | null
    return {
      name: achievement?.name || 'Achievement',
      emoji: achievement?.emoji || '',
    }
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
  const bookingUrl = organisation?.slug
    ? `${appUrl}/${organisation.slug}`
    : appUrl

  const highlightData = {
    playerName: `${player.first_name} ${player.last_name}`,
    playerPhotoUrl: player.photo_url || null,
    playerInitials: `${player.first_name?.charAt(0) || ''}${player.last_name?.charAt(0) || ''}`.toUpperCase(),
    monthLabel,
    sessionsAttended,
    totalSessions,
    attendanceRate,
    currentStreak,
    starSkill,
    coachQuote,
    coachName,
    achievements,
    academyName: organisation?.name || 'Academy',
    academyLogoUrl: organisation?.logo_url || null,
    brandColor: organisation?.primary_color || '#4ecde6',
    bookingUrl,
    shareUrl: `${appUrl}/dashboard/players/${id}/highlights`,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/dashboard/players/${id}`}
            className="text-sm text-white/60 hover:text-white hover:underline mb-1 inline-block"
          >
            &larr; Back to Profile
          </Link>
          <h1 className="text-2xl font-bold">Monthly Highlights</h1>
          <p className="text-sm text-white/60 mt-1">
            {player.first_name}&apos;s {monthLabel} summary &mdash; share it on social media!
          </p>
        </div>
      </div>

      <HighlightReel data={highlightData} />
    </div>
  )
}
