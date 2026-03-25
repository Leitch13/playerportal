import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import ScoreBadge from '@/components/ScoreBadge'
import EmptyState from '@/components/EmptyState'
import { SCORE_CATEGORIES } from '@/lib/types'
import ProgressTrend from './ProgressTrend'

export default async function FeedbackPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Progress Feedback</h1>

      {(reviews || []).length === 0 ? (
        <EmptyState message="No feedback available yet. Your coach will add progress reviews after sessions." />
      ) : (
        <>
          {/* Progress trends per child */}
          {Object.entries(reviewsByPlayer).map(([pid, data]) => (
            <Card key={pid} title={`${data.name} — Progress Over Time`}>
              <ProgressTrend
                reviews={(data.reviews || []).map((r) => ({
                  review_date: r.review_date,
                  attitude: r.attitude as number,
                  effort: r.effort as number,
                  technical_quality: r.technical_quality as number,
                  game_understanding: r.game_understanding as number,
                  confidence: r.confidence as number,
                  physical_movement: r.physical_movement as number,
                }))}
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
                  <div className="flex items-center gap-4 text-sm text-text-light">
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
                    {SCORE_CATEGORIES.map((cat) => (
                      <div
                        key={cat.key}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg bg-surface"
                      >
                        <ScoreBadge score={review[cat.key] as number} />
                        <span className="text-xs text-text-light text-center">
                          {cat.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {review.strengths && (
                    <div>
                      <h3 className="text-sm font-medium mb-1">Strengths</h3>
                      <p className="text-sm text-text-light">
                        {review.strengths}
                      </p>
                    </div>
                  )}
                  {review.focus_next && (
                    <div>
                      <h3 className="text-sm font-medium mb-1">Focus Next</h3>
                      <p className="text-sm text-text-light">
                        {review.focus_next}
                      </p>
                    </div>
                  )}
                  {review.parent_summary && (
                    <div className="bg-primary/5 rounded-lg p-4">
                      <h3 className="text-sm font-medium mb-1">
                        Coach Summary
                      </h3>
                      <p className="text-sm">{review.parent_summary}</p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
