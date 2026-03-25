import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import type { UserRole } from '@/lib/types'
import AchievementManager from './AchievementManager'
import AwardAchievementForm from './AwardAchievementForm'

export default async function AchievementsPage() {
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

  const role = (profile?.role || 'parent') as UserRole
  const isStaff = role === 'admin' || role === 'coach'
  const orgId = profile?.organisation_id || ''

  // Fetch all achievements for the organisation
  const { data: achievements } = await supabase
    .from('achievements')
    .select('*')
    .eq('organisation_id', orgId)
    .order('name')

  if (isStaff) {
    // --- Admin / Coach view ---

    // Get all players for awarding
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .order('first_name')

    // Get recently awarded achievements
    const { data: recentAwards } = await supabase
      .from('player_achievements')
      .select(`
        *,
        player:players(first_name, last_name),
        achievement:achievements(name, badge_emoji, badge_color, achievement_type),
        awarder:profiles!player_achievements_awarded_by_fkey(full_name)
      `)
      .eq('organisation_id', orgId)
      .order('awarded_at', { ascending: false })
      .limit(20)

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Achievements</h1>

        {/* Achievement manager: create / edit / delete */}
        <AchievementManager
          achievements={(achievements || []).map((a) => ({
            id: a.id as string,
            name: a.name as string,
            description: a.description as string | null,
            badge_emoji: a.badge_emoji as string,
            badge_color: a.badge_color as string,
            achievement_type: a.achievement_type as string,
            criteria: a.criteria as string | null,
          }))}
          orgId={orgId}
        />

        {/* Award form */}
        {(achievements || []).length > 0 && (
          <AwardAchievementForm
            achievements={(achievements || []).map((a) => ({
              id: a.id as string,
              name: a.name as string,
              badge_emoji: a.badge_emoji as string,
            }))}
            players={(players || []).map((p) => ({
              id: p.id as string,
              first_name: p.first_name as string,
              last_name: p.last_name as string,
            }))}
            userId={user.id}
            orgId={orgId}
          />
        )}

        {/* Recently awarded table */}
        <Card title="Recently Awarded">
          {(recentAwards || []).length === 0 ? (
            <EmptyState message="No achievements have been awarded yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium text-text-light">Achievement</th>
                    <th className="pb-2 font-medium text-text-light">Player</th>
                    <th className="pb-2 font-medium text-text-light">Awarded By</th>
                    <th className="pb-2 font-medium text-text-light">Date</th>
                    <th className="pb-2 font-medium text-text-light">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(recentAwards || []).map((award) => {
                    const achievement = award.achievement as unknown as {
                      name: string
                      badge_emoji: string
                      badge_color: string
                      achievement_type: string
                    }
                    const player = award.player as unknown as {
                      first_name: string
                      last_name: string
                    }
                    const awarder = award.awarder as unknown as {
                      full_name: string
                    }
                    return (
                      <tr key={award.id}>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-lg w-8 h-8 flex items-center justify-center rounded-full ${achievement?.badge_color || ''}`}>
                              {achievement?.badge_emoji}
                            </span>
                            <div>
                              <span className="font-medium">{achievement?.name}</span>
                              <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-surface-dark text-text-light capitalize">
                                {achievement?.achievement_type}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5">
                          {player?.first_name} {player?.last_name}
                        </td>
                        <td className="py-2.5 text-text-light">
                          {awarder?.full_name}
                        </td>
                        <td className="py-2.5 text-text-light">
                          {new Date(award.awarded_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 text-text-light max-w-[200px] truncate">
                          {award.notes || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    )
  }

  // --- Parent view ---

  // Get parent's children
  const { data: childPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('parent_id', user.id)

  const playerIds = (childPlayers || []).map((p) => p.id)

  // Get all achievements for the parent's children
  const { data: playerAchievements } = await supabase
    .from('player_achievements')
    .select(`
      *,
      player:players(first_name, last_name),
      achievement:achievements(name, description, badge_emoji, badge_color, achievement_type, criteria)
    `)
    .in('player_id', playerIds.length > 0 ? playerIds : ['none'])
    .order('awarded_at', { ascending: false })

  const totalAchievements = (playerAchievements || []).length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Achievements</h1>

      {/* Progress summary */}
      <div className="bg-primary/5 rounded-xl p-6 flex items-center gap-4">
        <span className="text-4xl">🏆</span>
        <div>
          <p className="text-2xl font-bold text-primary">{totalAchievements}</p>
          <p className="text-sm text-text-light">
            {totalAchievements === 1 ? 'achievement' : 'achievements'} earned
          </p>
        </div>
      </div>

      {totalAchievements === 0 ? (
        <EmptyState message="No achievements yet. Keep going — your first badge is just around the corner!" />
      ) : (
        <div className="space-y-4">
          {(playerAchievements || []).map((pa) => {
            const achievement = pa.achievement as unknown as {
              name: string
              description: string | null
              badge_emoji: string
              badge_color: string
              achievement_type: string
              criteria: string | null
            }
            const player = pa.player as unknown as {
              first_name: string
              last_name: string
            }
            const isCertificate = achievement?.achievement_type === 'certificate'

            if (isCertificate) {
              // Special printable certificate layout
              return (
                <div
                  key={pa.id}
                  className="bg-white rounded-xl border-2 border-warning/40 p-8 text-center print:border-warning print:shadow-none"
                >
                  <div className="border-2 border-dashed border-warning/30 rounded-lg p-6 space-y-3">
                    <span className="text-5xl block">{achievement?.badge_emoji}</span>
                    <h3 className="text-xl font-bold text-warning">Certificate of Achievement</h3>
                    <p className="text-lg font-semibold">{achievement?.name}</p>
                    <p className="text-text-light">Awarded to</p>
                    <p className="text-xl font-bold text-primary">
                      {player?.first_name} {player?.last_name}
                    </p>
                    {achievement?.description && (
                      <p className="text-sm text-text-light italic">{achievement.description}</p>
                    )}
                    <p className="text-xs text-text-light mt-4">
                      {new Date(pa.awarded_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    {pa.notes && (
                      <p className="text-sm text-text-light">{pa.notes}</p>
                    )}
                  </div>
                </div>
              )
            }

            // Standard badge / milestone display
            return (
              <Card key={pa.id}>
                <div className="flex items-center gap-4">
                  <span className={`text-4xl w-16 h-16 flex items-center justify-center rounded-full ${achievement?.badge_color || 'bg-surface'}`}>
                    {achievement?.badge_emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{achievement?.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-surface-dark text-text-light capitalize">
                        {achievement?.achievement_type}
                      </span>
                    </div>
                    <p className="text-sm text-text-light mt-0.5">
                      {player?.first_name} {player?.last_name}
                    </p>
                    {achievement?.description && (
                      <p className="text-sm text-text-light mt-1">{achievement.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-light">
                      <span>{new Date(pa.awarded_at).toLocaleDateString()}</span>
                      {pa.notes && <span>— {pa.notes}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
