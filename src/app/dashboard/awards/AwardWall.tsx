'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Award {
  id: string
  award_type: string
  custom_title?: string | null
  notes?: string | null
  is_public: boolean
  created_at: string
  player: { id: string; first_name: string; last_name: string } | null
  term: { name: string } | null
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
  custom: 'Special Award',
}

const awardGradients: Record<string, string> = {
  player_of_term: 'from-amber-500/20 to-yellow-600/10 border-amber-500/30',
  most_improved: 'from-purple-500/20 to-indigo-600/10 border-purple-500/30',
  best_attendance: 'from-emerald-500/20 to-green-600/10 border-emerald-500/30',
  coaches_award: 'from-amber-400/20 to-orange-500/10 border-amber-400/30',
  golden_boot: 'from-yellow-500/20 to-amber-600/10 border-yellow-500/30',
  team_player: 'from-blue-500/20 to-cyan-600/10 border-blue-500/30',
  rising_star: 'from-red-500/20 to-orange-600/10 border-red-500/30',
  custom: 'from-pink-500/20 to-rose-600/10 border-pink-500/30',
}

export default function AwardWall({ awards, orgName }: { awards: Award[]; orgName: string }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!awards || awards.length === 0) {
    return (
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-12 text-center">
        <p className="text-5xl mb-4">&#127942;</p>
        <h3 className="text-lg font-semibold text-white/70 mb-2">No awards yet</h3>
        <p className="text-sm text-white/40">Keep training — awards are coming!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Trophy Wall</h2>
        <p className="text-sm text-white/40 mb-6">Tap a trophy to view the full certificate</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {awards.map((award) => {
            const icon = awardIcons[award.award_type] || '\u{1F3C6}'
            const label = award.award_type === 'custom' ? (award.custom_title || 'Special Award') : awardLabels[award.award_type]
            const gradient = awardGradients[award.award_type] || awardGradients.custom
            const isExpanded = expanded === award.id

            return (
              <div key={award.id} className="relative">
                <button
                  onClick={() => setExpanded(isExpanded ? null : award.id)}
                  className={`w-full rounded-xl bg-gradient-to-br ${gradient} border p-4 text-center transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${isExpanded ? 'ring-2 ring-white/20' : ''}`}
                >
                  <div className="text-4xl mb-2 drop-shadow-lg animate-pulse-slow">{icon}</div>
                  <p className="text-sm font-semibold text-white truncate">{label}</p>
                  <p className="text-xs text-white/50 truncate mt-0.5">
                    {award.player ? `${award.player.first_name} ${award.player.last_name}` : ''}
                  </p>
                  <p className="text-[10px] text-white/30 mt-1">
                    {award.term?.name || new Date(award.created_at).toLocaleDateString()}
                  </p>
                </button>

                {isExpanded && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-2">
                    <div className="text-center mb-3">
                      <span className="text-5xl">{icon}</span>
                    </div>
                    <h3 className="text-base font-bold text-white text-center">{label}</h3>
                    <p className="text-sm text-white/60 text-center mt-1">
                      {award.player ? `${award.player.first_name} ${award.player.last_name}` : ''}
                    </p>
                    {award.notes && (
                      <p className="text-xs text-white/40 text-center mt-2 italic">
                        &quot;{award.notes}&quot;
                      </p>
                    )}
                    <p className="text-xs text-white/30 text-center mt-2">
                      {award.term?.name || ''} &middot; {new Date(award.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2 mt-4">
                      <Link
                        href={`/dashboard/awards/certificate/${award.id}`}
                        className="flex-1 text-center text-xs font-medium bg-white/10 hover:bg-white/15 rounded-lg py-2 text-white transition"
                      >
                        View Certificate
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (typeof navigator !== 'undefined' && navigator.share) {
                            navigator.share({
                              title: `${label} - ${orgName}`,
                              text: `${award.player?.first_name} won ${label}!`,
                              url: `${window.location.origin}/dashboard/awards/certificate/${award.id}`,
                            }).catch(() => {})
                          } else {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/dashboard/awards/certificate/${award.id}`
                            )
                          }
                        }}
                        className="flex-1 text-center text-xs font-medium bg-white/5 hover:bg-white/10 rounded-lg py-2 text-white/70 transition"
                      >
                        Share
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
