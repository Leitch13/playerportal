'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface Drill {
  id: string
  name: string
  category: string | null
  description: string | null
  duration_minutes: number
  equipment: string | null
  min_players: number
  max_players: number | null
  difficulty: string
  image_url: string | null
  created_by: string | null
}

const categoryLabels: Record<string, string> = {
  warm_up: 'Warm Up',
  technical: 'Technical',
  tactical: 'Tactical',
  physical: 'Physical',
  game: 'Game',
  cool_down: 'Cool Down',
}

const categoryColors: Record<string, string> = {
  warm_up: 'bg-orange-500/20 text-orange-400',
  technical: 'bg-[#4ecde6]/20 text-[#4ecde6]',
  tactical: 'bg-purple-500/20 text-purple-400',
  physical: 'bg-rose-500/20 text-rose-400',
  game: 'bg-emerald-500/20 text-emerald-400',
  cool_down: 'bg-blue-500/20 text-blue-400',
}

const difficultyDots: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
}

export default function DrillCard({
  drill,
  currentUserId,
  onEdit,
}: {
  drill: Drill
  currentUserId: string
  onEdit: (drill: Drill) => void
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const isOwner = drill.created_by === currentUserId

  async function handleDelete() {
    if (!confirm('Delete this drill?')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('drills').delete().eq('id', drill.id)
    setDeleting(false)
    router.refresh()
  }

  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 hover:border-[#2a2a2a] hover:bg-[#1a1a1a] transition-colors flex flex-col">
      {/* Category badge + difficulty */}
      <div className="flex items-center justify-between mb-3">
        {drill.category && (
          <span
            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${categoryColors[drill.category] || 'bg-white/10 text-white/50'}`}
          >
            {categoryLabels[drill.category] || drill.category}
          </span>
        )}
        <div className="flex items-center gap-1" title={drill.difficulty}>
          {[1, 2, 3].map((dot) => (
            <span
              key={dot}
              className={`w-2 h-2 rounded-full ${dot <= (difficultyDots[drill.difficulty] || 2) ? 'bg-[#4ecde6]' : 'bg-white/10'}`}
            />
          ))}
        </div>
      </div>

      {/* Name */}
      <h3 className="text-white font-semibold mb-1 line-clamp-1">{drill.name}</h3>

      {/* Description */}
      {drill.description && (
        <p className="text-sm text-white/50 line-clamp-2 mb-3">{drill.description}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-white/40 mt-auto pt-3 border-t border-[#1e1e1e]">
        <span>{drill.duration_minutes} min</span>
        <span>
          {drill.min_players}
          {drill.max_players ? `–${drill.max_players}` : '+'} players
        </span>
        {drill.equipment && <span className="truncate">{drill.equipment}</span>}
      </div>

      {/* Owner actions */}
      {isOwner && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e1e1e]">
          <button
            onClick={() => onEdit(drill)}
            className="text-[#4ecde6] hover:text-[#4ecde6]/80 text-xs transition"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-rose-400 hover:text-rose-300 text-xs transition disabled:opacity-40"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}
    </div>
  )
}
