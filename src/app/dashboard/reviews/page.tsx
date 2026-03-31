import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import ScoreBadge from '@/components/ScoreBadge'
import EmptyState from '@/components/EmptyState'
import { SCORE_CATEGORIES } from '@/lib/types'
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organisation_id || ''

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, age_group')
    .order('first_name')

  const { data: reviews } = await supabase
    .from('progress_reviews')
    .select(`
      *,
      player:players(first_name, last_name),
      coach:profiles!progress_reviews_coach_id_fkey(full_name)
    `)
    .order('review_date', { ascending: false })
    .limit(50)

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Progress Reviews</h1>

      <ReviewForm players={players || []} autoOpen={params.add === '1'} orgId={orgId} />

      {(reviews || []).length === 0 ? (
        <EmptyState message="No reviews created yet. Add one above — it publishes instantly to the parent portal." />
      ) : (
        <div className="space-y-4">
          {(reviews || []).map((review) => (
            <Card
              key={review.id}
              title={`${(review.player as unknown as { first_name: string; last_name: string })?.first_name} ${(review.player as unknown as { first_name: string; last_name: string })?.last_name}`}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-white/60">
                  <span>By {(review.coach as unknown as { full_name: string })?.full_name}</span>
                  <span>{new Date(review.review_date).toLocaleDateString()}</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {SCORE_CATEGORIES.map((cat) => (
                    <div key={cat.key} className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-white/[0.04]">
                      <ScoreBadge score={review[cat.key] as number} />
                      <span className="text-[10px] text-white/60 text-center">{cat.label}</span>
                    </div>
                  ))}
                </div>
                {review.strengths && (
                  <p className="text-sm"><span className="font-medium">Strengths:</span> <span className="text-white/60">{review.strengths}</span></p>
                )}
                {review.focus_next && (
                  <p className="text-sm"><span className="font-medium">Focus Next:</span> <span className="text-white/60">{review.focus_next}</span></p>
                )}
                {review.parent_summary && (
                  <div className="bg-[#4ecde6]/5 border border-[#4ecde6]/10 rounded-lg p-3">
                    <p className="text-sm"><span className="font-medium">Parent Summary:</span> <span className="text-white/80">{review.parent_summary}</span></p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
