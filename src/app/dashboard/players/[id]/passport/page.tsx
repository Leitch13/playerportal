import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProgressionPassport from './ProgressionPassport'
import { type ScoringCategory } from '@/lib/scoring-categories'

const DEFAULT_SKILLS = [
  'Ball Control',
  'Passing',
  'Shooting',
  'Dribbling',
  'Defending',
  'Game Sense',
  'Teamwork',
  'Fitness',
]

export default async function PassportPage({
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
  const isStaff = role === 'admin' || role === 'coach'

  // Fetch player
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .single()

  if (!player) redirect('/dashboard/players')

  // If parent, ensure they own this player
  if (role === 'parent' && player.parent_id !== user.id) {
    redirect('/dashboard/children')
  }

  // Fetch custom scoring categories to determine skill names
  const { data: dbScoringCategories } = await supabase
    .from('scoring_categories')
    .select('*')
    .eq('organisation_id', orgId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  const customSkillNames =
    (dbScoringCategories as ScoringCategory[] | null)?.length
      ? (dbScoringCategories as ScoringCategory[]).map((c) => c.name)
      : DEFAULT_SKILLS

  // Fetch skill levels
  let { data: skillLevels } = await supabase
    .from('skill_levels')
    .select('*')
    .eq('player_id', id)
    .order('skill_name')

  // Auto-create skills if none exist, using org's custom categories
  if (!skillLevels || skillLevels.length === 0) {
    const inserts = customSkillNames.map((name) => ({
      organisation_id: orgId,
      player_id: id,
      skill_name: name,
      current_level: 1,
      current_xp: 0,
      xp_to_next: 100,
    }))
    await supabase.from('skill_levels').insert(inserts)
    const { data: fresh } = await supabase
      .from('skill_levels')
      .select('*')
      .eq('player_id', id)
      .order('skill_name')
    skillLevels = fresh
  }

  // Fetch attendance for XP history context
  const { data: attendance } = await supabase
    .from('attendance')
    .select('id, present, session_date, group:training_groups(name)')
    .eq('player_id', id)
    .order('session_date', { ascending: false })
    .limit(30)

  // Fetch achievements
  const { data: achievements } = await supabase
    .from('player_achievements')
    .select('id, awarded_at, achievement:achievements(name, emoji, description)')
    .eq('player_id', id)
    .order('awarded_at', { ascending: false })
    .limit(20)

  // Fetch recent reviews for XP gain timeline
  const { data: reviews } = await supabase
    .from('progress_reviews')
    .select('*, coach:profiles!progress_reviews_coach_id_fkey(full_name)')
    .eq('player_id', id)
    .order('review_date', { ascending: false })
    .limit(10)

  return (
    <ProgressionPassport
      player={player}
      skillLevels={skillLevels || []}
      attendance={attendance || []}
      achievements={achievements || []}
      reviews={reviews || []}
      isStaff={isStaff}
      orgId={orgId}
    />
  )
}
