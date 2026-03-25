'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function BookClassButton({
  playerId,
  groupId,
  playerName,
  orgId,
  className,
  isFull,
  spotsLeft,
}: {
  playerId: string
  groupId: string
  playerName: string
  orgId: string
  className?: string
  isFull?: boolean
  spotsLeft?: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'booked' | 'waitlisted' | 'error' | null>(null)

  async function handleBook() {
    setLoading(true)
    const supabase = createClient()

    if (isFull) {
      // Join waitlist instead
      const { data: { user } } = await supabase.auth.getUser()

      // Get next position
      const { count } = await supabase
        .from('waitlist')
        .select('id', { count: 'exact', head: true })
        .eq('training_group_id', groupId)
        .eq('status', 'waiting')

      const { error } = await supabase.from('waitlist').insert({
        player_id: playerId,
        training_group_id: groupId,
        parent_id: user?.id,
        organisation_id: orgId,
        position: (count || 0) + 1,
        status: 'waiting',
      })

      if (error) {
        if (error.code === '23505') {
          alert(`${playerName} is already on the waitlist`)
        } else {
          console.error('Waitlist error:', error)
          setResult('error')
        }
      } else {
        setResult('waitlisted')
        router.refresh()
      }
      setLoading(false)
      return
    }

    // Normal enrolment
    const { error } = await supabase.from('enrolments').insert({
      player_id: playerId,
      group_id: groupId,
      status: 'active',
      organisation_id: orgId,
    })

    if (error) {
      if (error.code === '23505') {
        alert(`${playerName} is already enrolled in this class`)
      } else {
        console.error('Enrol error:', error)
        setResult('error')
      }
    } else {
      setResult('booked')

      // Send booking confirmation email (fire and forget)
      fetch('/api/email/booking-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, groupId }),
      }).catch(() => {})

      router.refresh()
    }
    setLoading(false)
  }

  if (result === 'booked') {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-green-600 bg-green-50 rounded-lg animate-fade-in">
        ✓ Booked!
      </span>
    )
  }

  if (result === 'waitlisted') {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-600 bg-amber-50 rounded-lg animate-fade-in">
        ⏳ Waitlisted
      </span>
    )
  }

  if (result === 'error') {
    return (
      <span className="px-3 py-1.5 text-xs font-medium text-red-600">
        Failed — try again
      </span>
    )
  }

  return (
    <button
      onClick={handleBook}
      disabled={loading}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all ${
        isFull
          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
          : 'bg-accent text-white hover:bg-accent/90'
      }`}
    >
      {loading ? (
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          {isFull ? 'Joining...' : 'Booking...'}
        </span>
      ) : isFull ? (
        `Waitlist ${playerName}`
      ) : spotsLeft !== undefined && spotsLeft <= 3 ? (
        `Book ${playerName} (${spotsLeft} left!)`
      ) : (
        `Book ${playerName}`
      )}
    </button>
  )
}
