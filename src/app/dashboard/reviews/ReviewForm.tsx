'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SCORE_CATEGORIES } from '@/lib/types'
import { normalizeCategories, type ScoringCategory, type NormalizedCategory, FOOTBALL_DEFAULTS, GOALKEEPER_DEFAULTS, CUSTOM_SPORT_DEFAULTS } from '@/lib/scoring-categories'

interface Player {
  id: string
  first_name: string
  last_name: string
  age_group: string | null
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
  const [scores, setScores] = useState<Record<string, number>>({})
  const [strengths, setStrengths] = useState('')
  const [focusNext, setFocusNext] = useState('')
  const [parentSummary, setParentSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [categories, setCategories] = useState<NormalizedCategory[]>(
    SCORE_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))
  )
  const [searchQuery, setSearchQuery] = useState('')

  // Custom fields manager
  const [showFieldManager, setShowFieldManager] = useState(false)
  const [dbCategories, setDbCategories] = useState<ScoringCategory[]>([])
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldDesc, setNewFieldDesc] = useState('')
  const [savingField, setSavingField] = useState(false)

  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  // Fetch custom scoring categories for this org
  useEffect(() => {
    if (!orgId) return
    fetchCategories()
  }, [orgId])

  async function fetchCategories() {
    const supabase = createClient()
    const { data } = await supabase
      .from('scoring_categories')
      .select('*')
      .eq('organisation_id', orgId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    setDbCategories((data as ScoringCategory[]) || [])
    const cats = normalizeCategories(data as ScoringCategory[] | null)
    setCategories(cats)
    const newDefaults: Record<string, number> = {}
    cats.forEach((c) => { newDefaults[c.key] = 3 })
    setScores(newDefaults)
  }

  function setScore(key: string, value: number) {
    setScores((prev) => ({ ...prev, [key]: value }))
  }

  const filteredPlayers = searchQuery
    ? players.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.age_group && p.age_group.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : players

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

    // Store scores in JSONB column, plus backfill legacy columns if they exist
    const legacyKeys = ['attitude', 'effort', 'technical_quality', 'game_understanding', 'confidence', 'physical_movement']
    const legacyScores: Record<string, number> = {}
    legacyKeys.forEach(k => { if (scores[k] !== undefined) legacyScores[k] = scores[k] })

    const { error } = await supabase.from('progress_reviews').insert({
      organisation_id: orgId,
      player_id: playerId,
      coach_id: user.id,
      review_date: reviewDate,
      scores,
      ...legacyScores,
      strengths: strengths || null,
      focus_next: focusNext || null,
      parent_summary: parentSummary || null,
    })

    if (error) {
      alert(error.message)
    } else {
      const player = players.find((p) => p.id === playerId)
      setSuccess(`Review published for ${player?.first_name} ${player?.last_name}!`)

      // Send progress report email to parent
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
      const resetScores: Record<string, number> = {}
      categories.forEach((c) => { resetScores[c.key] = 3 })
      setScores(resetScores)
      setStrengths('')
      setFocusNext('')
      setParentSummary('')
      setSearchQuery('')
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
    setLoading(false)
  }

  async function addCustomField() {
    if (!newFieldName.trim()) return
    setSavingField(true)
    const supabase = createClient()
    const nextOrder = dbCategories.length > 0
      ? Math.max(...dbCategories.map(c => c.sort_order)) + 1
      : 1

    const { data: inserted, error } = await supabase
      .from('scoring_categories')
      .insert({
        organisation_id: orgId,
        name: newFieldName.trim(),
        description: newFieldDesc.trim() || null,
        sort_order: nextOrder,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) {
      alert(`Couldn't add field: ${error.message}\n\nIf this looks like a permissions issue, make sure migration 053 has been run in Supabase.`)
    } else if (!inserted) {
      alert('Custom field was silently rejected — likely an RLS policy issue. Run migration 053 in Supabase to fix.')
    } else {
      setNewFieldName('')
      setNewFieldDesc('')
      await fetchCategories()
    }
    setSavingField(false)
  }

  async function removeField(id: string) {
    const supabase = createClient()
    await supabase.from('scoring_categories').update({ is_active: false }).eq('id', id)
    await fetchCategories()
  }

  async function loadTemplate(template: { name: string; icon: string; description: string }[]) {
    setSavingField(true)
    const supabase = createClient()

    // Deactivate existing
    if (dbCategories.length > 0) {
      await supabase
        .from('scoring_categories')
        .update({ is_active: false })
        .eq('organisation_id', orgId)
    }

    // Insert template
    const rows = template.map((t, i) => ({
      organisation_id: orgId,
      name: t.name,
      description: t.description,
      icon: t.icon,
      sort_order: i + 1,
      is_active: true,
    }))

    await supabase.from('scoring_categories').insert(rows)
    await fetchCategories()
    setSavingField(false)
  }

  const inputClass = 'w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors'

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          + New Report
        </button>
        <button
          onClick={() => setShowFieldManager(!showFieldManager)}
          className="px-4 py-2.5 bg-[#141414] border border-[#1e1e1e] text-white/70 rounded-xl text-sm font-medium hover:bg-[#1a1a1a] hover:text-white transition-colors"
        >
          Customise Fields
        </button>

        {/* Custom Fields Manager (inline) */}
        {showFieldManager && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFieldManager(false)}>
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6 w-full max-w-lg space-y-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Scoring Categories</h2>
                <button onClick={() => setShowFieldManager(false)} className="text-white/40 hover:text-white text-sm">Close</button>
              </div>

              <p className="text-xs text-white/50">Customise the scoring fields used in player reports. These apply to all coaches in your academy.</p>

              {/* Templates */}
              <div>
                <p className="text-xs font-medium text-white/60 mb-2">Load a template</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => loadTemplate(FOOTBALL_DEFAULTS)} disabled={savingField} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white/70 hover:text-white hover:border-primary/30 transition-colors disabled:opacity-50">
                    Football
                  </button>
                  <button onClick={() => loadTemplate(GOALKEEPER_DEFAULTS)} disabled={savingField} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white/70 hover:text-white hover:border-primary/30 transition-colors disabled:opacity-50">
                    Goalkeeper
                  </button>
                  <button onClick={() => loadTemplate(CUSTOM_SPORT_DEFAULTS)} disabled={savingField} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white/70 hover:text-white hover:border-primary/30 transition-colors disabled:opacity-50">
                    General Sport
                  </button>
                </div>
              </div>

              {/* Current fields */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-white/60">Active categories ({categories.length})</p>
                {categories.map((cat) => {
                  const dbCat = dbCategories.find(d => d.name === cat.label)
                  return (
                    <div key={cat.key} className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {cat.icon && <span className="text-sm">{cat.icon}</span>}
                        <span className="text-sm font-medium text-white">{cat.label}</span>
                      </div>
                      {dbCat && (
                        <button onClick={() => removeField(dbCat.id)} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Remove</button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add new field */}
              <div className="border-t border-[#1e1e1e] pt-4 space-y-3">
                <p className="text-xs font-medium text-white/60">Add custom field</p>
                <div className="flex gap-2">
                  <input
                    value={newFieldName}
                    onChange={e => setNewFieldName(e.target.value)}
                    placeholder="e.g. Leadership"
                    className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    onClick={addCustomField}
                    disabled={savingField || !newFieldName.trim()}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <input
                  value={newFieldDesc}
                  onChange={e => setNewFieldDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const selectedPlayer = players.find(p => p.id === playerId)

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">New Player Report</h2>
          <p className="text-xs text-white/40 mt-0.5">Score, write feedback, and publish to the parent portal</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-sm transition-colors">Close</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Player & Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-white/60 block mb-1.5">Player *</label>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Select player...</option>
              {filteredPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                  {p.age_group ? ` (${p.age_group})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-white/60 block mb-1.5">Review Date *</label>
            <input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              required
              className={inputClass}
            />
          </div>
        </div>

        {/* Scoring */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Scores <span className="text-white/40 font-normal">(tap 1–5)</span></h3>
            <button
              type="button"
              onClick={() => setShowFieldManager(true)}
              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Customise fields
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map((cat) => (
              <div key={cat.key} className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-3 text-center">
                <div className="text-[11px] text-white/50 mb-2 font-medium">{cat.icon && <span className="mr-1">{cat.icon}</span>}{cat.label}</div>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScore(cat.key, n)}
                      className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                        scores[cat.key] === n
                          ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/20'
                          : scores[cat.key] > n
                            ? 'bg-primary/15 text-primary'
                            : 'bg-[#1a1a1a] text-white/30 border border-[#2a2a2a] hover:border-primary/40 hover:text-white/60'
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

        {/* Written Feedback */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-white/60 block mb-1.5">Strengths</label>
            <textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={3}
              placeholder="What went well this session?"
              className={inputClass + ' resize-none'}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-white/60 block mb-1.5">Areas to Improve</label>
            <textarea
              value={focusNext}
              onChange={(e) => setFocusNext(e.target.value)}
              rows={3}
              placeholder="What should they work on next?"
              className={inputClass + ' resize-none'}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-white/60 block mb-1.5">
            Parent Summary <span className="text-white/30">(shown on their portal)</span>
          </label>
          <textarea
            value={parentSummary}
            onChange={(e) => setParentSummary(e.target.value)}
            rows={3}
            placeholder="e.g. 'Great session — really improving his passing and confidence on the ball.'"
            className={inputClass + ' resize-none'}
          />
        </div>

        {success && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-green-400 font-medium">{success}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !playerId}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Publishing...' : 'Publish to Parent Portal'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-[#222] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Custom Fields Manager Modal */}
      {showFieldManager && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFieldManager(false)}>
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6 w-full max-w-lg space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Scoring Categories</h2>
              <button onClick={() => setShowFieldManager(false)} className="text-white/40 hover:text-white text-sm">Close</button>
            </div>

            <p className="text-xs text-white/50">Customise the scoring fields used in player reports. These apply to all coaches in your academy.</p>

            {/* Templates */}
            <div>
              <p className="text-xs font-medium text-white/60 mb-2">Load a template</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => loadTemplate(FOOTBALL_DEFAULTS)} disabled={savingField} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white/70 hover:text-white hover:border-primary/30 transition-colors disabled:opacity-50">
                  Football
                </button>
                <button onClick={() => loadTemplate(GOALKEEPER_DEFAULTS)} disabled={savingField} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white/70 hover:text-white hover:border-primary/30 transition-colors disabled:opacity-50">
                  Goalkeeper
                </button>
                <button onClick={() => loadTemplate(CUSTOM_SPORT_DEFAULTS)} disabled={savingField} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white/70 hover:text-white hover:border-primary/30 transition-colors disabled:opacity-50">
                  General Sport
                </button>
              </div>
            </div>

            {/* Current fields */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/60">Active categories ({categories.length})</p>
              {categories.map((cat) => {
                const dbCat = dbCategories.find(d => d.name === cat.label)
                return (
                  <div key={cat.key} className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {cat.icon && <span className="text-sm">{cat.icon}</span>}
                      <span className="text-sm font-medium text-white">{cat.label}</span>
                    </div>
                    {dbCat && (
                      <button onClick={() => removeField(dbCat.id)} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Remove</button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Add new field */}
            <div className="border-t border-[#1e1e1e] pt-4 space-y-3">
              <p className="text-xs font-medium text-white/60">Add custom field</p>
              <div className="flex gap-2">
                <input
                  value={newFieldName}
                  onChange={e => setNewFieldName(e.target.value)}
                  placeholder="e.g. Leadership"
                  className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomField() } }}
                />
                <button
                  onClick={addCustomField}
                  disabled={savingField || !newFieldName.trim()}
                  className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </div>
              <input
                value={newFieldDesc}
                onChange={e => setNewFieldDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
