import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'

interface AwardRow {
  id: string
  award_type: string
  custom_title: string | null
  created_at: string
  player: { id: string; first_name: string; last_name: string } | null
  term: { id: string; name: string; is_active: boolean } | null
}

const awardIcons: Record<string, string> = {
  player_of_term: '\u{1F3C6}',
  most_improved: '\u{1F31F}',
  best_attendance: '\u{2B50}',
  coaches_award: '\u{1F451}',
  golden_boot: '\u{26BD}',
  team_player: '\u{1F91D}',
  rising_star: '\u{1F525}',
  custom: '\u{1F3C5}',
}

const awardLabels: Record<string, string> = {
  player_of_term: 'Player of the Term',
  most_improved: 'Most Improved',
  best_attendance: 'Best Attendance',
  coaches_award: "Coach's Award",
  golden_boot: 'Golden Boot',
  team_player: 'Team Player',
  rising_star: 'Rising Star',
  custom: 'Custom',
}

const awardColors: Record<string, string> = {
  player_of_term: '#f59e0b',
  most_improved: '#a855f7',
  best_attendance: '#10b981',
  coaches_award: '#f97316',
  golden_boot: '#eab308',
  team_player: '#3b82f6',
  rising_star: '#ef4444',
  custom: '#ec4899',
}

export default async function LeaderboardPage() {
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

  const { data: allAwards } = await supabase
    .from('academy_awards')
    .select(`
      id, award_type, custom_title, created_at,
      player:players(id, first_name, last_name),
      term:terms(id, name, is_active)
    `)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  const awards = (allAwards || []) as unknown as AwardRow[]

  // Current-term awards
  const currentTermAwards = awards.filter((a) => a.term?.is_active)

  // Most awarded players (all-time)
  const playerCounts: Record<string, { name: string; count: number }> = {}
  awards.forEach((a) => {
    if (!a.player) return
    const key = a.player.id
    if (!playerCounts[key]) {
      playerCounts[key] = { name: `${a.player.first_name} ${a.player.last_name}`, count: 0 }
    }
    playerCounts[key].count++
  })
  const topPlayers = Object.entries(playerCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)

  // Award type distribution
  const typeCounts: Record<string, number> = {}
  awards.forEach((a) => {
    typeCounts[a.award_type] = (typeCounts[a.award_type] || 0) + 1
  })
  const totalAwards = awards.length
  const typeEntries = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)

  const rankEmoji = (i: number) => {
    if (i === 0) return '\u{1F947}'
    if (i === 1) return '\u{1F948}'
    if (i === 2) return '\u{1F949}'
    return `${i + 1}.`
  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
          <Link
            href="/dashboard/awards"
            className="text-sm text-white/50 hover:text-white transition"
          >
            &larr; Back to Awards
          </Link>
        </div>

        {awards.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-white/40">
              <p className="text-4xl mb-3">&#127942;</p>
              <p className="text-sm">No awards have been given yet.</p>
            </div>
          </Card>
        ) : (
          <>
            {/* Hall of Fame — All-Time Top Players */}
            <Card title="Hall of Fame">
              {topPlayers.length === 0 ? (
                <p className="text-sm text-white/40 text-center py-6">No awards yet.</p>
              ) : (
                <div className="space-y-2">
                  {topPlayers.map(([id, { name, count }], i) => (
                    <div
                      key={id}
                      className={`flex items-center gap-3 p-3 rounded-xl ${
                        i === 0
                          ? 'bg-amber-500/10 border border-amber-500/20'
                          : i === 1
                          ? 'bg-gray-300/5 border border-gray-400/10'
                          : i === 2
                          ? 'bg-orange-700/10 border border-orange-700/15'
                          : 'bg-white/[0.02] border border-white/5'
                      }`}
                    >
                      <span className="text-xl w-8 text-center">{rankEmoji(i)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{name}</p>
                      </div>
                      <span className="text-sm font-bold text-white/70">
                        {count} award{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* This Term */}
            {currentTermAwards.length > 0 && (
              <Card title="This Term">
                <div className="space-y-2">
                  {currentTermAwards.map((a) => {
                    const icon = awardIcons[a.award_type] || '\u{1F3C6}'
                    const label = a.award_type === 'custom' ? (a.custom_title || 'Custom') : awardLabels[a.award_type]
                    return (
                      <Link
                        key={a.id}
                        href={`/dashboard/awards/certificate/${a.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition"
                      >
                        <span className="text-xl">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">
                            {a.player ? `${a.player.first_name} ${a.player.last_name}` : 'Unknown'}
                          </p>
                          <p className="text-xs text-white/40">{label}</p>
                        </div>
                        <span className="text-xs text-white/30">
                          {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Award Distribution — SVG Bar Chart */}
            <Card title="Award Distribution">
              <div className="space-y-3">
                {typeEntries.map(([type, count]) => {
                  const pct = totalAwards > 0 ? (count / totalAwards) * 100 : 0
                  const color = awardColors[type] || '#6b7280'
                  const icon = awardIcons[type] || '\u{1F3C5}'
                  const label = awardLabels[type] || type
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-lg w-7 text-center">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white/70 truncate">{label}</span>
                          <span className="text-xs text-white/40 ml-2">{count}</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* SVG Pie Chart */}
              {typeEntries.length > 0 && (
                <div className="flex justify-center mt-6">
                  <svg viewBox="0 0 200 200" className="w-48 h-48">
                    {(() => {
                      let cumAngle = 0
                      return typeEntries.map(([type, count]) => {
                        const pct = count / totalAwards
                        const angle = pct * 360
                        const startAngle = cumAngle
                        cumAngle += angle

                        const startRad = ((startAngle - 90) * Math.PI) / 180
                        const endRad = ((startAngle + angle - 90) * Math.PI) / 180
                        const largeArc = angle > 180 ? 1 : 0

                        const x1 = 100 + 80 * Math.cos(startRad)
                        const y1 = 100 + 80 * Math.sin(startRad)
                        const x2 = 100 + 80 * Math.cos(endRad)
                        const y2 = 100 + 80 * Math.sin(endRad)

                        const color = awardColors[type] || '#6b7280'

                        if (typeEntries.length === 1) {
                          return (
                            <circle
                              key={type}
                              cx="100"
                              cy="100"
                              r="80"
                              fill={color}
                              opacity={0.8}
                            />
                          )
                        }

                        return (
                          <path
                            key={type}
                            d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={color}
                            opacity={0.8}
                            stroke="#0a0a0a"
                            strokeWidth="1"
                          />
                        )
                      })
                    })()}
                    <circle cx="100" cy="100" r="40" fill="#141414" />
                    <text x="100" y="96" textAnchor="middle" className="text-2xl font-bold" fill="white">{totalAwards}</text>
                    <text x="100" y="112" textAnchor="middle" className="text-[10px]" fill="rgba(255,255,255,0.4)">awards</text>
                  </svg>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
