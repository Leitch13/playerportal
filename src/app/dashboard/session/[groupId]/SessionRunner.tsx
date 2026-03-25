'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SCORE_CATEGORIES } from '@/lib/types'
import PlayerAvatar from '@/components/PlayerAvatar'
import Card from '@/components/Card'

interface PlayerInfo {
  id: string
  first_name: string
  last_name: string
  photo_url: string | null
}

interface SessionRunnerProps {
  groupId: string
  groupName: string
  sessionDate: string
  coachId: string
  players: PlayerInfo[]
}

type Tab = 'attendance' | 'notes' | 'reviews'

interface PlayerReview {
  attitude: number
  effort: number
  technical_quality: number
  game_understanding: number
  confidence: number
  physical_movement: number
  strengths: string
  focus_next: string
  skipped: boolean
}

export default function SessionRunner({
  groupId,
  groupName,
  sessionDate,
  coachId,
  players,
}: SessionRunnerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('attendance')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Attendance state - all present by default
  const [attendance, setAttendance] = useState<Record<string, boolean>>(
    () => Object.fromEntries(players.map((p) => [p.id, true]))
  )

  // Session notes state
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [focusAreas, setFocusAreas] = useState('')
  const [playersOfNote, setPlayersOfNote] = useState(
    () => players.map((p) => `${p.first_name} ${p.last_name}`).join(', ')
  )

  // Reviews state
  const [reviews, setReviews] = useState<Record<string, PlayerReview>>(
    () =>
      Object.fromEntries(
        players.map((p) => [
          p.id,
          {
            attitude: 0,
            effort: 0,
            technical_quality: 0,
            game_understanding: 0,
            confidence: 0,
            physical_movement: 0,
            strengths: '',
            focus_next: '',
            skipped: false,
          },
        ])
      )
  )
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)

  const presentCount = Object.values(attendance).filter(Boolean).length
  const presentPlayers = players.filter((p) => attendance[p.id])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'attendance', label: 'Attendance' },
    { key: 'notes', label: 'Session Notes' },
    { key: 'reviews', label: 'Quick Reviews' },
  ]

  function toggleAttendance(playerId: string) {
    setAttendance((prev) => ({ ...prev, [playerId]: !prev[playerId] }))
  }

  function markAll(present: boolean) {
    setAttendance(Object.fromEntries(players.map((p) => [p.id, present])))
  }

  function updateReview(
    playerId: string,
    field: keyof PlayerReview,
    value: number | string | boolean
  ) {
    setReviews((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()

      // 1. Insert attendance records
      const attendanceRows = players.map((p) => ({
        player_id: p.id,
        group_id: groupId,
        session_date: sessionDate,
        present: attendance[p.id] ?? true,
        note: null,
      }))

      const { error: attErr } = await supabase.from('attendance').insert(attendanceRows)
      if (attErr) throw new Error(`Attendance: ${attErr.message}`)

      // 2. Insert session note
      if (noteTitle || noteBody) {
        const { error: noteErr } = await supabase.from('session_notes').insert({
          group_id: groupId,
          session_date: sessionDate,
          coach_id: coachId,
          title: noteTitle || `${groupName} Session`,
          notes: noteBody || '',
          focus_areas: focusAreas || null,
          players_of_note: playersOfNote || null,
        })
        if (noteErr) throw new Error(`Session note: ${noteErr.message}`)
      }

      // 3. Insert reviews for non-skipped players that have scores
      const reviewRows = presentPlayers
        .filter((p) => {
          const r = reviews[p.id]
          return (
            !r.skipped &&
            (r.attitude > 0 ||
              r.effort > 0 ||
              r.technical_quality > 0 ||
              r.game_understanding > 0 ||
              r.confidence > 0 ||
              r.physical_movement > 0)
          )
        })
        .map((p) => {
          const r = reviews[p.id]
          return {
            player_id: p.id,
            coach_id: coachId,
            review_date: sessionDate,
            attitude: r.attitude || 3,
            effort: r.effort || 3,
            technical_quality: r.technical_quality || 3,
            game_understanding: r.game_understanding || 3,
            confidence: r.confidence || 3,
            physical_movement: r.physical_movement || 3,
            strengths: r.strengths || null,
            focus_next: r.focus_next || null,
            parent_summary: null,
          }
        })

      if (reviewRows.length > 0) {
        const { error: revErr } = await supabase
          .from('progress_reviews')
          .insert(reviewRows)
        if (revErr) throw new Error(`Reviews: ${revErr.message}`)
      }

      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <Card>
        <div className="text-center py-12 space-y-4">
          <div className="text-5xl">&#127881;</div>
          <h2 className="text-2xl font-bold text-primary">Session Complete!</h2>
          <p className="text-text-light">
            Attendance, notes, and reviews have been saved for{' '}
            <span className="font-medium">{groupName}</span>.
          </p>
          <div className="flex justify-center gap-3 pt-4">
            <a
              href="/dashboard"
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              Back to Dashboard
            </a>
            <a
              href="/dashboard/session-notes"
              className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors"
            >
              View Session Notes
            </a>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4 pb-28">
      {/* Tab navigation */}
      <div className="flex gap-1 bg-surface rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-primary shadow-sm'
                : 'text-text-light hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'attendance' && (
        <AttendanceTab
          players={players}
          attendance={attendance}
          presentCount={presentCount}
          toggleAttendance={toggleAttendance}
          markAll={markAll}
        />
      )}

      {activeTab === 'notes' && (
        <NotesTab
          noteTitle={noteTitle}
          setNoteTitle={setNoteTitle}
          noteBody={noteBody}
          setNoteBody={setNoteBody}
          focusAreas={focusAreas}
          setFocusAreas={setFocusAreas}
          playersOfNote={playersOfNote}
          setPlayersOfNote={setPlayersOfNote}
        />
      )}

      {activeTab === 'reviews' && (
        <ReviewsTab
          players={presentPlayers}
          reviews={reviews}
          currentIndex={currentReviewIndex}
          setCurrentIndex={setCurrentReviewIndex}
          updateReview={updateReview}
        />
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-3 z-50">
        <div className="max-w-2xl mx-auto">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  activeTab === tab.key ? 'bg-primary' : 'bg-border'
                }`}
                aria-label={tab.label}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center mb-2">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Complete Session'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── ATTENDANCE TAB ─── */
function AttendanceTab({
  players,
  attendance,
  presentCount,
  toggleAttendance,
  markAll,
}: {
  players: PlayerInfo[]
  attendance: Record<string, boolean>
  presentCount: number
  toggleAttendance: (id: string) => void
  markAll: (present: boolean) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {presentCount}/{players.length} present
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => markAll(true)}
            className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
          >
            Mark All Present
          </button>
          <button
            onClick={() => markAll(false)}
            className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
          >
            Mark All Absent
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {players.map((p) => {
          const present = attendance[p.id]
          return (
            <button
              key={p.id}
              onClick={() => toggleAttendance(p.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                present
                  ? 'border-green-400 bg-green-50'
                  : 'border-red-300 bg-red-50'
              }`}
            >
              <PlayerAvatar
                photoUrl={p.photo_url}
                firstName={p.first_name}
                lastName={p.last_name}
                size="sm"
              />
              <div className="text-left min-w-0">
                <p className="text-sm font-medium truncate">
                  {p.first_name} {p.last_name}
                </p>
                <p
                  className={`text-xs font-medium ${
                    present ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {present ? 'Present' : 'Absent'}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─── NOTES TAB ─── */
function NotesTab({
  noteTitle,
  setNoteTitle,
  noteBody,
  setNoteBody,
  focusAreas,
  setFocusAreas,
  playersOfNote,
  setPlayersOfNote,
}: {
  noteTitle: string
  setNoteTitle: (v: string) => void
  noteBody: string
  setNoteBody: (v: string) => void
  focusAreas: string
  setFocusAreas: (v: string) => void
  playersOfNote: string
  setPlayersOfNote: (v: string) => void
}) {
  return (
    <Card>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Session Title</label>
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="e.g. Passing drills & small-sided game"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Session Notes</label>
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="What happened in the session? Key observations, drills run, outcomes..."
            rows={6}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Focus Areas</label>
          <input
            type="text"
            value={focusAreas}
            onChange={(e) => setFocusAreas(e.target.value)}
            placeholder="e.g. Passing accuracy, defensive positioning"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Players of Note</label>
          <textarea
            value={playersOfNote}
            onChange={(e) => setPlayersOfNote(e.target.value)}
            placeholder="Players who stood out, positive or needs attention"
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
          />
        </div>
      </div>
    </Card>
  )
}

/* ─── REVIEWS TAB ─── */
function ReviewsTab({
  players,
  reviews,
  currentIndex,
  setCurrentIndex,
  updateReview,
}: {
  players: PlayerInfo[]
  reviews: Record<string, PlayerReview>
  currentIndex: number
  setCurrentIndex: (i: number) => void
  updateReview: (
    playerId: string,
    field: keyof PlayerReview,
    value: number | string | boolean
  ) => void
}) {
  if (players.length === 0) {
    return (
      <Card>
        <p className="text-sm text-text-light text-center py-8">
          No present players to review. Mark attendance first.
        </p>
      </Card>
    )
  }

  const safeIndex = Math.min(currentIndex, players.length - 1)
  const player = players[safeIndex]
  const review = reviews[player.id]

  if (!review) return null

  return (
    <div className="space-y-4">
      {/* Player navigation header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-light">
          Player {safeIndex + 1} of {players.length}
        </span>
        {review.skipped && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
            Skipped
          </span>
        )}
      </div>

      <Card>
        <div className="space-y-4">
          {/* Player info */}
          <div className="flex items-center gap-3">
            <PlayerAvatar
              photoUrl={player.photo_url}
              firstName={player.first_name}
              lastName={player.last_name}
              size="md"
            />
            <div>
              <p className="font-semibold">
                {player.first_name} {player.last_name}
              </p>
            </div>
          </div>

          {/* Score categories */}
          <div className="space-y-3">
            {SCORE_CATEGORIES.map((cat) => {
              const score = review[cat.key as keyof PlayerReview] as number
              return (
                <div key={cat.key} className="flex items-center justify-between">
                  <span className="text-sm font-medium w-36">{cat.label}</span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() =>
                          updateReview(player.id, cat.key as keyof PlayerReview, n)
                        }
                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                          score >= n
                            ? 'bg-accent text-white'
                            : 'bg-surface-dark text-text-light hover:bg-border'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Strengths */}
          <div>
            <label className="block text-sm font-medium mb-1">Strengths</label>
            <input
              type="text"
              value={review.strengths}
              onChange={(e) =>
                updateReview(player.id, 'strengths', e.target.value)
              }
              placeholder="What did they do well?"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          {/* Focus */}
          <div>
            <label className="block text-sm font-medium mb-1">Focus Next</label>
            <input
              type="text"
              value={review.focus_next}
              onChange={(e) =>
                updateReview(player.id, 'focus_next', e.target.value)
              }
              placeholder="What should they work on?"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          {/* Skip button */}
          <button
            onClick={() => {
              updateReview(player.id, 'skipped', !review.skipped)
            }}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
              review.skipped
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-surface text-text-light hover:bg-surface-dark'
            }`}
          >
            {review.skipped ? 'Unskip This Player' : 'Skip This Player'}
          </button>
        </div>
      </Card>

      {/* Previous / Next navigation */}
      <div className="flex gap-3">
        <button
          onClick={() => setCurrentIndex(Math.max(0, safeIndex - 1))}
          disabled={safeIndex === 0}
          className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors disabled:opacity-30"
        >
          &larr; Previous
        </button>
        <button
          onClick={() =>
            setCurrentIndex(Math.min(players.length - 1, safeIndex + 1))
          }
          disabled={safeIndex === players.length - 1}
          className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors disabled:opacity-30"
        >
          Next &rarr;
        </button>
      </div>

      {/* Player dots for quick jump */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {players.map((p, i) => {
          const r = reviews[p.id]
          const hasScores =
            r &&
            !r.skipped &&
            (r.attitude > 0 || r.effort > 0 || r.technical_quality > 0)
          return (
            <button
              key={p.id}
              onClick={() => setCurrentIndex(i)}
              className={`w-6 h-6 rounded-full text-[9px] font-bold transition-all ${
                i === safeIndex
                  ? 'bg-primary text-white'
                  : r?.skipped
                    ? 'bg-yellow-200 text-yellow-700'
                    : hasScores
                      ? 'bg-green-200 text-green-700'
                      : 'bg-surface-dark text-text-light'
              }`}
              title={`${p.first_name} ${p.last_name}`}
            >
              {p.first_name.charAt(0)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
