'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/Card'

interface Player {
  id: string
  first_name: string
  last_name: string
}

interface Term {
  id: string
  name: string
  is_active: boolean
}

const AWARD_TYPES = [
  { value: 'player_of_term', label: 'Player of the Term', icon: '\u{1F3C6}' },
  { value: 'most_improved', label: 'Most Improved', icon: '\u{1F31F}' },
  { value: 'best_attendance', label: 'Best Attendance', icon: '\u{2B50}' },
  { value: 'coaches_award', label: "Coach's Award", icon: '\u{1F451}' },
  { value: 'golden_boot', label: 'Golden Boot', icon: '\u{26BD}' },
  { value: 'team_player', label: 'Team Player', icon: '\u{1F91D}' },
  { value: 'rising_star', label: 'Rising Star', icon: '\u{1F525}' },
  { value: 'custom', label: 'Custom Award', icon: '\u{1F3C5}' },
]

export default function GiveAward({
  players,
  terms,
  orgId,
  userId,
}: {
  players: Player[]
  terms: Term[]
  orgId: string
  userId: string
}) {
  const router = useRouter()
  const [playerId, setPlayerId] = useState('')
  const [awardType, setAwardType] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [termId, setTermId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playerId || !awardType) return
    if (awardType === 'custom' && !customTitle.trim()) {
      setError('Please enter a custom award title')
      return
    }

    setSaving(true)
    setError('')
    setSuccess(false)

    const supabase = createClient()

    const { error: insertError } = await supabase
      .from('academy_awards')
      .insert({
        organisation_id: orgId,
        player_id: playerId,
        profile_id: userId,
        award_type: awardType,
        custom_title: awardType === 'custom' ? customTitle.trim() : null,
        term_id: termId || null,
        notes: notes.trim() || null,
      })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    // Send notification to parent
    const { data: player } = await supabase
      .from('players')
      .select('parent_id, first_name')
      .eq('id', playerId)
      .single()

    if (player?.parent_id) {
      const awardLabel = awardType === 'custom' ? customTitle : AWARD_TYPES.find((a) => a.value === awardType)?.label || awardType
      await supabase.from('notifications').insert({
        profile_id: player.parent_id,
        title: 'New Award!',
        body: `${player.first_name} has been awarded "${awardLabel}"!`,
        type: 'award',
        link: '/dashboard/awards',
      })
    }

    setSuccess(true)
    setSaving(false)
    setPlayerId('')
    setAwardType('')
    setCustomTitle('')
    setNotes('')
    router.refresh()

    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <Card title="Give an Award">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Player select */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Player</label>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none"
          >
            <option value="">Select a player...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </select>
        </div>

        {/* Award type */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Award Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {AWARD_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setAwardType(type.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                  awardType === type.value
                    ? 'bg-white/10 border-white/30 ring-1 ring-white/20'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                }`}
              >
                <span className="text-2xl">{type.icon}</span>
                <span className="text-[11px] font-medium text-white/70 leading-tight">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom title */}
        {awardType === 'custom' && (
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Custom Award Title</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Hardest Worker"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none"
            />
          </div>
        )}

        {/* Term select */}
        {terms.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Term (optional)</label>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none"
            >
              <option value="">No specific term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_active ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Reason / Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Outstanding performance throughout the term..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            <span>&#9989;</span> Award given successfully! The parent has been notified.
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !playerId || !awardType}
          className="w-full sm:w-auto bg-white text-black font-semibold rounded-lg px-6 py-2.5 text-sm hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {saving ? 'Saving...' : 'Give Award'}
        </button>
      </form>
    </Card>
  )
}
