'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Achievement {
  id: string
  name: string
  badge_emoji: string
}

interface Player {
  id: string
  first_name: string
  last_name: string
}

export default function AwardAchievementForm({
  achievements,
  players,
  userId,
  orgId,
}: {
  achievements: Achievement[]
  players: Player[]
  userId: string
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [achievementId, setAchievementId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!achievementId || !playerId) return
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.from('player_achievements').insert({
      organisation_id: orgId,
      player_id: playerId,
      achievement_id: achievementId,
      awarded_by: userId,
      awarded_at: new Date().toISOString(),
      notes: notes || null,
    })

    if (error) {
      alert(error.message)
    } else {
      setSuccess('Achievement awarded!')
      setAchievementId('')
      setPlayerId('')
      setNotes('')
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
      >
        Award to Player
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Award Achievement</h2>
        <button onClick={() => setOpen(false)} className="text-text-light hover:text-text text-sm">Close</button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Achievement *</label>
          <select
            value={achievementId}
            onChange={(e) => setAchievementId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select achievement...</option>
            {achievements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.badge_emoji} {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Player *</label>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select player...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Great performance in finals"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {success && <p className="text-sm text-accent font-medium md:col-span-3">{success}</p>}

        <div className="md:col-span-3 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Awarding...' : 'Award Achievement'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
