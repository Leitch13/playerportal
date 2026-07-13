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
  const [dbCategories, setDbCategories] = useState<(ScoringCategory & { class_type?: string | null })[]>([])
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldDesc, setNewFieldDesc] = useState('')
  const [savingField, setSavingField] = useState(false)
  // Field-manager feedback: which template is mid-apply, and the last
  // result. The old modal gave NO feedback and swallowed errors — users
  // clicked templates repeatedly thinking the button was dead.
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null)
  const [fieldMsg, setFieldMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Per-class-type scoring: admin picks which class context this review is for.
  // 'all' = show universal categories only (default — most reviews are generic)
  const [reviewClassType, setReviewClassType] = useState<string>('all')

  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  // Fetch ALL custom scoring categories for this org (we filter client-side
  // based on the selected class context so admin can switch without re-fetching).
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

    setDbCategories((data as (ScoringCategory & { class_type?: string | null })[]) || [])
  }

  // Whenever the class-type filter or fetched categories change, recompute the
  // categories shown in the form. Universal (class_type IS NULL) ALWAYS show.
  useEffect(() => {
    const filtered = (dbCategories || []).filter((c) => {
      if (!c.class_type) return true // universal
      if (reviewClassType === 'all') return false // only universal when 'all'
      return c.class_type === reviewClassType
    })
    const cats = normalizeCategories(filtered as ScoringCategory[] | null)
    // Fallback to legacy defaults if zero categories match (so the form is never empty)
    if (cats.length === 0) {
      setCategories(SCORE_CATEGORIES.map((c) => ({ key: c.key, label: c.label })))
    } else {
      setCategories(cats)
    }
    const newDefaults: Record<string, number> = {}
    ;(cats.length === 0 ? SCORE_CATEGORIES.map((c) => ({ key: c.key })) : cats).forEach((c) => { newDefaults[c.key] = 3 })
    setScores(newDefaults)
  }, [dbCategories, reviewClassType])

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
    setFieldMsg(null)
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
      setFieldMsg({ kind: 'err', text: `Couldn't add field: ${error.message}. If this looks like a permissions issue, make sure migration 053 has been run in Supabase.` })
    } else if (!inserted) {
      setFieldMsg({ kind: 'err', text: 'Field was silently rejected — likely an RLS policy issue. Run migration 053 in Supabase to fix.' })
    } else {
      const added = newFieldName.trim()
      setNewFieldName('')
      setNewFieldDesc('')
      await fetchCategories()
      setFieldMsg({ kind: 'ok', text: `"${added}" added` })
    }
    setSavingField(false)
  }

  async function removeField(id: string, name: string) {
    setFieldMsg(null)
    const supabase = createClient()
    const { error } = await supabase.from('scoring_categories').update({ is_active: false }).eq('id', id)
    if (error) {
      setFieldMsg({ kind: 'err', text: `Couldn't remove "${name}": ${error.message}` })
      return
    }
    await fetchCategories()
    setFieldMsg({ kind: 'ok', text: `"${name}" removed` })
  }

  async function loadTemplate(templateName: string, template: { name: string; icon: string; description: string }[]) {
    setSavingField(true)
    setApplyingTemplate(templateName)
    setFieldMsg(null)
    const supabase = createClient()
    try {
      // Deactivate the current set. Every step is error-checked — the old
      // version discarded results, so failures looked like a dead button.
      const { error: deErr } = await supabase
        .from('scoring_categories')
        .update({ is_active: false })
        .eq('organisation_id', orgId)
      if (deErr) throw new Error(deErr.message)

      // Reuse this org's existing rows where names match instead of always
      // inserting — repeated template clicks used to pile up dead rows.
      const { error: exErr, data: existing } = await supabase
        .from('scoring_categories')
        .select('id, name')
        .eq('organisation_id', orgId)
      if (exErr) throw new Error(exErr.message)
      const idByName = new Map((existing || []).map(r => [r.name as string, r.id as string]))

      const reactivate: { id: string; sort: number }[] = []
      const insert: Record<string, unknown>[] = []
      template.forEach((t, i) => {
        const id = idByName.get(t.name)
        if (id) reactivate.push({ id, sort: i + 1 })
        else insert.push({ organisation_id: orgId, name: t.name, description: t.description, icon: t.icon, sort_order: i + 1, is_active: true })
      })
      for (const r of reactivate) {
        const { error } = await supabase.from('scoring_categories').update({ is_active: true, sort_order: r.sort }).eq('id', r.id)
        if (error) throw new Error(error.message)
      }
      if (insert.length > 0) {
        const { error } = await supabase.from('scoring_categories').insert(insert)
        if (error) throw new Error(error.message)
      }

      await fetchCategories()
      setFieldMsg({ kind: 'ok', text: `${templateName} template applied — ${template.length} fields` })
    } catch (err) {
      setFieldMsg({ kind: 'err', text: `Couldn't apply the ${templateName} template: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setSavingField(false)
      setApplyingTemplate(null)
    }
  }

  const inputClass = 'w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors'

  // ── Scoring-fields manager (single shared modal) ──
  // Previously duplicated inline in two places with no feedback states.
  const TEMPLATES: { key: string; icon: string; blurb: string; fields: { name: string; icon: string; description: string }[] }[] = [
    { key: 'Football', icon: '⚽', blurb: 'Outfield fundamentals', fields: FOOTBALL_DEFAULTS },
    { key: 'Goalkeeper', icon: '🧤', blurb: 'Keeper-specific skills', fields: GOALKEEPER_DEFAULTS },
    { key: 'General Sport', icon: '🏅', blurb: 'Sport-agnostic development', fields: CUSTOM_SPORT_DEFAULTS },
  ]
  const activeNames = new Set(dbCategories.map(d => d.name))
  const isTemplateActive = (t: (typeof TEMPLATES)[number]) =>
    dbCategories.length === t.fields.length && t.fields.every(f => activeNames.has(f.name))

  function closeFieldManager() {
    setShowFieldManager(false)
    setFieldMsg(null)
  }

  const renderFieldManager = () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeFieldManager}>
      <div className="bg-[#111214] border border-[#232527] rounded-2xl w-full max-w-xl shadow-2xl shadow-black/50 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#1e2022]">
          <div>
            <h2 className="text-lg font-bold text-white">Scoring fields</h2>
            <p className="text-xs text-white/45 mt-0.5">Used by every coach in your academy when writing player reports</p>
          </div>
          <button onClick={closeFieldManager} aria-label="Close" className="w-8 h-8 -mr-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors text-base leading-none">✕</button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Feedback banner — success or error, never silent */}
          {fieldMsg && (
            <div className={`flex items-center gap-2 text-xs font-medium rounded-xl px-3.5 py-2.5 border ${fieldMsg.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
              <span aria-hidden="true">{fieldMsg.kind === 'ok' ? '✓' : '⚠'}</span>
              <span>{fieldMsg.text}</span>
            </div>
          )}

          {/* Templates */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2.5">Start from a template</p>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => {
                const active = isTemplateActive(t)
                const applying = applyingTemplate === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => loadTemplate(t.key, t.fields)}
                    disabled={savingField || active}
                    className={`relative text-left rounded-xl border p-3 transition-all ${active ? 'border-primary/60 bg-primary/[0.07]' : 'border-[#26282b] bg-[#17181a] hover:border-primary/35 hover:bg-[#1b1d1f]'} disabled:cursor-default`}
                  >
                    <div className="text-xl mb-1.5">{applying ? <span className="inline-block animate-spin">◌</span> : t.icon}</div>
                    <div className="text-[13px] font-semibold text-white leading-tight">{t.key}</div>
                    <div className="text-[11px] text-white/40 mt-0.5 leading-snug">{applying ? 'Applying…' : t.blurb}</div>
                    <div className="text-[10px] text-white/30 mt-1.5">{t.fields.length} fields</div>
                    {active && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/15 border border-primary/30 rounded-full px-1.5 py-0.5">In use</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Active fields */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2.5">Active fields ({categories.length})</p>
            <div className="space-y-1.5">
              {categories.map((cat) => {
                const dbCat = dbCategories.find(d => d.name === cat.label)
                return (
                  <div key={cat.key} className="group flex items-center gap-3 bg-[#17181a] border border-[#232527] rounded-xl px-3.5 py-2.5 hover:border-[#2e3033] transition-colors">
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-[#1f2124] border border-[#2a2c2f] flex items-center justify-center text-sm">{cat.icon || '•'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white leading-tight">{cat.label}</div>
                      {dbCat?.description && <div className="text-[11px] text-white/35 truncate">{dbCat.description}</div>}
                    </div>
                    {dbCat && (
                      <button onClick={() => removeField(dbCat.id, cat.label)} disabled={savingField} className="text-[11px] font-medium text-white/25 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all disabled:opacity-30">
                        Remove
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Add custom field */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2.5">Add your own</p>
            <div className="flex gap-2">
              <input
                value={newFieldName}
                onChange={e => setNewFieldName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomField() } }}
                placeholder="e.g. Leadership"
                className="flex-1 bg-[#17181a] border border-[#26282b] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={addCustomField}
                disabled={savingField || !newFieldName.trim()}
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {savingField && !applyingTemplate ? 'Adding…' : 'Add'}
              </button>
            </div>
            <input
              value={newFieldDesc}
              onChange={e => setNewFieldDesc(e.target.value)}
              placeholder="Short description shown to coaches (optional)"
              className="w-full mt-2 bg-[#17181a] border border-[#26282b] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2022] bg-[#0e0f11]">
          <p className="text-[11px] text-white/30">Changes apply immediately for all coaches</p>
          <button onClick={closeFieldManager} className="px-5 py-2 bg-[#1c1e20] border border-[#2a2c2f] text-white/80 rounded-xl text-sm font-semibold hover:bg-[#232527] hover:text-white transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )

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

        {/* Scoring-fields manager (shared) */}
        {showFieldManager && renderFieldManager()}
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
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="text-sm font-semibold text-white">Scores <span className="text-white/40 font-normal">(tap 1–5)</span></h3>
            <div className="flex items-center gap-2">
              {/* Class-type picker — filters categories. Universal categories always show. */}
              <select
                value={reviewClassType}
                onChange={(e) => setReviewClassType(e.target.value)}
                className="text-xs bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-white/80 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/40"
                title="What class context is this review for?"
              >
                <option value="all">Universal scoring</option>
                <option value="soccer_tots">Soccer Tots</option>
                <option value="group">Group</option>
                <option value="small_group">Small Group</option>
                <option value="1-2-1">1-2-1</option>
                <option value="2-1">2-1 Pair</option>
                <option value="gk">Goalkeeper</option>
                <option value="academy">Academy</option>
                <option value="accelerator">Accelerator</option>
                <option value="elite">Elite</option>
                <option value="intensity">Intensity</option>
                <option value="girls">Girls</option>
                <option value="adults">Adults</option>
                <option value="camp">Camp</option>
              </select>
              <button
                type="button"
                onClick={() => setShowFieldManager(true)}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Customise fields
              </button>
            </div>
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

      {/* Scoring-fields manager (shared) */}
      {showFieldManager && renderFieldManager()}
    </div>
  )
}
