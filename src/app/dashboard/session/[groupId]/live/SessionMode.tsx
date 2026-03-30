'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ─── Types ─── */

interface PlayerInfo {
  id: string
  first_name: string
  last_name: string
  photo_url: string | null
}

interface SessionPlanData {
  id: string
  title: string
  objectives: string | null
  warm_up: string | null
  main_activity: string | null
  cool_down: string | null
  equipment: string | null
  notes: string | null
  duration_minutes: number
}

interface ExistingAttendance {
  player_id: string
  present: boolean
}

interface PlayerQuickReview {
  rating: number
  note: string
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
  sessionPlan: SessionPlanData | null
  existingAttendance: ExistingAttendance[]
}

/* ─── Helpers ─── */

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

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
  dayOfWeek,
  timeSlot,
  location,
  sessionDate,
  coachId,
  players,
  sessionPlan,
  existingAttendance,
}: SessionModeProps) {
  // Session state
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Section collapse state
  const [planExpanded, setPlanExpanded] = useState(true)
  const [reviewsExpanded, setReviewsExpanded] = useState(false)
  const [qrExpanded, setQrExpanded] = useState(false)

  // Attendance state — pre-fill from existing records if any
  const [attendance, setAttendance] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    players.forEach((p) => {
      const existing = existingAttendance.find((a) => a.player_id === p.id)
      map[p.id] = existing ? existing.present : false
    })
    return map
  })

  // Quick reviews state
  const [reviews, setReviews] = useState<Record<string, PlayerQuickReview>>(() =>
    Object.fromEntries(players.map((p) => [p.id, { rating: 0, note: '' }]))
  )

  // Save states
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [attendanceSaved, setAttendanceSaved] = useState(existingAttendance.length > 0)
  const [savingReviews, setSavingReviews] = useState(false)
  const [reviewsSaved, setReviewsSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const presentCount = Object.values(attendance).filter(Boolean).length
  const absentCount = players.length - presentCount
  const presentPlayers = players.filter((p) => attendance[p.id])

  /* ─── Timer ─── */

  const startSession = useCallback(() => {
    setSessionStarted(true)
    setSessionEnded(false)
    setElapsedSeconds(0)
  }, [])

  const endSession = useCallback(() => {
    setSessionEnded(true)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (sessionStarted && !sessionEnded) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [sessionStarted, sessionEnded])

  /* ─── Attendance actions ─── */

  function toggleAttendance(playerId: string) {
    setAttendance((prev) => ({ ...prev, [playerId]: !prev[playerId] }))
    setAttendanceSaved(false)
  }

  function markAllPresent() {
    setAttendance(Object.fromEntries(players.map((p) => [p.id, true])))
    setAttendanceSaved(false)
  }

  async function saveAttendance() {
    setSavingAttendance(true)
    setError(null)
    try {
      const supabase = createClient()

      // Delete existing attendance for today to allow re-save
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

      setAttendanceSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save attendance')
    } finally {
      setSavingAttendance(false)
    }
  }

  /* ─── Reviews actions ─── */

  function updateRating(playerId: string, rating: number) {
    setReviews((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], rating },
    }))
    setReviewsSaved(false)
  }

  function updateNote(playerId: string, note: string) {
    setReviews((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], note },
    }))
    setReviewsSaved(false)
  }

  async function saveReviews() {
    setSavingReviews(true)
    setError(null)
    try {
      const supabase = createClient()

      const reviewRows = presentPlayers
        .filter((p) => reviews[p.id]?.rating > 0)
        .map((p) => {
          const r = reviews[p.id]
          const score = r.rating
          return {
            player_id: p.id,
            coach_id: coachId,
            review_date: sessionDate,
            attitude: score,
            effort: score,
            technical_quality: score,
            game_understanding: score,
            confidence: score,
            physical_movement: score,
            strengths: r.note || null,
            focus_next: null,
            parent_summary: null,
          }
        })

      if (reviewRows.length > 0) {
        const { error: revErr } = await supabase
          .from('progress_reviews')
          .insert(reviewRows)
        if (revErr) throw new Error(revErr.message)
      }

      setReviewsSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save reviews')
    } finally {
      setSavingReviews(false)
    }
  }

  /* ─── Session ended view ─── */

  if (sessionEnded && attendanceSaved) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-sm">
          <div className="text-6xl">&#9917;</div>
          <h1 className="text-3xl font-bold">Session Complete</h1>
          <p className="text-white/50 text-lg">
            {groupName} &mdash; {formatTimer(elapsedSeconds)}
          </p>
          <div className="flex gap-3 text-sm">
            <div className="flex-1 bg-emerald-500/20 text-emerald-400 rounded-2xl py-4 px-3">
              <div className="text-2xl font-bold">{presentCount}</div>
              <div>Present</div>
            </div>
            <div className="flex-1 bg-red-500/20 text-red-400 rounded-2xl py-4 px-3">
              <div className="text-2xl font-bold">{absentCount}</div>
              <div>Absent</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <a
              href="/dashboard"
              className="block w-full py-4 bg-white text-black rounded-2xl text-base font-bold text-center"
            >
              Back to Dashboard
            </a>
            <a
              href={`/dashboard/session/${groupId}`}
              className="block w-full py-4 bg-[#1a1a1a] text-white rounded-2xl text-base font-medium border border-white/10 text-center"
            >
              Full Session View
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/5 px-4 py-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold truncate">{groupName}</h1>
            <div className="flex items-center gap-2 text-sm text-white/40 mt-0.5">
              <span>{formatDate(sessionDate)}</span>
              {timeSlot && (
                <>
                  <span>&middot;</span>
                  <span>{timeSlot}</span>
                </>
              )}
              {location && (
                <>
                  <span>&middot;</span>
                  <span className="truncate">{location}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <div className="text-sm font-medium">
              <span className="text-emerald-400">{presentCount}</span>
              <span className="text-white/30">/{players.length}</span>
            </div>
            {sessionStarted && (
              <div className="text-lg font-mono font-bold text-white/80 tabular-nums">
                {formatTimer(elapsedSeconds)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* ─── Section 1: Session Plan ─── */}
        <section>
          <button
            onClick={() => setPlanExpanded(!planExpanded)}
            className="w-full flex items-center justify-between py-3"
          >
            <h2 className="text-base font-bold text-white/90">Session Plan</h2>
            <svg
              className={`w-5 h-5 text-white/40 transition-transform ${planExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {planExpanded && (
            <div className="bg-[#141414] rounded-2xl border border-white/5 overflow-hidden">
              {sessionPlan ? (
                <div className="divide-y divide-white/5">
                  {sessionPlan.objectives && (
                    <PlanSection icon="&#127919;" label="Objectives" content={sessionPlan.objectives} />
                  )}
                  {sessionPlan.warm_up && (
                    <PlanSection icon="&#128293;" label="Warm Up" content={sessionPlan.warm_up} />
                  )}
                  {sessionPlan.main_activity && (
                    <PlanSection icon="&#9917;" label="Main Activity" content={sessionPlan.main_activity} />
                  )}
                  {sessionPlan.cool_down && (
                    <PlanSection icon="&#10052;&#65039;" label="Cool Down" content={sessionPlan.cool_down} />
                  )}
                  {sessionPlan.equipment && (
                    <PlanSection icon="&#129526;" label="Equipment" content={sessionPlan.equipment} />
                  )}
                  {sessionPlan.notes && (
                    <PlanSection icon="&#128221;" label="Notes" content={sessionPlan.notes} />
                  )}
                  {!sessionPlan.objectives &&
                    !sessionPlan.warm_up &&
                    !sessionPlan.main_activity &&
                    !sessionPlan.cool_down && (
                      <div className="p-5 text-center text-white/40 text-sm">
                        Plan exists but no details filled in yet
                      </div>
                    )}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-2">&#127939;</div>
                  <p className="text-white/40 text-sm">No session plan &mdash; wing it!</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ─── Section 2: Attendance ─── */}
        <section>
          <div className="flex items-center justify-between py-3">
            <h2 className="text-base font-bold text-white/90">Attendance</h2>
            <span className="text-sm text-white/40">
              {presentCount}/{players.length} present
            </span>
          </div>

          {/* Mark All + Save */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={markAllPresent}
              className="flex-1 py-3 bg-emerald-500/15 text-emerald-400 rounded-xl text-sm font-bold active:scale-[0.97] transition-transform"
            >
              Mark All Present
            </button>
            <button
              onClick={saveAttendance}
              disabled={savingAttendance}
              className={`flex-1 py-3 rounded-xl text-sm font-bold active:scale-[0.97] transition-transform ${
                attendanceSaved
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-white text-black'
              }`}
            >
              {savingAttendance
                ? 'Saving...'
                : attendanceSaved
                  ? 'Saved'
                  : 'Save Attendance'}
            </button>
          </div>

          {/* Player Grid */}
          <div className="grid grid-cols-2 gap-2">
            {players.map((p) => {
              const present = attendance[p.id]
              return (
                <button
                  key={p.id}
                  onClick={() => toggleAttendance(p.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.96] ${
                    present
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  {p.photo_url ? (
                    <img
                      src={p.photo_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        present
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {getInitials(p.first_name, p.last_name)}
                    </div>
                  )}
                  <div className="text-left min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    <p
                      className={`text-xs font-semibold ${
                        present ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {present ? 'Present' : 'Absent'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* QR Code toggle */}
          <div className="mt-3">
            <button
              onClick={() => setQrExpanded(!qrExpanded)}
              className="w-full py-3 bg-[#141414] border border-white/5 rounded-xl text-sm text-white/50 font-medium"
            >
              {qrExpanded ? 'Hide' : 'Show'} QR Code for Parent Check-in
            </button>
            {qrExpanded && (
              <div className="mt-2 bg-[#141414] border border-white/5 rounded-xl p-6 text-center">
                <div className="inline-block bg-white p-4 rounded-xl">
                  {/* SVG QR placeholder — actual QR would use a library */}
                  <svg viewBox="0 0 100 100" className="w-40 h-40">
                    <rect width="100" height="100" fill="white" />
                    <rect x="10" y="10" width="25" height="25" fill="black" />
                    <rect x="65" y="10" width="25" height="25" fill="black" />
                    <rect x="10" y="65" width="25" height="25" fill="black" />
                    <rect x="14" y="14" width="17" height="17" fill="white" />
                    <rect x="69" y="14" width="17" height="17" fill="white" />
                    <rect x="14" y="69" width="17" height="17" fill="white" />
                    <rect x="18" y="18" width="9" height="9" fill="black" />
                    <rect x="73" y="18" width="9" height="9" fill="black" />
                    <rect x="18" y="73" width="9" height="9" fill="black" />
                    <rect x="40" y="10" width="5" height="5" fill="black" />
                    <rect x="50" y="10" width="5" height="5" fill="black" />
                    <rect x="40" y="20" width="5" height="5" fill="black" />
                    <rect x="45" y="30" width="5" height="5" fill="black" />
                    <rect x="40" y="40" width="5" height="5" fill="black" />
                    <rect x="50" y="40" width="5" height="5" fill="black" />
                    <rect x="60" y="40" width="5" height="5" fill="black" />
                    <rect x="40" y="50" width="5" height="5" fill="black" />
                    <rect x="50" y="50" width="5" height="5" fill="black" />
                    <rect x="40" y="60" width="5" height="5" fill="black" />
                    <rect x="55" y="55" width="5" height="5" fill="black" />
                    <rect x="65" y="50" width="5" height="5" fill="black" />
                    <rect x="75" y="55" width="5" height="5" fill="black" />
                    <rect x="85" y="45" width="5" height="5" fill="black" />
                    <rect x="65" y="65" width="10" height="10" fill="black" />
                    <rect x="80" y="65" width="10" height="10" fill="black" />
                    <rect x="65" y="80" width="10" height="10" fill="black" />
                    <rect x="80" y="80" width="10" height="10" fill="black" />
                  </svg>
                </div>
                <p className="text-white/30 text-xs mt-3">
                  Parents scan to mark attendance
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ─── Section 3: Quick Reviews ─── */}
        <section>
          <button
            onClick={() => setReviewsExpanded(!reviewsExpanded)}
            className="w-full flex items-center justify-between py-3"
          >
            <h2 className="text-base font-bold text-white/90">Quick Reviews</h2>
            <svg
              className={`w-5 h-5 text-white/40 transition-transform ${reviewsExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {reviewsExpanded && (
            <div className="space-y-2">
              {presentPlayers.length === 0 ? (
                <div className="bg-[#141414] rounded-2xl border border-white/5 p-8 text-center">
                  <p className="text-white/40 text-sm">
                    Mark players as present first
                  </p>
                </div>
              ) : (
                <>
                  {presentPlayers.map((p) => {
                    const review = reviews[p.id]
                    return (
                      <div
                        key={p.id}
                        className="bg-[#141414] rounded-xl border border-white/5 p-4"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          {p.photo_url ? (
                            <img
                              src={p.photo_url}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/60">
                              {getInitials(p.first_name, p.last_name)}
                            </div>
                          )}
                          <span className="text-sm font-medium text-white flex-1 truncate">
                            {p.first_name} {p.last_name}
                          </span>
                        </div>

                        {/* Star rating */}
                        <div className="flex gap-2 mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => updateRating(p.id, star)}
                              className={`flex-1 py-3 rounded-xl text-lg font-bold transition-all active:scale-90 ${
                                review && review.rating >= star
                                  ? 'bg-amber-500/25 text-amber-400'
                                  : 'bg-white/5 text-white/20'
                              }`}
                            >
                              &#9733;
                            </button>
                          ))}
                        </div>

                        {/* Quick note */}
                        <input
                          type="text"
                          value={review?.note || ''}
                          onChange={(e) => updateNote(p.id, e.target.value)}
                          placeholder="Quick note (optional)"
                          className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/20"
                        />
                      </div>
                    )
                  })}

                  <button
                    onClick={saveReviews}
                    disabled={savingReviews}
                    className={`w-full py-4 rounded-2xl text-base font-bold active:scale-[0.97] transition-transform ${
                      reviewsSaved
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500 text-black'
                    }`}
                  >
                    {savingReviews
                      ? 'Saving...'
                      : reviewsSaved
                        ? 'Reviews Saved'
                        : 'Save Reviews'}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ─── Error toast ─── */}
      {error && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-red-500/90 text-white text-sm px-4 py-3 rounded-xl font-medium">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {/* ─── Bottom Sticky Bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-white/5 px-4 py-4 safe-bottom">
        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex gap-2 text-xs flex-shrink-0">
            <span className="bg-emerald-500/15 text-emerald-400 px-3 py-2 rounded-xl font-bold">
              {presentCount} in
            </span>
            <span className="bg-red-500/10 text-red-400 px-3 py-2 rounded-xl font-bold">
              {absentCount} out
            </span>
          </div>

          {/* Timer (shown when running) */}
          {sessionStarted && !sessionEnded && (
            <div className="text-base font-mono font-bold text-white/70 tabular-nums flex-shrink-0">
              {formatTimer(elapsedSeconds)}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Start / End Session button */}
          {!sessionStarted ? (
            <button
              onClick={startSession}
              className="px-8 py-4 bg-emerald-500 text-white rounded-2xl text-base font-bold active:scale-[0.95] transition-transform"
            >
              Start Session
            </button>
          ) : !sessionEnded ? (
            <button
              onClick={endSession}
              className="px-8 py-4 bg-red-500 text-white rounded-2xl text-base font-bold active:scale-[0.95] transition-transform"
            >
              End Session
            </button>
          ) : (
            <button
              onClick={endSession}
              className="px-8 py-4 bg-white/10 text-white rounded-2xl text-base font-bold"
            >
              Session Ended
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function PlanSection({
  icon,
  label,
  content,
}: {
  icon: string
  label: string
  content: string
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-bold text-white/50 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">
        {content}
      </p>
    </div>
  )
}
