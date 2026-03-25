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
    await supabase
      .from('enrolments')
      .update({ status: newStatus })
      .eq('id', enrolmentId)
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
