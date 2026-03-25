'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SCORE_CATEGORIES } from '@/lib/types'

interface Player {
  id: string
  first_name: string
  last_name: string
  age_group: string | null
}

const defaultScores: Record<string, number> = {
  attitude: 3,
  effort: 3,
  technical_quality: 3,
  game_understanding: 3,
  confidence: 3,
  physical_movement: 3,
}

export default function ReviewForm({
  players,
  autoOpen,
  orgId,
}: {
  players: Player[]
  autoOpen: boolean
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)
  const [playerId, setPlayerId] = useState('')
  const [reviewDate, setReviewDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [scores, setScores] = useState<Record<string, number>>({ ...defaultScores })
  const [strengths, setStrengths] = useState('')
  const [focusNext, setFocusNext] = useState('')
  const [parentSummary, setParentSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  function setScore(key: string, value: number) {
    setScores((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccess('')

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { error } = await supabase.from('progress_reviews').insert({
      organisation_id: orgId,
      player_id: playerId,
      coach_id: user.id,
      review_date: reviewDate,
      ...scores,
      strengths: strengths || null,
      focus_next: focusNext || null,
      parent_summary: parentSummary || null,
    })

    if (error) {
      alert(error.message)
    } else {
      const player = players.find((p) => p.id === playerId)
      setSuccess(`Review saved for ${player?.first_name || 'player'}!`)

      // Send progress report email to parent (fire and forget)
      if (playerId) {
        fetch('/api/email/progress-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            scores,
            strengths: strengths || '',
            focusAreas: focusNext || '',
            coachComment: parentSummary || '',
          }),
        }).catch(() => {})
      }

      setPlayerId('')
      setScores({ ...defaultScores })
      setStrengths('')
      setFocusNext('')
      setParentSummary('')
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
      >
        + New Review
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">New Progress Review</h2>
        <button onClick={() => setOpen(false)} className="text-text-light hover:text-text text-sm">Close</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Player *</label>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select player...</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                  {p.age_group ? ` (${p.age_group})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date *</label>
            <input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3">Tap to Score (1-5)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {SCORE_CATEGORIES.map((cat) => (
              <div key={cat.key} className="bg-surface rounded-lg p-3 text-center">
                <div className="text-xs text-text-light mb-2">{cat.label}</div>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScore(cat.key, n)}
                      className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                        scores[cat.key] === n
                          ? 'bg-primary text-white scale-110'
                          : scores[cat.key] > n
                            ? 'bg-primary/20 text-primary'
                            : 'bg-white text-text-light border border-border hover:border-primary/40'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Strengths</label>
            <textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={2}
              placeholder="What went well?"
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Focus Next</label>
            <textarea
              value={focusNext}
              onChange={(e) => setFocusNext(e.target.value)}
              rows={2}
              placeholder="What to work on?"
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Parent Summary <span className="text-text-light font-normal">(shown on their portal)</span>
          </label>
          <textarea
            value={parentSummary}
            onChange={(e) => setParentSummary(e.target.value)}
            rows={2}
            placeholder="e.g. 'Great session — really improving his passing and confidence on the ball.'"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
          />
        </div>

        {success && <p className="text-sm text-accent font-medium">{success}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Publishing...' : 'Publish to Parent Portal'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
