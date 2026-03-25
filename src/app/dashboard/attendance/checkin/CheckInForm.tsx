'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface EnrolledChild {
  id: string
  first_name: string
  last_name: string
}

export default function CheckInForm({
  children,
  groupId,
  groupName,
  sessionDate,
  orgId,
}: {
  children: EnrolledChild[]
  groupId: string
  groupName: string
  sessionDate: string
  orgId: string
}) {
  const [checkedIn, setCheckedIn] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState<Record<string, boolean>>({})

  // Check for existing attendance records on mount
  useEffect(() => {
    async function checkExisting() {
      const supabase = createClient()
      const playerIds = children.map((c) => c.id)
      if (playerIds.length === 0) return

      const { data } = await supabase
        .from('attendance')
        .select('player_id')
        .in('player_id', playerIds)
        .eq('training_group_id', groupId)
        .eq('session_date', sessionDate)
        .eq('status', 'present')

      if (data) {
        const existing: Record<string, boolean> = {}
        data.forEach((row) => {
          existing[row.player_id] = true
        })
        setAlreadyCheckedIn(existing)
        setCheckedIn(existing)
      }
    }
    checkExisting()
  }, [children, groupId, sessionDate])

  async function handleCheckIn(playerId: string) {
    if (checkedIn[playerId] || alreadyCheckedIn[playerId]) return

    setLoading((prev) => ({ ...prev, [playerId]: true }))
    const supabase = createClient()

    const { error } = await supabase.from('attendance').upsert(
      {
        player_id: playerId,
        training_group_id: groupId,
        session_date: sessionDate,
        status: 'present',
        organisation_id: orgId,
      },
      {
        onConflict: 'player_id,training_group_id,session_date',
      }
    )

    if (error) {
      alert('Check-in failed: ' + error.message)
    } else {
      setCheckedIn((prev) => ({ ...prev, [playerId]: true }))
    }
    setLoading((prev) => ({ ...prev, [playerId]: false }))
  }

  const formattedDate = new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  if (children.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">&#128528;</div>
        <h2 className="text-lg font-semibold text-text">No enrolled children</h2>
        <p className="text-sm text-text-light mt-1">
          None of your children are enrolled in this group.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-text">{groupName}</h1>
        <p className="text-sm text-text-light mt-1">{formattedDate}</p>
      </div>

      <div className="space-y-3">
        {children.map((child) => {
          const isChecked = checkedIn[child.id] || alreadyCheckedIn[child.id]
          const isLoading = loading[child.id]
          const wasAlready = alreadyCheckedIn[child.id]

          return (
            <div
              key={child.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                isChecked
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-white border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                    isChecked
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {isChecked ? (
                    <svg
                      className="w-6 h-6 text-emerald-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    child.first_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-semibold text-text">
                    {child.first_name} {child.last_name}
                  </p>
                  {isChecked && (
                    <p className="text-xs text-emerald-600 font-medium">
                      {wasAlready ? 'Already checked in' : 'Checked in!'}
                    </p>
                  )}
                </div>
              </div>

              {!isChecked && (
                <button
                  onClick={() => handleCheckIn(child.id)}
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark disabled:opacity-50 transition-colors"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Checking in...
                    </span>
                  ) : (
                    'Check In'
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
