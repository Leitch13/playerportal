'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FOOTBALL_DEFAULTS,
  GOALKEEPER_DEFAULTS,
  CUSTOM_SPORT_DEFAULTS,
  type ScoringCategory,
} from '@/lib/scoring-categories'

interface LocalCategory {
  id?: string
  name: string
  description: string
  icon: string
  sort_order: number
  is_active: boolean
  isNew?: boolean
}

export default function ScoringCategories({ orgId }: { orgId: string }) {
  const [categories, setCategories] = useState<LocalCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newIcon, setNewIcon] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('scoring_categories')
      .select('*')
      .eq('organisation_id', orgId)
      .order('sort_order', { ascending: true })
    setCategories(
      (data || []).map((c: ScoringCategory) => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        icon: c.icon || '',
        sort_order: c.sort_order,
        is_active: c.is_active,
      }))
    )
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  function moveUp(index: number) {
    if (index === 0) return
    setCategories((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next.map((c, i) => ({ ...c, sort_order: i }))
    })
  }

  function moveDown(index: number) {
    if (index >= categories.length - 1) return
    setCategories((prev) => {
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next.map((c, i) => ({ ...c, sort_order: i }))
    })
  }

  function toggleActive(index: number) {
    setCategories((prev) =>
      prev.map((c, i) => (i === index ? { ...c, is_active: !c.is_active } : c))
    )
  }

  function removeCategory(index: number) {
    setCategories((prev) => prev.filter((_, i) => i !== index).map((c, i) => ({ ...c, sort_order: i })))
  }

  function addCategory() {
    if (!newName.trim()) return
    setCategories((prev) => [
      ...prev,
      {
        name: newName.trim(),
        description: newDesc.trim(),
        icon: newIcon.trim(),
        sort_order: prev.length,
        is_active: true,
        isNew: true,
      },
    ])
    setNewName('')
    setNewDesc('')
    setNewIcon('')
    setShowAdd(false)
  }

  async function loadTemplate(
    template: { name: string; icon: string; description: string }[]
  ) {
    if (
      categories.length > 0 &&
      !confirm('This will replace your current categories. Continue?')
    )
      return
    setCategories(
      template.map((t, i) => ({
        name: t.name,
        description: t.description,
        icon: t.icon,
        sort_order: i,
        is_active: true,
        isNew: true,
      }))
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()

      // Delete existing categories for this org
      await supabase
        .from('scoring_categories')
        .delete()
        .eq('organisation_id', orgId)

      // Insert all current categories
      if (categories.length > 0) {
        const rows = categories.map((c, i) => ({
          organisation_id: orgId,
          name: c.name,
          description: c.description || null,
          icon: c.icon || null,
          sort_order: i,
          is_active: c.is_active,
        }))
        const { error } = await supabase.from('scoring_categories').insert(rows)
        if (error) throw error
      }

      showToast('Scoring categories saved!')
      await fetchCategories()
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Failed to save'}`)
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all placeholder:text-white/30'

  if (loading) {
    return (
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-white/10 rounded" />
          <div className="h-12 bg-white/5 rounded-xl" />
          <div className="h-12 bg-white/5 rounded-xl" />
          <div className="h-12 bg-white/5 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      <div>
        <h2 className="font-bold text-lg">Scoring Categories</h2>
        <p className="text-[#888] text-sm mt-1">
          Define the categories coaches use to rate players in progress reviews.
        </p>
      </div>

      {/* Template buttons */}
      <div>
        <p className="text-xs font-medium text-white/70 mb-2">Load Defaults</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => loadTemplate(FOOTBALL_DEFAULTS)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors border border-green-500/20"
          >
            Football Defaults
          </button>
          <button
            onClick={() => loadTemplate(GOALKEEPER_DEFAULTS)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
          >
            Goalkeeper Defaults
          </button>
          <button
            onClick={() => loadTemplate(CUSTOM_SPORT_DEFAULTS)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors border border-purple-500/20"
          >
            Custom Sport Defaults
          </button>
        </div>
      </div>

      {/* Category list */}
      {categories.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-white/40 text-sm">
            No scoring categories yet. Add your own or load a template above.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat, i) => (
            <div
              key={cat.id || `new-${i}`}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                cat.is_active
                  ? 'border-[#1e1e1e] bg-[#1a1a1a]'
                  : 'border-[#1e1e1e] bg-[#111] opacity-50'
              }`}
            >
              {/* Reorder arrows */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="text-white/30 hover:text-white disabled:opacity-20 text-xs leading-none"
                  title="Move up"
                >
                  {'\u25B2'}
                </button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === categories.length - 1}
                  className="text-white/30 hover:text-white disabled:opacity-20 text-xs leading-none"
                  title="Move down"
                >
                  {'\u25BC'}
                </button>
              </div>

              {/* Icon */}
              <span className="text-lg w-7 text-center flex-shrink-0">
                {cat.icon || '\u2B50'}
              </span>

              {/* Name & description */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {cat.name}
                </p>
                {cat.description && (
                  <p className="text-xs text-white/40 truncate">{cat.description}</p>
                )}
              </div>

              {/* Toggle active */}
              <button
                onClick={() => toggleActive(i)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold transition-colors ${
                  cat.is_active
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/[0.05] text-white/40'
                }`}
              >
                {cat.is_active ? 'Active' : 'Inactive'}
              </button>

              {/* Delete */}
              <button
                onClick={() => removeCategory(i)}
                className="text-white/30 hover:text-red-400 transition-colors text-sm"
                title="Remove"
              >
                {'\u2715'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add category form */}
      {showAdd ? (
        <div className="border border-[#2a2a2a] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Add Category</h3>
          <div>
            <label className="text-xs font-medium text-white/70 block mb-1">
              Name *
            </label>
            <input
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Ball Control"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-white/70 block mb-1">
              Description
            </label>
            <input
              className={inputClass}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="e.g. First touch, trapping"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-white/70 block mb-1">
              Icon (emoji)
            </label>
            <input
              className={inputClass + ' max-w-[120px]'}
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              placeholder="e.g. \u26BD"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addCategory}
              disabled={!newName.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-30 transition-all"
            >
              Add
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-[#2a2a2a] text-white/60 hover:bg-[#1e1e1e] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-dashed border-[#2a2a2a] text-white/50 hover:text-white hover:border-white/20 transition-all w-full"
        >
          + Add Category
        </button>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-all"
      >
        {saving ? 'Saving...' : 'Save Categories'}
      </button>
    </div>
  )
}
