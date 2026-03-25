'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/Card'

interface Group {
  id: string
  name: string
  day_of_week: string | null
  time_slot: string | null
}

interface Player {
  id: string
  first_name: string
  last_name: string
  age_group: string | null
}

export default function AttendanceManager({
  groups,
  players,
  orgId,
}: {
  groups: Group[]
  players: Player[]
  orgId: string
}) {
  const router = useRouter()
  const [groupId, setGroupId] = useState('')
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  function togglePlayer(playerId: string) {
    setAttendance((prev) => ({
      ...prev,
      [playerId]: prev[playerId] === undefined ? false : !prev[playerId],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!groupId) return
    setLoading(true)
    setSuccess('')

    const supabase = createClient()
    const records = players.map((p) => ({
      player_id: p.id,
      group_id: groupId,
      session_date: sessionDate,
      present: attendance[p.id] !== false, // default present
      organisation_id: orgId,
    }))

    const { error } = await supabase.from('attendance').upsert(records, {
      onConflict: 'player_id,group_id,session_date',
    })

    if (error) {
      alert(error.message)
    } else {
      setSuccess('Attendance saved!')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Card title="Record Attendance">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Session
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
                  {g.day_of_week ? ` — ${g.day_of_week}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Session Date
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {players.length > 0 && (
          <div className="border border-border rounded-lg divide-y divide-border">
            {players.map((p) => {
              const present = attendance[p.id] !== false
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface"
                  onClick={() => togglePlayer(p.id)}
                >
                  <span className="text-sm font-medium">
                    {p.first_name} {p.last_name}
                    {p.age_group && (
                      <span className="ml-2 text-text-light font-normal">
                        {p.age_group}
                      </span>
                    )}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      present
                        ? 'bg-cyan-100 text-cyan-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {present ? 'Present' : 'Absent'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {success && <p className="text-sm text-accent">{success}</p>}

        <button
          type="submit"
          disabled={loading || !groupId}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : 'Save Attendance'}
        </button>
      </form>
    </Card>
  )
}
