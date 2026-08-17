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
  if (daysUntil === 0) return 'Today!'
  if (daysUntil === 1) return 'Tomorrow'
  const date = new Date(dob)
  // We don't have the actual upcoming date here so just show day count
  return `In ${daysUntil} days`
}

export default function BirthdaysThisWeek({ players }: Props) {
  if (players.length === 0) return null  // no birthdays = no widget

  return (
    <div className="relative overflow-hidden bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl p-5">
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Birthdays this week</h2>
        </div>

        <div className="space-y-2">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/players/${p.id}`}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#142236]/40 transition-colors"
            >
              <PlayerAvatar photoUrl={p.photo_url} firstName={p.first_name} lastName={p.last_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#eef2f9] truncate">
                  {p.first_name} {p.last_name}{' '}
                  <span className="text-[11px] text-[#5b6c86] font-normal">turning {p.turningAge}</span>
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border border-[#1d2c42] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                  p.daysUntil === 0 ? 'text-[#d8a95a]' : 'text-[#93a2ba]'
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
