import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import ScoreBadge from '@/components/ScoreBadge'
import EmptyState from '@/components/EmptyState'
import { SCORE_CATEGORIES } from '@/lib/types'
import { normalizeCategories, type ScoringCategory } from '@/lib/scoring-categories'
import ReviewForm from './ReviewForm'

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('progress_reviews')

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

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, age_group')
    .order('first_name')

  const { data: reviews } = await supabase
    .from('progress_reviews')
    .select(`
      *,
      player:players(first_name, last_name, age_group),
      coach:profiles!progress_reviews_coach_id_fkey(full_name)
    `)
    .order('review_date', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Player Reports</h1>
          <p className="text-sm text-white/50 mt-1">{(reviews || []).length} report{(reviews || []).length !== 1 ? 's' : ''} created</p>
        </div>
      </div>

      <ReviewForm players={players || []} autoOpen={params.add === '1'} orgId={orgId} />

      {(reviews || []).length === 0 ? (
        <EmptyState message="No reports created yet. Click '+ New Report' above to get started." />
      ) : (
        <div className="space-y-3">
          {(reviews || []).map((review) => {
            const player = review.player as unknown as { first_name: string; last_name: string; age_group?: string } | null
            const coach = review.coach as unknown as { full_name: string } | null
            const playerName = player ? `${player.first_name} ${player.last_name}` : 'Unknown'

            return (
              <div
                key={review.id}
                className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-5 space-y-4"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white">{playerName}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                      {coach?.full_name && <span>By {coach.full_name}</span>}
                      <span>{new Date(review.review_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {player?.age_group && (
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-semibold">{player.age_group}</span>
                      )}
                    </div>
                  </div>
                  {/* Average score */}
                  {(() => {
                    const jsonScores = (review as Record<string, unknown>).scores as Record<string, number> | null
                    const scoreVals = scoringCategories
                      .map(cat => jsonScores?.[cat.key] ?? (review as Record<string, unknown>)[cat.key] as number)
                      .filter(v => typeof v === 'number')
                    const avg = scoreVals.length > 0
                      ? (scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length).toFixed(1)
                      : null
                    return avg ? (
                      <div className="text-right">
                        <div className="text-2xl font-extrabold text-primary">{avg}</div>
                        <div className="text-[10px] text-white/30 font-medium">AVG</div>
                      </div>
                    ) : null
                  })()}
                </div>

                {/* Score pills */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {scoringCategories.map((cat) => {
                    // Read from JSONB scores column first, fall back to legacy columns
                    const jsonScores = (review as Record<string, unknown>).scores as Record<string, number> | null
                    const score = jsonScores?.[cat.key] ?? (review as Record<string, unknown>)[cat.key] as number
                    if (score == null) return null
                    return (
                      <div key={cat.key} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-[#0a0a0a] border border-[#1e1e1e]">
                        <ScoreBadge score={score} />
                        <span className="text-[10px] text-white/40 text-center leading-tight">{cat.label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Written feedback */}
                {(review.strengths || review.focus_next || review.parent_summary) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {review.strengths && (
                      <div className="bg-green-500/5 border border-green-500/10 rounded-xl px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-green-400/60 font-semibold mb-1">Strengths</p>
                        <p className="text-sm text-white/70">{review.strengths}</p>
                      </div>
                    )}
                    {review.focus_next && (
                      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-amber-400/60 font-semibold mb-1">Areas to Improve</p>
                        <p className="text-sm text-white/70">{review.focus_next}</p>
                      </div>
                    )}
                  </div>
                )}
                {review.parent_summary && (
                  <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-primary/50 font-semibold mb-1">Parent Summary</p>
                    <p className="text-sm text-white/80">{review.parent_summary}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
