'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function EnrolmentForm({
  players,
  groups,
  orgId,
}: {
  players: { id: string; first_name: string; last_name: string }[]
  groups: { id: string; name: string; day_of_week: string | null }[]
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [playerId, setPlayerId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.from('enrolments').insert({
      organisation_id: orgId,
      player_id: playerId,
      group_id: groupId,
      status: 'active',
    })

    if (error) {
      alert(error.message)
    } else {
      setOpen(false)
      setPlayerId('')
      setGroupId('')
      router.refresh()
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
      >
        + Enrol Player
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <h2 className="text-lg font-semibold mb-4">Enrol Player</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <label className="block text-sm font-medium mb-1">
            Session *
          </label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select group...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.day_of_week ? ` (${g.day_of_week})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {loading ? 'Enrolling...' : 'Enrol'}
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
