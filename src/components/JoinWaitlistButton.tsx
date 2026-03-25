'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface JoinWaitlistButtonProps {
  groupId: string
  playerId: string
  parentId: string
  orgId: string
  isFull: boolean
  waitlistPosition: number | null // null = not on waitlist
}

export default function JoinWaitlistButton({
  groupId,
  playerId,
  parentId,
  orgId,
  isFull,
  waitlistPosition,
}: JoinWaitlistButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [joined, setJoined] = useState(waitlistPosition !== null)
  const [position, setPosition] = useState(waitlistPosition)

  if (!isFull) return null

  async function handleJoin() {
    setLoading(true)
    const supabase = createClient()

    // Get next position
    const { data: last } = await supabase
      .from('waitlist')
      .select('position')
      .eq('training_group_id', groupId)
      .eq('status', 'waiting')
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const nextPosition = (last?.position || 0) + 1

    const { error } = await supabase.from('waitlist').insert({
      player_id: playerId,
      training_group_id: groupId,
      parent_id: parentId,
      organisation_id: orgId,
      position: nextPosition,
      status: 'waiting',
    })

    if (error) {
      alert(error.message)
    } else {
      setJoined(true)
      setPosition(nextPosition)
      router.refresh()
    }
    setLoading(false)
  }

  async function handleCancel() {
    setLoading(true)
    const supabase = createClient()
    await supabase
      .from('waitlist')
      .update({ status: 'cancelled' })
      .eq('player_id', playerId)
      .eq('training_group_id', groupId)
      .eq('status', 'waiting')

    setJoined(false)
    setPosition(null)
    setLoading(false)
    router.refresh()
  }

  if (joined) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
          On Waitlist #{position}
        </span>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="text-xs text-text-light hover:text-red-500 transition-colors"
        >
          {loading ? '...' : 'Cancel'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleJoin}
      disabled={loading}
      className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Joining...' : 'Join Waitlist'}
    </button>
  )
}
