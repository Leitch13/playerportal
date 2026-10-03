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
    // Capacity-checked, reactivation-aware RPC (migration 105) — handles the
    // "player was in this class before and has a cancelled row" case by
    // reactivating it instead of exploding on the unique constraint.
    const { data: rpcRes, error } = await supabase.rpc('enrol_if_capacity_available', {
      p_player_id: playerId,
      p_group_id: groupId,
      p_org_id: orgId,
      p_status: 'active',
      p_activates_on: null,
    })
    const result = rpcRes as { ok?: boolean; error?: string; idempotent?: boolean } | null

    if (error) {
      alert('Could not add the enrolment. Please try again.')
    } else if (result && result.ok === false) {
      alert(result.error === 'class_full'
        ? 'That class is full — free a space or increase its capacity first.'
        : 'Could not add the enrolment. Please try again.')
    } else if (result?.idempotent) {
      alert('This player is already in that class.')
      setOpen(false)
      router.refresh()
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
        className="px-4 py-2 bg-[#4ecde6] text-[#04141a] rounded-[10px] text-sm font-semibold hover:bg-[#4ecde6]/90 transition-colors"
      >
        + Enrol Player
      </button>
    )
  }

  return (
    <div className="bg-[#0f1a2b] text-white rounded-[15px] border border-[#1d2c42] p-6">
      <h2 className="text-lg font-semibold mb-4">Enrol Player</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Player *</label>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            required
            className="w-full px-3 py-2 bg-[#080e18] text-white border border-[#1d2c42] rounded-lg focus:outline-none focus:border-[#4ecde6]/60"
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
            className="w-full px-3 py-2 bg-[#080e18] text-white border border-[#1d2c42] rounded-lg focus:outline-none focus:border-[#4ecde6]/60"
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
            className="px-4 py-2 bg-[#4ecde6] text-[#04141a] rounded-[10px] text-sm font-semibold hover:bg-[#4ecde6]/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Enrolling...' : 'Enrol'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 border border-[#1d2c42] rounded-[10px] text-sm font-medium text-[#93a2ba] hover:bg-[#142236] hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
