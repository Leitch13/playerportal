'use client'

import { useState, useMemo } from 'react'
import DrillCard from './DrillCard'
import DrillForm from './DrillForm'

interface Drill {
  id: string
  name: string
  category: string | null
  description: string | null
  duration_minutes: number
  equipment: string | null
  min_players: number
  max_players: number | null
  difficulty: string
  image_url: string | null
  created_by: string | null
}

const categories = [
  { value: '', label: 'All Categories' },
  { value: 'warm_up', label: 'Warm Up' },
  { value: 'technical', label: 'Technical' },
  { value: 'tactical', label: 'Tactical' },
  { value: 'physical', label: 'Physical' },
  { value: 'game', label: 'Game' },
  { value: 'cool_down', label: 'Cool Down' },
]

const difficulties = [
  { value: '', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export default function DrillsLibrary({
  drills,
  orgId,
  userId,
}: {
  drills: Drill[]
  orgId: string
  userId: string
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editDrill, setEditDrill] = useState<Drill | null>(null)

  const filtered = useMemo(() => {
    return drills.filter((d) => {
      if (categoryFilter && d.category !== categoryFilter) return false
      if (difficultyFilter && d.difficulty !== difficultyFilter) return false
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [drills, search, categoryFilter, difficultyFilter])

  function handleEdit(drill: Drill) {
    setEditDrill(drill)
    setShowForm(true)
  }

  function handleCloseForm() {
    setShowForm(false)
    setEditDrill(null)
  }

  const selectCls =
    'bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#4ecde6]/50 transition'

  return (
    <div className="min-h-screen bg-[#0a0a0a] -m-6 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Drill Library</h1>
        {!showForm && (
          <button
            onClick={() => { setEditDrill(null); setShowForm(true) }}
            className="bg-[#4ecde6] hover:bg-[#4ecde6]/80 text-black font-semibold text-sm px-4 py-2 rounded-lg transition"
          >
            + Add Drill
          </button>
        )}
      </div>

      {showForm && (
        <DrillForm orgId={orgId} userId={userId} editDrill={editDrill} onClose={handleCloseForm} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search drills..."
          className={selectCls + ' flex-1 min-w-[180px] placeholder:text-white/30'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={selectCls} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select className={selectCls} value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
          {difficulties.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-white/40">
          <svg className="mx-auto w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9.75" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c0 0-3 4.5-3 9.75s3 9.75 3 9.75M12 2.25c0 0 3 4.5 3 9.75s-3 9.75-3 9.75M3.25 9h17.5M3.25 15h17.5" />
          </svg>
          <p className="text-sm">
            {drills.length === 0 ? 'No drills yet. Add your first drill above.' : 'No drills match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((drill) => (
            <DrillCard key={drill.id} drill={drill} currentUserId={userId} onEdit={handleEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
