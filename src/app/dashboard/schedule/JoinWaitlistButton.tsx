'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function JoinWaitlistButton({
  groupId,
  playerId,
  playerName,
  orgId,
}: {
  groupId: string
  playerId: string
  playerName: string
  orgId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [joined, setJoined] = useState(false)

  async function handleJoin() {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error } = await supabase.from('waitlist').insert({
      organisation_id: orgId,
      player_id: playerId,
      group_id: groupId,
      parent_id: user.id,
    })

    if (error) {
      if (error.code === '23505') {
        alert(`${playerName} is already on the waitlist for this class.`)
      } else {
        alert(error.message)
      }
    } else {
      setJoined(true)
      router.refresh()
    }
    setLoading(false)
  }

  if (joined) {
    return (
      <span className="text-xs text-warning font-medium">On waitlist</span>
    )
  }

  return (
    <button
      onClick={handleJoin}
      disabled={loading}
      className="px-3 py-1 text-xs font-medium bg-warning/10 text-warning rounded-full hover:bg-warning/20 disabled:opacity-50 transition-colors"
    >
      {loading ? '...' : `Waitlist ${playerName}`}
    </button>
  )
}
