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
const REASON_META: Record<AttentionPlayer['reason'], { label: string; icon: string; badgeClass: string }> = {
  overdue_review: {
    label: 'Needs review',
    icon: '📋',
    badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  },
  attendance_drop: {
    label: 'Attendance',
    icon: '⚠️',
    badgeClass: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  },
}

export default function PlayersNeedingAttention({ players }: Props) {
  if (players.length === 0) {
    return (
      <div className="bg-[#141414]/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-[0_0_15px_rgba(78,205,230,0.05)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">✨</span>
          <h2 className="text-sm font-bold text-white">Players Needing Attention</h2>
        </div>
        <div className="text-center py-4">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-xs text-white/40">All caught up. Every player has had a recent review and is attending regularly.</p>
        </div>
      </div>
    )
  }

  // Group by reason for cleaner display
  const overdue = players.filter((p) => p.reason === 'overdue_review')
  const attendance = players.filter((p) => p.reason === 'attendance_drop')

  return (
    <div className="bg-[#141414]/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(78,205,230,0.05)]">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">👀</span>
          <h2 className="text-sm font-bold text-white">Players Needing Attention</h2>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          {players.length}
        </span>
      </div>

      <div className="p-3 space-y-1">
        {overdue.length > 0 && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/70 px-2 pt-2">📋 Overdue review</p>
            {overdue.map((p) => {
              const meta = REASON_META[p.reason]
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/players/${p.id}`}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group"
                >
                  <PlayerAvatar photoUrl={p.photo_url} firstName={p.first_name} lastName={p.last_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-[11px] text-white/40 truncate">{p.detail}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${meta.badgeClass}`}>
                    Review
                  </span>
                </Link>
              )
            })}
          </>
        )}

        {attendance.length > 0 && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400/70 px-2 pt-2">⚠️ Attendance drop</p>
            {attendance.map((p) => {
              const meta = REASON_META[p.reason]
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/players/${p.id}`}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group"
                >
                  <PlayerAvatar photoUrl={p.photo_url} firstName={p.first_name} lastName={p.last_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-[11px] text-white/40 truncate">{p.detail}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${meta.badgeClass}`}>
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
