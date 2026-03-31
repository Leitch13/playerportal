import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import type { UserRole } from '@/lib/types'
import AwardWall from './AwardWall'
import GiveAward from './GiveAward'

export default async function AwardsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id, full_name')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const isStaff = role === 'admin' || role === 'coach'
  const orgId = profile?.organisation_id || ''

  // Fetch organisation info for certificate branding
  const { data: org } = await supabase
    .from('organisations')
    .select('name, logo_url')
    .eq('id', orgId)
    .single()

  if (isStaff) {
    // Admin/Coach view
    const { data: awards } = await supabase
      .from('academy_awards')
      .select(`
        *,
        player:players(id, first_name, last_name),
        term:terms(name),
        awarder:profiles!academy_awards_profile_id_fkey(full_name)
      `)
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false })

    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .order('first_name')

    const { data: terms } = await supabase
      .from('terms')
      .select('id, name, is_active')
      .eq('organisation_id', orgId)
      .order('start_date', { ascending: false })

    return (
      <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Academy Awards</h1>
            <Link
              href="/dashboard/awards/leaderboard"
              className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white/70 hover:text-white transition"
            >
              View Leaderboard
            </Link>
          </div>

          <GiveAward
            players={players || []}
            terms={terms || []}
            orgId={orgId}
            userId={user.id}
          />

          <Card title="Recent Awards">
            {!awards || awards.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <p className="text-4xl mb-3">&#127942;</p>
                <p className="text-sm">No awards given yet. Start recognising your players!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {awards.map((a: Record<string, unknown>) => {
                  const player = a.player as { first_name: string; last_name: string } | null
                  const term = a.term as { name: string } | null
                  const icon = getAwardIcon(a.award_type as string)
                  const label = a.award_type === 'custom' ? (a.custom_title as string) : getAwardLabel(a.award_type as string)
                  return (
                    <Link
                      key={a.id as string}
                      href={`/dashboard/awards/certificate/${a.id}`}
                      className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition group"
                    >
                      <span className="text-2xl">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {player ? `${player.first_name} ${player.last_name}` : 'Unknown'}
                        </p>
                        <p className="text-sm text-white/50">{label}{term ? ` - ${term.name}` : ''}</p>
                      </div>
                      <span className="text-xs text-white/30">{new Date(a.created_at as string).toLocaleDateString()}</span>
                      <span className="text-white/20 group-hover:text-white/50 transition text-sm">View</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    )
  }

  // Parent view — show awards for their children
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('parent_id', user.id)

  const playerIds = (players || []).map((p) => p.id)

  const { data: awards } = playerIds.length > 0
    ? await supabase
        .from('academy_awards')
        .select(`
          *,
          player:players(id, first_name, last_name),
          term:terms(name)
        `)
        .in('player_id', playerIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Awards</h1>
          <Link
            href="/dashboard/awards/leaderboard"
            className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white/70 hover:text-white transition"
          >
            View Leaderboard
          </Link>
        </div>
        <AwardWall awards={awards || []} orgName={org?.name || 'Academy'} />
      </div>
    </div>
  )
}

function getAwardIcon(type: string): string {
  const icons: Record<string, string> = {
    player_of_term: '\u{1F3C6}',
    most_improved: '\u{1F31F}',
    best_attendance: '\u{2B50}',
    coaches_award: '\u{1F451}',
    golden_boot: '\u{26BD}',
    team_player: '\u{1F91D}',
    rising_star: '\u{1F525}',
    custom: '\u{1F3C5}',
  }
  return icons[type] || '\u{1F3C6}'
}

function getAwardLabel(type: string): string {
  const labels: Record<string, string> = {
    player_of_term: 'Player of the Term',
    most_improved: 'Most Improved',
    best_attendance: 'Best Attendance',
    coaches_award: "Coach's Award",
    golden_boot: 'Golden Boot',
    team_player: 'Team Player',
    rising_star: 'Rising Star',
    custom: 'Special Award',
  }
  return labels[type] || type
}
