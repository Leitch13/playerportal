/**
 * Players Needing Attention widget — coach dashboard.
 *
 * Surfaces two cohorts of players the coach should follow up on:
 *   1. Players overdue for a review (last reviewed 30+ days ago, or never)
 *   2. Players with recent attendance concerns (missed 2+ of last 3 sessions)
 *
 * Both are actionable — clicking a row deep-links into the player's profile
 * where the coach can write a review or check in.
 */

import Link from 'next/link'
import PlayerAvatar from '@/components/PlayerAvatar'

export interface AttentionPlayer {
  id: string
  first_name: string
  last_name: string
  photo_url: string | null
  reason: 'overdue_review' | 'attendance_drop'
  detail: string  // e.g. "Last reviewed 47 days ago" or "Missed 3 of last 4 sessions"
}

interface Props {
  players: AttentionPlayer[]
}

// Static Tailwind classes (JIT-safe — dynamically-built class names get purged).
// Severity is a small semantic dot + coloured action text — no filled badges.
const REASON_META: Record<AttentionPlayer['reason'], { label: string; dotClass: string; textClass: string }> = {
  overdue_review: {
    label: 'Needs review',
    dotClass: 'bg-[#d8a95a]',
    textClass: 'text-[#d8a95a]',
  },
  attendance_drop: {
    label: 'Attendance',
    dotClass: 'bg-[#e0736d]',
    textClass: 'text-[#e0736d]',
  },
}

export default function PlayersNeedingAttention({ players }: Props) {
  if (players.length === 0) {
    return (
      <div className="bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Players Needing Attention</h2>
        </div>
        <div className="text-center py-4">
          <p className="text-xs text-[#5b6c86]">All caught up. Every player has had a recent review and is attending regularly.</p>
        </div>
      </div>
    )
  }

  // Group by reason for cleaner display
  const overdue = players.filter((p) => p.reason === 'overdue_review')
  const attendance = players.filter((p) => p.reason === 'attendance_drop')

  return (
    <div className="bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#1d2c42] flex items-center justify-between">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Players Needing Attention</h2>
        <span className="font-mono text-[13px] tabular-nums text-[#d8a95a]">
          {players.length}
        </span>
      </div>

      <div className="p-3 space-y-1">
        {overdue.length > 0 && (
          <>
            <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86] px-2 pt-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#d8a95a]" />Overdue review</p>
            {overdue.map((p) => {
              const meta = REASON_META[p.reason]
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/players/${p.id}`}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#142236]/40 transition-colors group"
                >
                  <PlayerAvatar photoUrl={p.photo_url} firstName={p.first_name} lastName={p.last_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#eef2f9] truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-[11px] text-[#5b6c86] truncate">{p.detail}</p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-medium ${meta.textClass}`}>
                    Review
                  </span>
                </Link>
              )
            })}
          </>
        )}

        {attendance.length > 0 && (
          <>
            <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86] px-2 pt-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#e0736d]" />Attendance drop</p>
            {attendance.map((p) => {
              const meta = REASON_META[p.reason]
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/players/${p.id}`}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#142236]/40 transition-colors group"
                >
                  <PlayerAvatar photoUrl={p.photo_url} firstName={p.first_name} lastName={p.last_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#eef2f9] truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-[11px] text-[#5b6c86] truncate">{p.detail}</p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-medium ${meta.textClass}`}>
                    Check in
                  </span>
                </Link>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
