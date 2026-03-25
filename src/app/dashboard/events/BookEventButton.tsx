'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function BookEventButton({
  eventId,
  playerId,
  playerName,
  parentId,
  orgId,
  price,
}: {
  eventId: string
  playerId: string
  playerName: string
  parentId: string
  orgId: string
  price: number | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleBook() {
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('event_bookings').insert({
      organisation_id: orgId,
      event_id: eventId,
      player_id: playerId,
      parent_id: parentId,
      status: 'confirmed',
      payment_status: price && price > 0 ? 'unpaid' : 'paid',
      amount_paid: 0,
    })

    if (error) {
      if (error.code === '23505') {
        alert(`${playerName} is already booked into this event`)
      } else {
        alert(error.message)
      }
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleBook}
      disabled={loading}
      className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Booking...' : `Book ${playerName}`}
    </button>
  )
}
