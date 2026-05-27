'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FOOTBALL_DEFAULTS,
  GOALKEEPER_DEFAULTS,
  CUSTOM_SPORT_DEFAULTS,
  DEFAULTS_BY_CLASS_TYPE,
  type ScoringCategory,
} from '@/lib/scoring-categories'

interface LocalCategory {
  id?: string
  name: string
  description: string
  icon: string
  sort_order: number
  is_active: boolean
  class_type: string | null
  isNew?: boolean
}

// Mirror the training_groups class_type values.
const CLASS_TYPE_OPTIONS = [
  { value: '__universal__', label: 'Universal (all classes)', dbValue: null },
  { value: 'soccer_tots', label: 'Soccer Tots', dbValue: 'soccer_tots' },
  { value: 'group', label: 'Group', dbValue: 'group' },
  { value: 'small_group', label: 'Small Group', dbValue: 'small_group' },
  { value: '1-2-1', label: '1-2-1', dbValue: '1-2-1' },
  { value: '2-1', label: '2-1 Pair', dbValue: '2-1' },
  { value: 'gk', label: 'Goalkeeper', dbValue: 'gk' },
  { value: 'academy', label: 'Academy', dbValue: 'academy' },
  { value: 'accelerator', label: 'Accelerator', dbValue: 'accelerator' },
  { value: 'elite', label: 'Elite', dbValue: 'elite' },
  { value: 'intensity', label: 'Intensity', dbValue: 'intensity' },
  { value: 'girls', label: 'Girls', dbValue: 'girls' },
  { value: 'adults', label: 'Adults', dbValue: 'adults' },
  { value: 'camp', label: 'Camp', dbValue: 'camp' },
  { value: 'trial', label: 'Trial', dbValue: 'trial' },
] as const

type TabValue = (typeof CLASS_TYPE_OPTIONS)[number]['value'] | '__all__'

const TAB_OPTIONS: Array<{ value: TabValue; label: string }> = [
  { value: '__all__', label: 'All Categories' },
  ...CLASS_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
]

function dbValueFor(tab: TabValue): string | null | undefined {
  if (tab === '__all__') return undefined // no filter
  if (tab === '__universal__') return null // class_type IS NULL
  return tab
}

function classTypeLabel(classType: string | null): string {
  if (!classType) return 'Universal'
  const match = CLASS_TYPE_OPTIONS.find((o) => o.dbValue === classType)
  return match?.label || classType
}

