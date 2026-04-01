'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizeCategories, type ScoringCategory, type NormalizedCategory } from '@/lib/scoring-categories'

/* ─── Types ─── */

interface PlayerInfo {
  id: string
  first_name: string
  last_name: string
  photo_url: string | null
}

interface ExistingAttendance {
  player_id: string
  present: boolean
}

interface SessionModeProps {
  groupId: string
  groupName: string
  dayOfWeek: string | null
  timeSlot: string | null
  location: string | null
  sessionDate: string
  coachId: string
  players: PlayerInfo[]
  sessionPlan: unknown
  existingAttendance: ExistingAttendance[]
  orgId?: string
}

/* ─── Helpers ─── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function getInitials(first: string, last: string): string {
  return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase()
}

/* ─── Main Component ─── */

export default function SessionMode({
  groupId,
  groupName,
  sessionDate,
  coachId,
  players,
  existingAttendance,
  orgId,
}: SessionModeProps) {
  const router = useRouter()

  // Screen: 'attendance' | 'ratings' | 'done'
  const [screen, setScreen] = useState<'attendance' | 'ratings' | 'done'>('attendance')

  // Custom scoring categories
  const [scoringCategories, setScoringCategories] = useState<NormalizedCategory[]>([])

  useEffect(() => {
    if (!orgId) return
    const supabase = createClient()
    supabase
      .from('scoring_categories')
      .select('*')
      .eq('organisation_id', orgId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setScoringCategories(normalizeCategories(data as ScoringCategory[] | null))
      })
  }, [orgId])

  // Attendance: null = not marked, true = present, false = absent (but we use simple toggle)
  const [attendance, setAttendance] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    players.forEach((p) => {
      const existing = existingAttendance.find((a) => a.player_id === p.id)
      map[p.id] = existing ? existing.present : false
    })
    return map
  })

  // Ratings: playerId -> { categoryKey -> score }
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  // Saving
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const markedCount = Object.values(attendance).filter(Boolean).length
  const presentPlayers = players.filter((p) => attendance[p.id])

  /* ─── Attendance actions ─── */

  function togglePlayer(playerId: string) {
    setAttendance((prev) => ({ ...prev, [playerId]: !prev[playerId] }))
  }

  function markAllPresent() {
    setAttendance(Object.fromEntries(players.map((p) => [p.id, true])))
  }

  async function saveAttendanceAndNext() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()

      await supabase
        .from('attendance')
        .delete()
        .eq('group_id', groupId)
        .eq('session_date', sessionDate)

      const rows = players.map((p) => ({
        player_id: p.id,
        group_id: groupId,
        session_date: sessionDate,
        present: attendance[p.id] ?? false,
        note: null,
      }))

      const { error: attErr } = await supabase.from('attendance').insert(rows)
      if (attErr) throw new Error(attErr.message)

      setScreen('ratings')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  /* ─── Rating actions ─── */

  function setRating(playerId: string, categoryKey: string, value: number) {
    setRatings((prev) => {
      const playerRatings = prev[playerId] || {}
      return {
        ...prev,
        [playerId]: {
          ...playerRatings,
          [categoryKey]: playerRatings[categoryKey] === value ? 0 : value,
        },
      }
    })
  }

  function setNote(playerId: string, value: string) {
    setNotes((prev) => ({ ...prev, [playerId]: value }))
  }

  async function saveReviewsAndFinish() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()

      const reviewRows = presentPlayers
        .filter((p) => {
          const playerRatings = ratings[p.id] || {}
          return Object.values(playerRatings).some((v) => v > 0)
        })
        .map((p) => {
          const playerRatings = ratings[p.id] || {}
          // Build the review row with scores for each category key
          const row: Record<string, unknown> = {
            player_id: p.id,
            coach_id: coachId,
            review_date: sessionDate,
            strengths: notes[p.id] || null,
            focus_next: null,
            parent_summary: null,
          }
          // Set scores for each category (uses the snake_case key)
          for (const cat of scoringCategories) {
            row[cat.key] = playerRatings[cat.key] || 0
          }
          return row
        })

      if (reviewRows.length > 0) {
        const { error: revErr } = await supabase
          .from('progress_reviews')
          .insert(reviewRows)
        if (revErr) throw new Error(revErr.message)
      }

      setScreen('done')
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save reviews')
    } finally {
      setSaving(false)
    }
  }

  /* ─── Done screen ─── */

  if (screen === 'done') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-6xl">&#127881;</div>
          <h1 className="text-3xl font-bold">Session Complete!</h1>
          <p className="text-white/40">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  /* ─── Screen 1: Attendance ─── */

  if (screen === 'attendance') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-48">
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-xl font-bold">{groupName}</h1>
          <p className="text-sm text-white/40 mt-0.5">{formatDate(sessionDate)}</p>
        </div>

        {/* Counter */}
        <div className="px-4 pb-3">
          <p className="text-sm text-white/50">
            <span className="text-green-400 font-bold">{markedCount}</span>
            <span>/{players.length} marked present</span>
          </p>
        </div>

        {/* Player grid */}
        <div className="px-4 grid grid-cols-2 gap-2">
          {players.map((p) => {
            const present = attendance[p.id]
            return (
              <button
                key={p.id}
                onClick={() => togglePlayer(p.id)}
                className={`flex items-center gap-3 min-h-[56px] px-3 py-3 rounded-xl border transition-all active:scale-[0.96] ${
                  present
                    ? 'bg-green-500/20 border-green-500/30 text-green-400'
                    : 'bg-[#141414] border-[#1e1e1e] text-white'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    present
                      ? 'bg-green-500/30 text-green-300'
                      : 'bg-white/10 text-white/50'
                  }`}
                >
                  {getInitials(p.first_name, p.last_name)}
                </div>
                <span className="text-sm font-medium truncate">
                  {p.first_name} {p.last_name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Error toast */}
        {error && (
          <div className="fixed top-4 left-4 right-4 z-50 bg-red-500/90 text-white text-sm px-4 py-3 rounded-xl font-medium">
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold ml-2">&times;</button>
          </div>
        )}

        {/* Bottom buttons */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a] border-t border-white/5 px-4 py-4 space-y-2 safe-bottom">
          <button
            onClick={markAllPresent}
            className="w-full py-4 bg-green-500/15 text-green-400 rounded-2xl text-base font-bold active:scale-[0.97] transition-transform"
          >
            All Here &#10003;
          </button>
          <button
            onClick={saveAttendanceAndNext}
            disabled={saving}
            className="w-full py-4 bg-white text-black rounded-2xl text-base font-bold active:scale-[0.97] transition-transform disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Next: Rate Players \u2192'}
          </button>
        </div>
      </div>
    )
  }

  /* ─── Screen 2: Quick Ratings ─── */

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-bold">{groupName}</h1>
        <p className="text-sm text-white/40 mt-0.5">
          Rate players &middot; {presentPlayers.length} present
        </p>
      </div>

      {/* Player list with ratings */}
      <div className="px-4 space-y-3">
        {presentPlayers.map((p) => {
          const playerRatings = ratings[p.id] || {}
          return (
            <div
              key={p.id}
              className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4"
            >
              <p className="text-sm font-semibold text-white mb-3">
                {p.first_name} {p.last_name}
              </p>

              {/* Per-category rating circles */}
              <div className="space-y-2 mb-3">
                {scoringCategories.map((cat) => {
                  const currentRating = playerRatings[cat.key] || 0
                  return (
                    <div key={cat.key}>
                      <p className="text-xs text-white/50 mb-1">{cat.icon ? `${cat.icon} ` : ''}{cat.label}</p>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            onClick={() => setRating(p.id, cat.key, val)}
                            className={`w-8 h-8 rounded-full text-xs font-bold transition-all active:scale-90 ${
                              currentRating === val
                                ? 'bg-[#4ecde6] text-[#0a0a0a]'
                                : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white/40'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Quick note */}
              <input
                type="text"
                value={notes[p.id] || ''}
                onChange={(e) => setNote(p.id, e.target.value)}
                placeholder="Quick note (optional)"
                className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#4ecde6]/40"
              />
            </div>
          )
        })}
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-red-500/90 text-white text-sm px-4 py-3 rounded-xl font-medium">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold ml-2">&times;</button>
        </div>
      )}

      {/* Bottom button */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a] border-t border-white/5 px-4 py-4 safe-bottom">
        <button
          onClick={saveReviewsAndFinish}
          disabled={saving}
          className="w-full py-4 bg-[#4ecde6] text-[#0a0a0a] rounded-2xl text-base font-bold active:scale-[0.97] transition-transform disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save & Finish \u2713'}
        </button>
      </div>
    </div>
  )
}
