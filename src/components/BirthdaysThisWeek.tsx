/**
 * Birthdays This Week — coach dashboard delight widget.
 *
 * Shows any players who have a birthday in the next 7 days so the coach can
 * acknowledge it at the next session ("Happy birthday Jake!"). Small thing,
 * big difference for parents who notice the personal touch.
 */

import Link from 'next/link'
import PlayerAvatar from '@/components/PlayerAvatar'

export interface BirthdayPlayer {
  id: string
  first_name: string
  last_name: string
  photo_url: string | null
  date_of_birth: string
  daysUntil: number    // 0 = today, 1 = tomorrow, etc.
  turningAge: number   // age they're turning
}

interface Props {
  players: BirthdayPlayer[]
}

function formatDayLabel(daysUntil: number, dob: string): string {
  if (daysUntil === 0) return 'Today! 🎂'
  if (daysUntil === 1) return 'Tomorrow'
  const date = new Date(dob)
  // We don't have the actual upcoming date here so just show day count
  return `In ${daysUntil} days`
}

export default function BirthdaysThisWeek({ players }: Props) {
  if (players.length === 0) return null  // no birthdays = no widget

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-[#0a0a0a] border border-purple-500/20 rounded-2xl p-5 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-pink-500/10 blur-2xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🎂</span>
          <h2 className="text-sm font-bold text-white">Birthdays this week</h2>
        </div>

        <div className="space-y-2">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/players/${p.id}`}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <PlayerAvatar photoUrl={p.photo_url} firstName={p.first_name} lastName={p.last_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {p.first_name} {p.last_name}{' '}
                  <span className="text-xs text-white/40 font-normal">turning {p.turningAge}</span>
                </p>
              </div>
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  p.daysUntil === 0
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                    : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                }`}
              >
                {formatDayLabel(p.daysUntil, p.date_of_birth)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