function classTypeBadgeColor(classType: string | null): string {
  if (!classType) return 'bg-white/10 text-white/70 border border-white/15'
  const map: Record<string, string> = {
    soccer_tots: 'bg-pink-500/15 text-pink-300 border border-pink-500/30',
    group: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    small_group: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    '1-2-1': 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    '2-1': 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
    gk: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30',
    academy: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    accelerator: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    elite: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
    intensity: 'bg-red-500/15 text-red-300 border border-red-500/30',
    girls: 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30',
    adults: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
    camp: 'bg-green-500/15 text-green-300 border border-green-500/30',
    trial: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  }
  return map[classType] || 'bg-white/10 text-white/70 border border-white/15'
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
  const [newClassType, setNewClassType] = useState<TabValue>('__universal__')
  const [activeTab, setActiveTab] = useState<TabValue>('__all__')

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
      .order('class_type', { ascending: true, nullsFirst: true })
      .order('sort_order', { ascending: true })
    setCategories(
      (data || []).map((c: ScoringCategory & { class_type: string | null }) => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        icon: c.icon || '',
        sort_order: c.sort_order,
        is_active: c.is_active,
        class_type: c.class_type || null,
      }))
    )
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Counts per tab (shown as numbers in the tab strip)
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { __all__: categories.length, __universal__: 0 }
    for (const opt of CLASS_TYPE_OPTIONS) {
      if (opt.value !== '__universal__') counts[opt.value] = 0
    }
    for (const cat of categories) {
      if (cat.class_type === null) counts.__universal__++
      else if (counts[cat.class_type] !== undefined) counts[cat.class_type]++
    }
    return counts
  }, [categories])

  // The categories visible in the current tab
  const visibleIndexes = useMemo(() => {
    return categories
      .map((cat, idx) => ({ cat, idx }))
      .filter(({ cat }) => {
        if (activeTab === '__all__') return true
        if (activeTab === '__universal__') return cat.class_type === null
        return cat.class_type === activeTab
      })
      .map(({ idx }) => idx)
  }, [categories, activeTab])

  function moveUp(globalIdx: number) {
    setCategories((prev) => {
      // Within the visible group, find the prev one and swap
      const visible = prev
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => {
          if (activeTab === '__all__') return true
          if (activeTab === '__universal__') return c.class_type === null
          return c.class_type === activeTab
        })
      const here = visible.findIndex((v) => v.i === globalIdx)
      if (here <= 0) return prev
      const swapIdx = visible[here - 1].i
      const next = [...prev]
      ;[next[globalIdx], next[swapIdx]] = [next[swapIdx], next[globalIdx]]
      return next.map((c, i) => ({ ...c, sort_order: i }))
    })
  }

  function moveDown(globalIdx: number) {
    setCategories((prev) => {
      const visible = prev
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => {
          if (activeTab === '__all__') return true
          if (activeTab === '__universal__') return c.class_type === null
          return c.class_type === activeTab
        })
      const here = visible.findIndex((v) => v.i === globalIdx)
      if (here < 0 || here >= visible.length - 1) return prev
      const swapIdx = visible[here + 1].i
      const next = [...prev]
      ;[next[globalIdx], next[swapIdx]] = [next[swapIdx], next[globalIdx]]
      return next.map((c, i) => ({ ...c, sort_order: i }))
    })
  }

  function toggleActive(globalIdx: number) {
    setCategories((prev) => prev.map((c, i) => (i === globalIdx ? { ...c, is_active: !c.is_active } : c)))
  }

  function removeCategory(globalIdx: number) {
    setCategories((prev) => prev.filter((_, i) => i !== globalIdx).map((c, i) => ({ ...c, sort_order: i })))
  }

  function addCategory() {
    if (!newName.trim()) return
    const dbValue = CLASS_TYPE_OPTIONS.find((o) => o.value === newClassType)?.dbValue ?? null
    setCategories((prev) => [
      ...prev,
      {
        name: newName.trim(),
        description: newDesc.trim(),
        icon: newIcon.trim(),
        sort_order: prev.length,
        is_active: true,
        class_type: dbValue,
        isNew: true,
      },
    ])
    setNewName('')
    setNewDesc('')
    setNewIcon('')
    // Keep newClassType so admin can add several to the same type in a row
    setShowAdd(false)
  }

  async function loadTemplate(
    template: { name: string; icon: string; description: string }[]
  ) {
    // Loads template into the currently active tab (so admin can build per-class-type sets)
    const targetClassType =
      activeTab === '__all__' || activeTab === '__universal__'
        ? null
        : CLASS_TYPE_OPTIONS.find((o) => o.value === activeTab)?.dbValue ?? null

    const tabLabel = targetClassType ? classTypeLabel(targetClassType) : 'Universal'
    if (
      categories.some((c) => c.class_type === targetClassType) &&
      !confirm(
        `This will REPLACE the existing ${tabLabel} categories. Other class types are untouched. Continue?`
      )
    ) {
      return
    }

    setCategories((prev) => {
      // Remove existing categories for the target class_type
      const keep = prev.filter((c) => c.class_type !== targetClassType)
      const fresh = template.map((t) => ({
        name: t.name,
        description: t.description,
        icon: t.icon,
        sort_order: keep.length,
        is_active: true,
        class_type: targetClassType,
        isNew: true,
      }))
      return [...keep, ...fresh].map((c, i) => ({ ...c, sort_order: i }))
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()

      // Delete-and-reinsert is safe because we always load ALL categories first,
      // then save the full set back. Per-class-type isolation isn't needed at the
      // DB level since the local state is authoritative.
      await supabase
        .from('scoring_categories')
        .delete()
        .eq('organisation_id', orgId)

      if (categories.length > 0) {
        const rows = categories.map((c, i) => ({
          organisation_id: orgId,
          name: c.name,
          description: c.description || null,
          icon: c.icon || null,
          sort_order: i,
          is_active: c.is_active,
          class_type: c.class_type,
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
          Different class types can have different scoring sheets. Soccer Tots are scored differently to 1-2-1 players. Pick a tab below to manage that type&apos;s categories.
        </p>
      </div>

      {/* Class type tabs */}
      <div className="border-b border-[#1e1e1e] -mx-6 px-6">
        <div className="flex gap-1 overflow-x-auto pb-px scrollbar-thin">
          {TAB_OPTIONS.map((tab) => {
            const count = tabCounts[tab.value] ?? 0
            const isActive = activeTab === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`shrink-0 px-3 py-2.5 text-xs font-semibold transition-all relative whitespace-nowrap ${
                  isActive
                    ? 'text-white border-b-2 border-[#4ecde6] -mb-px'
                    : 'text-white/40 hover:text-white/70 border-b-2 border-transparent'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-[#4ecde6] text-[#0a0a0a]' : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Template buttons */}
      <div>
        <p className="text-xs font-medium text-white/70 mb-2">
          Load Defaults into <span className="text-white">{activeTab === '__all__' ? 'Universal' : TAB_OPTIONS.find((t) => t.value === activeTab)?.label}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Smart per-class-type default — uses the CURRENT tab's class type to pick an age-appropriate set */}
          {(() => {
            const tabClassType =
              activeTab === '__all__' || activeTab === '__universal__'
                ? null
                : CLASS_TYPE_OPTIONS.find((o) => o.value === activeTab)?.dbValue ?? null
            const smartDefaults = tabClassType ? DEFAULTS_BY_CLASS_TYPE[tabClassType] : null
            if (!smartDefaults) return null
            const tabLabel = TAB_OPTIONS.find((t) => t.value === activeTab)?.label || ''
            return (
              <button
                onClick={() => loadTemplate(smartDefaults)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#4ecde6]/15 text-[#4ecde6] hover:bg-[#4ecde6]/25 transition-colors border border-[#4ecde6]/40 shadow-[0_0_12px_rgba(78,205,230,0.15)]"
                title={`Load ${smartDefaults.length} categories tuned for ${tabLabel} players`}
              >
                ✨ Suggested for {tabLabel}
              </button>
            )
          })()}
          <button
            onClick={() => loadTemplate(FOOTBALL_DEFAULTS)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors border border-green-500/20"
          >
            Football
          </button>
          <button
            onClick={() => loadTemplate(GOALKEEPER_DEFAULTS)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
          >
            Goalkeeper
          </button>
          <button
            onClick={() => loadTemplate(CUSTOM_SPORT_DEFAULTS)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors border border-purple-500/20"
          >
            Custom Sport
          </button>
        </div>
      </div>

      {/* Category list */}
      {visibleIndexes.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-white/40 text-sm">
            No scoring categories {activeTab === '__all__' ? 'yet' : `for ${TAB_OPTIONS.find((t) => t.value === activeTab)?.label}`}. Add your own or load a template above.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleIndexes.map((globalIdx) => {
            const cat = categories[globalIdx]
            return (
              <div
                key={cat.id || `new-${globalIdx}`}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  cat.is_active ? 'border-[#1e1e1e] bg-[#1a1a1a]' : 'border-[#1e1e1e] bg-[#111] opacity-50'
                }`}
              >
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveUp(globalIdx)} className="text-white/30 hover:text-white text-xs leading-none" title="Move up">▲</button>
                  <button onClick={() => moveDown(globalIdx)} className="text-white/30 hover:text-white text-xs leading-none" title="Move down">▼</button>
                </div>

                {/* Icon */}
                <span className="text-lg w-7 text-center flex-shrink-0">{cat.icon || '⭐'}</span>

                {/* Name & description */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{cat.name}</p>
                  {cat.description && <p className="text-xs text-white/40 truncate">{cat.description}</p>}
                </div>

                {/* Class type badge (only shown when on All tab — otherwise redundant) */}
                {activeTab === '__all__' && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${classTypeBadgeColor(cat.class_type)}`}>
                    {classTypeLabel(cat.class_type)}
                  </span>
                )}

                {/* Toggle active */}
                <button
                  onClick={() => toggleActive(globalIdx)}
                  className={`px-2 py-1 rounded-full text-[10px] font-bold transition-colors ${
                    cat.is_active ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.05] text-white/40'
                  }`}
                >
                  {cat.is_active ? 'Active' : 'Inactive'}
                </button>

                {/* Delete */}
                <button onClick={() => removeCategory(globalIdx)} className="text-white/30 hover:text-red-400 transition-colors text-sm" title="Remove">✕</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add category form */}
      {showAdd ? (
        <div className="border border-[#2a2a2a] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Add Category</h3>
          <div>
            <label className="text-xs font-medium text-white/70 block mb-1">Applies to *</label>
            <select
              className={inputClass}
              value={newClassType}
              onChange={(e) => setNewClassType(e.target.value as TabValue)}
            >
              {CLASS_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-white/40 mt-1">
              {newClassType === '__universal__'
                ? 'Universal categories appear when scoring ANY class.'
                : `This category will only show when scoring ${CLASS_TYPE_OPTIONS.find((o) => o.value === newClassType)?.label} players.`}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-white/70 block mb-1">Name *</label>
            <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Ball Control" />
          </div>
          <div>
            <label className="text-xs font-medium text-white/70 block mb-1">Description</label>
            <input className={inputClass} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="e.g. First touch, trapping" />
          </div>
          <div>
            <label className="text-xs font-medium text-white/70 block mb-1">Icon (emoji)</label>
            <input className={inputClass + ' max-w-[120px]'} value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="e.g. ⚽" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addCategory}
              disabled={!newName.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-30 transition-all"
            >
              Add
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-xs font-semibold border border-[#2a2a2a] text-white/60 hover:bg-[#1e1e1e] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            // Default new category to current tab's class type
            if (activeTab === '__all__') {
              setNewClassType('__universal__')
            } else {
              setNewClassType(activeTab as TabValue)
            }
            setShowAdd(true)
          }}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-dashed border-[#2a2a2a] text-white/50 hover:text-white hover:border-white/20 transition-all w-full"
        >
          + Add Category {activeTab !== '__all__' && `to ${TAB_OPTIONS.find((t) => t.value === activeTab)?.label}`}
        </button>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-all"
      >
        {saving ? 'Saving...' : 'Save All Categories'}
      </button>
    </div>
  )
}
