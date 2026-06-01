'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const statuses = ['active', 'paused', 'cancelled'] as const

export default function EnrolmentStatusToggle({
  enrolmentId,
  currentStatus,
}: {
  enrolmentId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateStatus(newStatus: string) {
    setLoading(true)
    const supabase = createClient()

    // Capture the group_id so we can trigger waitlist auto-promote if this
    // status transition opens a seat.
    const { data: enrolment } = await supabase
      .from('enrolments')
      .select('group_id, status')
      .eq('id', enrolmentId)
      .single()

    await supabase
      .from('enrolments')
      .update({ status: newStatus })
      .eq('id', enrolmentId)

    // If this transition vacates a spot (was active, now cancelled/paused),
    // fire the waitlist promote endpoint so the next person on the list
    // gets offered the spot with a 48-hour deadline.
    const seatVacated =
      enrolment?.status === 'active' && (newStatus === 'cancelled' || newStatus === 'paused')
    if (seatVacated && enrolment?.group_id) {
      try {
        await fetch('/api/waitlist/promote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: enrolment.group_id }),
        })
      } catch {
        // Don't block the cancel UX on the promote call — the cron will
        // also catch it on the next sweep.
      }
    }

    router.refresh()
    setLoading(false)
  }

  return (
    <select
      value={currentStatus}
      onChange={(e) => updateStatus(e.target.value)}
      disabled={loading}
      className="text-xs px-2 py-1 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
    >
      {statuses.map((s) => (
        <option key={s} value={s}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  )
}
