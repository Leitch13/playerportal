import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import Link from 'next/link'
import SessionPlanView from './SessionPlanView'

export default async function SessionPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('session_plans')

  const { data: plan } = await supabase
    .from('session_plans')
    .select('*, group:training_groups(name)')
    .eq('id', id)
    .single()

  if (!plan) redirect('/dashboard/session-plans')

  const { data: org } = await supabase
    .from('organisations')
    .select('name, logo_url')
    .eq('id', plan.organisation_id)
    .single()

  // Build search terms from plan content for drill matching
  const searchText = [plan.title, plan.objectives, plan.warm_up, plan.main_activity, plan.cool_down]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const keywords = searchText.split(/\s+/).filter((w: string) => w.length > 3)
  const uniqueKeywords = [...new Set(keywords)]

  let suggestedDrills: { id: string; name: string; category: string | null; description: string | null; duration_minutes: number; difficulty: string }[] = []

  if (uniqueKeywords.length > 0) {
    // Fetch org drills and do client-side text matching
    const { data: allDrills } = await supabase
      .from('drills')
      .select('id, name, category, description, duration_minutes, difficulty')
      .eq('organisation_id', plan.organisation_id)
      .limit(200)

    if (allDrills && allDrills.length > 0) {
      // Score drills by keyword matches against name + description + category
      const scored = allDrills.map((d) => {
        const drillText = [d.name, d.description, d.category].filter(Boolean).join(' ').toLowerCase()
        const score = uniqueKeywords.filter((kw: string) => drillText.includes(kw)).length
        return { ...d, score }
      })
      suggestedDrills = scored
        .filter((d) => d.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(({ score: _score, ...rest }) => rest)
    }
  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
      <div className="no-print flex items-center justify-between mb-6">
        <Link href="/dashboard/session-plans" className="text-white/40 hover:text-white text-sm">&larr; Back to Plans</Link>
      </div>

      <SessionPlanView plan={plan} orgName={org?.name || ''} orgLogo={org?.logo_url || ''} suggestedDrills={suggestedDrills} />
    </div>
  )
}
