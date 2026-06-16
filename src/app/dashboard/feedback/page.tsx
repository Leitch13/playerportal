import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import Card from '@/components/Card'
import ScoreBadge from '@/components/ScoreBadge'
import EmptyState from '@/components/EmptyState'
import { SCORE_CATEGORIES } from '@/lib/types'
import { normalizeCategories, type ScoringCategory } from '@/lib/scoring-categories'
import ProgressTrend from './ProgressTrend'
import ParentProgressV2 from '@/components/progress/ParentProgressV2'
import { PARENT_PROGRESS_V2_ENABLED, PARENT_PROGRESS_V2_1B_ENABLED, buildChildJourney, type AttendanceRecord } from '@/lib/parent-progress-v2'

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('progress_reviews')

  // Get profile for org
  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .single()
  const orgId = profile?.organisation_id || ''

  // Fetch custom scoring categories
  const { data: dbScoringCats } = await supabase
    .from('scoring_categories')
    .select('*')
    .eq('organisation_id', orgId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  const scoringCategories = normalizeCategories(dbScoringCats as ScoringCategory[] | null)

  // Get parent's children
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('parent_id', user.id)

  const playerIds = (players || []).map((p) => p.id)

  const { data: reviews } = await supabase
    .from('progress_reviews')
    .select(`
      *,
      player:players(first_name, last_name),
      coach:profiles!progress_reviews_coach_id_fkey(full_name)
    `)
    .in('player_id', playerIds.length > 0 ? playerIds : ['none'])
    .order('review_date', { ascending: false })

  // Group reviews by player for progress trends
  const reviewsByPlayer: Record<
    string,
    { name: string; reviews: typeof reviews }
  > = {}
  for (const r of reviews || []) {
    const pid = r.player_id
    const playerData = r.player as unknown as {
      first_name: string
      last_name: string
    }
    if (!reviewsByPlayer[pid]) {
      reviewsByPlayer[pid] = {
        name: `${playerData?.first_name} ${playerData?.last_name}`,
        reviews: [],
      }
    }
    reviewsByPlayer[pid].reviews!.push(r)
  }

  // ── Parent Progress 2.0 (Phase 1A) — child-first development journey. Built
  // entirely from the data already loaded above (players, reviews, categories);
  // no new queries. Flag OFF ⇒ this branch is skipped and the page below renders
  // byte-identical to current production. ──
  if (PARENT_PROGRESS_V2_ENABLED) {
    const sp = await searchParams

    // ── Phase 2B · Phase 1A — engagement strip data. One read-only attendance
    // SELECT, scoped to THIS parent's own children (playerIds derived from
    // players where parent_id = user.id) and additionally protected by RLS.
    // Only run when the 1B flag is on, so the OFF path adds no query and stays
    // byte-identical. present + session_date only; last 90 days. ──
    const attendanceByPlayer: Record<string, AttendanceRecord[]> = {}
    if (PARENT_PROGRESS_V2_1B_ENABLED && playerIds.length > 0) {
      const since90 = new Date()
      since90.setDate(since90.getDate() - 90)
      const { data: attendanceRows } = await supabase
        .from('attendance')
        .select('player_id, present, session_date')
        .in('player_id', playerIds)
        .gte('session_date', since90.toISOString().split('T')[0])
      for (const a of attendanceRows || []) {
        const pid = a.player_id as string
        if (!pid) continue
        ;(attendanceByPlayer[pid] ||= []).push({ present: a.present as boolean | null, session_date: a.session_date as string | null })
      }
    }

    const journeys = (players || []).map((p) =>
      buildChildJourney(
        p.id,
        p.first_name || '',
        reviewsByPlayer[p.id]?.reviews ?? [],
        scoringCategories,
        attendanceByPlayer[p.id] ?? [],
      ),
    )
    const selectedId =
      journeys.find((j) => j.playerId === sp?.child)?.playerId ?? journeys[0]?.playerId ?? ''
    return (
      <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
        <ParentProgressV2 journeys={journeys} selectedId={selectedId} />
      </div>
    )
  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Progress Feedback</h1>

      {(reviews || []).length === 0 ? (
        <EmptyState message="No feedback available yet. Your coach will add progress reviews after sessions." />
      ) : (
        <>
          {/* Progress trends per child */}
          {Object.entries(reviewsByPlayer).map(([pid, data]) => (
            <Card key={pid} title={`${data.name} — Progress Over Time`} action={
              <Link
                href={`/dashboard/players/${pid}/report/print`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Download Report
              </Link>
            }>
              <ProgressTrend
                reviews={(data.reviews || []).map((r) => {
                  const row: Record<string, unknown> & { review_date: string } = { review_date: r.review_date }
                  const jsonScores = (r as Record<string, unknown>).scores as Record<string, number> | null
                  for (const cat of scoringCategories) {
                    row[cat.key] = jsonScores?.[cat.key] ?? (r as Record<string, unknown>)[cat.key] as number
                  }
                  return row
                })}
                scoringCategories={scoringCategories}
              />
            </Card>
          ))}

          {/* Individual reviews */}
          <h2 className="text-lg font-semibold mt-8">All Reviews</h2>
          <div className="space-y-4">
            {(reviews || []).map((review) => (
              <Card
                key={review.id}
                title={`${(review.player as unknown as { first_name: string; last_name: string })?.first_name} ${(review.player as unknown as { first_name: string; last_name: string })?.last_name}`}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-white/60">
                    <span>
                      Reviewed by{' '}
                      {
                        (review.coach as unknown as { full_name: string })
                          ?.full_name
                      }
                    </span>
                    <span>
                      {new Date(review.review_date).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {scoringCategories.map((cat) => {
                      const jsonScores = (review as Record<string, unknown>).scores as Record<string, number> | null
                      const score = jsonScores?.[cat.key] ?? (review as Record<string, unknown>)[cat.key] as number
                      return (
                        <div
                          key={cat.key}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.04]"
                        >
                          <ScoreBadge score={score} />
                          <span className="text-xs text-white/60 text-center">
                            {cat.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {review.strengths && (
                    <div>
                      <h3 className="text-sm font-medium mb-1">Strengths</h3>
                      <p className="text-sm text-white/60">
                        {review.strengths}
                      </p>
                    </div>
                  )}
                  {review.focus_next && (
                    <div>
                      <h3 className="text-sm font-medium mb-1">Focus Next</h3>
                      <p className="text-sm text-white/60">
                        {review.focus_next}
                      </p>
                    </div>
                  )}
                  {review.parent_summary && (
                    <div className="bg-[#4ecde6]/5 border border-[#4ecde6]/10 rounded-lg p-4">
                      <h3 className="text-sm font-medium mb-1">
                        Coach Summary
                      </h3>
                      <p className="text-sm text-white/80">{review.parent_summary}</p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
    </div>
  )
}
