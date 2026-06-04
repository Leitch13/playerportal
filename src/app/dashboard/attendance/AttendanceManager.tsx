'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Group {
  id: string
  name: string
  day_of_week: string | null
  time_slot: string | null
  location: string | null
}

interface Player {
  id: string
  first_name: string
  last_name: string
  age_group: string | null
}

interface EnrolmentMap {
  // group_id -> array of player IDs enrolled in that group
  [groupId: string]: string[]
}

// P2 Trial Funnel Reliability — trial guests surfaced above enrolled
// players for the selected group + date. No attendance row is created
// for trials (they're not in `players`); the row is informational so
// the coach knows to expect them.
interface TrialGuest {
  id: string
  group_id: string | null
  child_name: string
  child_age: number | null
  parent_name: string
  parent_email: string
  parent_phone: string | null
  preferred_date: string | null
  status: string
}

type AttendanceState = 'present' | 'absent' | 'unmarked'

export default function AttendanceManager({
  groups,
  players,
  enrolmentMap,
  orgId,
  trials = [],
}: {
  groups: Group[]
  players: Player[]
  enrolmentMap: EnrolmentMap
  orgId: string
  trials?: TrialGuest[]
}) {
  const router = useRouter()
  const [groupId, setGroupId] = useState('')
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [attendance, setAttendance] = useState<Record<string, AttendanceState>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [existingLoaded, setExistingLoaded] = useState(false)

  // Index players by ID for quick lookup
  const playerMap = useMemo(() => {
    const m = new Map<string, Player>()
    for (const p of players) m.set(p.id, p)
    return m
  }, [players])

  // Filter players to ONLY those enrolled in the selected group
  const enrolledPlayers = useMemo(() => {
    if (!groupId) return []
    const playerIds = enrolmentMap[groupId] || []
    return playerIds
      .map((id) => playerMap.get(id))
      .filter((p): p is Player => !!p)
      .sort((a, b) => a.first_name.localeCompare(b.first_name))
  }, [groupId, enrolmentMap, playerMap])

  // P2 — Trial guests for the selected group + date. Filtered client-side
  // off the prefetched ±60-day window so changing date is instant.
  const todaysTrials = useMemo(() => {
    if (!groupId || !sessionDate) return [] as TrialGuest[]
    return trials
      .filter(t => t.group_id === groupId && t.preferred_date === sessionDate)
      .sort((a, b) => a.child_name.localeCompare(b.child_name))
  }, [trials, groupId, sessionDate])

  // Live counts
  const counts = useMemo(() => {
    let present = 0
    let absent = 0
    let unmarked = 0
    for (const p of enrolledPlayers) {
      const state = attendance[p.id] || 'unmarked'
      if (state === 'present') present++
      else if (state === 'absent') absent++
      else unmarked++
    }
    return { present, absent, unmarked, total: enrolledPlayers.length }
  }, [attendance, enrolledPlayers])

  // Pre-fill from existing attendance records for this group+date
  useEffect(() => {
    if (!groupId || !sessionDate) {
      setExistingLoaded(false)
      return
    }
    async function loadExisting() {
      const supabase = createClient()
      const { data } = await supabase
        .from('attendance')
        .select('player_id, present')
        .eq('group_id', groupId)
        .eq('session_date', sessionDate)

      const next: Record<string, AttendanceState> = {}
      for (const row of data || []) {
        next[row.player_id] = row.present ? 'present' : 'absent'
      }
      setAttendance(next)
      setExistingLoaded(true)
    }
    loadExisting()
  }, [groupId, sessionDate])

  function setPlayerState(playerId: string, state: AttendanceState) {
    setAttendance((prev) => ({ ...prev, [playerId]: state }))
    setSuccess('')
  }

  function markAll(state: AttendanceState) {
    const next: Record<string, AttendanceState> = { ...attendance }
    for (const p of enrolledPlayers) next[p.id] = state
    setAttendance(next)
    setSuccess('')
  }

  function clearAll() {
    setAttendance({})
    setSuccess('')
  }

  async function handleSave() {
    if (!groupId) return
    if (counts.unmarked === counts.total) {
      alert('No attendance marked yet. Use "Mark all present" or tap each player.')
      return
    }
    setLoading(true)
    setSuccess('')

    const supabase = createClient()
    // Only save players that have been marked (present or absent)
    const records = enrolledPlayers
      .filter((p) => attendance[p.id] && attendance[p.id] !== 'unmarked')
      .map((p) => ({
        player_id: p.id,
        group_id: groupId,
        session_date: sessionDate,
        present: attendance[p.id] === 'present',
        organisation_id: orgId,
      }))

    const { error } = await supabase.from('attendance').upsert(records, {
      onConflict: 'player_id,group_id,session_date',
    })

    if (error) {
      alert('Save failed: ' + error.message)
    } else {
      setSuccess(`Saved · ${counts.present} present · ${counts.absent} absent`)
      router.refresh()
      setTimeout(() => setSuccess(''), 4000)
    }
    setLoading(false)
  }

  const selectedGroup = groups.find((g) => g.id === groupId)

  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden">
      {/* Header: pick session */}
      <div className="p-5 border-b border-[#1e1e1e] bg-gradient-to-br from-[#4ecde6]/[0.04] to-transparent">
        <h2 className="text-base font-bold text-white mb-3">Mark Attendance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">Class</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#4ecde6]/50"
            >
              <option value="">— Choose a class —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}{g.day_of_week ? ` · ${g.day_of_week}` : ''}{g.time_slot ? ` ${g.time_slot}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">Session date</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#4ecde6]/50"
            />
          </div>
        </div>

        {selectedGroup?.location && (
          <p className="text-xs text-white/40 mt-2">📍 {selectedGroup.location}</p>
        )}
      </div>

      {/* Empty state: no group picked */}
      {!groupId && (
        <div className="p-8 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-base font-bold text-white mb-1">Pick a class to start</h3>
          <p className="text-sm text-white/50">Choose the class above to see your enrolled players.</p>
        </div>
      )}

      {/* P2 Trial Funnel Reliability — Trial Guests for the selected
          group + date. Always rendered BEFORE the enrolled player list
          when groupId is selected. Read from trial_bookings only — no
          enrolment row is created, no attendance row is written. */}
      {groupId && todaysTrials.length > 0 && (
        <div className="px-5 pt-4 pb-3 border-b border-[#1e1e1e] bg-amber-500/[0.03]" data-testid="trial-guests-section">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-[11px] uppercase tracking-wider text-amber-300/90 font-bold">Trial Guests</h3>
            <span className="text-[10px] text-white/40">{todaysTrials.length} expected</span>
          </div>
          <div className="space-y-1.5">
            {todaysTrials.map(t => (
              <div
                key={t.id}
                data-testid="trial-guest-row"
                className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{t.child_name}</span>
                    {t.child_age != null && (
                      <span className="text-[10px] text-white/50">age {t.child_age}</span>
                    )}
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      Trial · {t.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-white/55 mt-0.5">
                    Parent: <span className="text-white/80">{t.parent_name}</span>
                    {t.parent_phone && <> · <a href={`tel:${t.parent_phone}`} className="text-amber-300/80 hover:text-amber-300">{t.parent_phone}</a></>}
                    {!t.parent_phone && t.parent_email && <> · <span className="text-white/60">{t.parent_email}</span></>}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/40 mt-2">
            Trial guests aren&apos;t in the attendance table — mark them as Attended / No Show on the Trials page after the session.
          </p>
        </div>
      )}

      {/* Empty enrolment state */}
      {groupId && enrolledPlayers.length === 0 && (
        <div className="p-8 text-center">
          <div className="text-4xl mb-3">👥</div>
          <h3 className="text-base font-bold text-white mb-1">No players enrolled in this class</h3>
          <p className="text-sm text-white/50">Add players to this class first via Players → Enrol.</p>
        </div>
      )}

      {/* Bulk action toolbar + player list */}
      {groupId && enrolledPlayers.length > 0 && (
        <>
          <div className="px-5 py-3 border-b border-[#1e1e1e] flex items-center justify-between gap-2 bg-[#0a0a0a]/50">
            <div className="text-xs text-white/50">
              <strong className="text-white">{counts.total}</strong> enrolled ·{' '}
              <strong className="text-emerald-400">{counts.present}</strong> present ·{' '}
              <strong className="text-red-400">{counts.absent}</strong> absent
              {counts.unmarked > 0 && <> · <strong className="text-amber-400">{counts.unmarked}</strong> unmarked</>}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => markAll('present')}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                title="Mark all as present"
              >
                ✓ All present
              </button>
              <button
                onClick={clearAll}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                title="Clear all marks"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Player cards */}
          <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
            {enrolledPlayers.map((p) => {
              const state = attendance[p.id] || 'unmarked'
              return (
                <div
                  key={p.id}
                  className={`relative rounded-xl border p-3 sm:p-4 transition-colors ${
                    state === 'present' ? 'bg-emerald-500/5 border-emerald-500/30' :
                    state === 'absent' ? 'bg-red-500/5 border-red-500/30' :
                    'bg-[#0a0a0a] border-[#1e1e1e]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Avatar bubble with initials */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                        state === 'present' ? 'bg-emerald-500/20 text-emerald-400' :
                        state === 'absent' ? 'bg-red-500/20 text-red-400' :
                        'bg-white/5 text-white/40'
                      }`}>
                        {p.first_name[0]}{(p.last_name || '')[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {p.first_name} {p.last_name}
                        </p>
                        {p.age_group && (
                          <p className="text-[11px] text-white/40">{p.age_group}</p>
                        )}
                      </div>
                    </div>

                    {/* Two-button picker */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setPlayerState(p.id, 'present')}
                        className={`w-12 h-10 sm:w-16 rounded-lg text-xs font-bold transition-all ${
                          state === 'present'
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105'
                            : 'bg-emerald-500/5 text-emerald-400/60 hover:bg-emerald-500/15 hover:text-emerald-400'
                        }`}
                        aria-label={`Mark ${p.first_name} present`}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setPlayerState(p.id, 'absent')}
                        className={`w-12 h-10 sm:w-16 rounded-lg text-xs font-bold transition-all ${
                          state === 'absent'
                            ? 'bg-red-500 text-white shadow-md shadow-red-500/30 scale-105'
                            : 'bg-red-500/5 text-red-400/60 hover:bg-red-500/15 hover:text-red-400'
                        }`}
                        aria-label={`Mark ${p.first_name} absent`}
                      >
                        ✗
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Sticky save bar */}
          <div className="sticky bottom-0 px-4 py-3 bg-[#141414] border-t border-[#1e1e1e] flex items-center justify-between gap-3">
            <div className="text-xs text-white/50">
              {existingLoaded && Object.keys(attendance).length > 0 ? (
                <>Loaded existing · edit and re-save</>
              ) : counts.unmarked === counts.total ? (
                <>Tap ✓ or ✗ for each player</>
              ) : (
                <>{counts.present + counts.absent} of {counts.total} marked</>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={loading || (counts.present + counts.absent === 0)}
              className="px-5 py-2.5 rounded-full text-sm font-bold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#7dddf0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving…' : 'Save attendance'}
            </button>
          </div>

          {/* Success toast */}
          {success && (
            <div className="px-4 py-2.5 bg-emerald-500/10 border-t border-emerald-500/30 text-xs font-semibold text-emerald-400 text-center">
              ✓ {success}
            </div>
          )}
        </>
      )}
    </div>
  )
}
