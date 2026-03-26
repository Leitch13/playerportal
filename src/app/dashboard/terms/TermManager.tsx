'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Term, Holiday } from './page'

/* ── helpers ── */

function daysBetween(a: string, b: string) {
  const ms = new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()
  return Math.round(ms / 86_400_000) + 1
}

function weeksBetween(a: string, b: string) {
  return daysBetween(a, b) / 7
}

function holidayWeeks(holidays: Holiday[]) {
  return holidays.reduce((sum, h) => sum + weeksBetween(h.start_date, h.end_date), 0)
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

const HOLIDAY_TEMPLATES = [
  { name: 'Half Term', days: 7 },
  { name: 'Christmas Break', days: 14 },
  { name: 'Easter Break', days: 14 },
  { name: 'Bank Holiday', days: 1 },
]

/* ── sub-components ── */

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
        active
          ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
          : 'bg-white/10 text-white/50'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

/* ── Timeline Bar ── */

function Timeline({
  terms,
  holidays,
}: {
  terms: Term[]
  holidays: Holiday[]
}) {
  if (terms.length === 0) return null

  const allDates = terms.flatMap((t) => [
    new Date(t.start_date + 'T00:00:00').getTime(),
    new Date(t.end_date + 'T00:00:00').getTime(),
  ])
  const min = Math.min(...allDates)
  const max = Math.max(...allDates)
  const range = max - min || 1

  function pct(d: string) {
    return ((new Date(d + 'T00:00:00').getTime() - min) / range) * 100
  }

  return (
    <div className="relative w-full h-20 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      {/* term bars */}
      {terms.map((t) => {
        const left = pct(t.start_date)
        const width = pct(t.end_date) - left
        return (
          <div
            key={t.id}
            className={`absolute top-3 h-6 rounded-md transition-all ${
              t.is_active
                ? 'bg-cyan-500/60 ring-2 ring-cyan-400/50'
                : 'bg-white/15'
            }`}
            style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
            title={`${t.name}: ${fmtShort(t.start_date)} - ${fmtShort(t.end_date)}`}
          >
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white truncate px-1">
              {t.name}
            </span>
          </div>
        )
      })}

      {/* holiday overlays */}
      {holidays.map((h) => {
        const left = pct(h.start_date)
        const width = pct(h.end_date) - left
        return (
          <div
            key={h.id}
            className="absolute top-3 h-6 bg-red-500/40 rounded-sm border border-red-400/30"
            style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
            title={`${h.name}: ${fmtShort(h.start_date)} - ${fmtShort(h.end_date)}`}
          />
        )
      })}

      {/* labels row */}
      {terms.map((t) => {
        const left = pct(t.start_date)
        return (
          <div
            key={t.id + '-label'}
            className="absolute bottom-1 text-[9px] text-white/40 whitespace-nowrap"
            style={{ left: `${left}%` }}
          >
            {fmtShort(t.start_date)}
          </div>
        )
      })}
    </div>
  )
}

/* ── Calendar View ── */

function CalendarView({
  terms,
  holidays,
}: {
  terms: Term[]
  holidays: Holiday[]
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const active = terms.find((t) => t.is_active)
    if (active) return active.start_date.slice(0, 7)
    return new Date().toISOString().slice(0, 7)
  })

  const [year, month] = viewMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // Monday start

  const days: (number | null)[] = Array(startPad).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)

  function dateStr(day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function isInTerm(day: number) {
    const d = dateStr(day)
    return terms.some((t) => d >= t.start_date && d <= t.end_date)
  }

  function isActiveTerm(day: number) {
    const d = dateStr(day)
    return terms.some((t) => t.is_active && d >= t.start_date && d <= t.end_date)
  }

  function isHoliday(day: number) {
    const d = dateStr(day)
    return holidays.some((h) => d >= h.start_date && d <= h.end_date)
  }

  function prevMonth() {
    const d = new Date(year, month - 2, 1)
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    const d = new Date(year, month, 1)
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthLabel = firstDay.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="text-white/50 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/10 transition">
          &larr;
        </button>
        <span className="text-sm font-semibold text-white">{monthLabel}</span>
        <button onClick={nextMonth} className="text-white/50 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/10 transition">
          &rarr;
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[10px] text-white/40 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {days.map((day, i) => {
          if (day === null) return <div key={i} />
          const inTerm = isInTerm(day)
          const inActive = isActiveTerm(day)
          const holiday = isHoliday(day)
          return (
            <div
              key={i}
              className={`relative h-8 flex items-center justify-center rounded text-xs transition-colors ${
                holiday
                  ? 'bg-red-500/25 text-red-300 line-through'
                  : inActive
                  ? 'bg-cyan-500/25 text-cyan-200 font-medium'
                  : inTerm
                  ? 'bg-white/10 text-white/70'
                  : 'text-white/25'
              }`}
            >
              {day}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[10px] text-white/40">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-cyan-500/25 border border-cyan-500/30" /> Active term
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-white/10 border border-white/10" /> Term
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500/25 border border-red-400/30" /> Holiday
        </span>
      </div>
    </div>
  )
}

/* ── Holiday Row ── */

function HolidayRow({
  holiday,
  onDelete,
}: {
  holiday: Holiday
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-red-500/10 border border-red-500/20">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
        <span className="text-white/80 font-medium">{holiday.name}</span>
        <span className="text-white/40 text-xs">
          {fmtShort(holiday.start_date)} - {fmtShort(holiday.end_date)}
        </span>
      </div>
      <button
        onClick={() => onDelete(holiday.id)}
        className="text-red-400/60 hover:text-red-400 text-xs transition"
      >
        Remove
      </button>
    </div>
  )
}

/* ── Add Holiday Form ── */

function AddHolidayForm({
  termId,
  orgId,
  termStart,
  termEnd,
  onAdded,
}: {
  termId: string
  orgId: string
  termStart: string
  termEnd: string
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  function applyTemplate(t: (typeof HOLIDAY_TEMPLATES)[number]) {
    setName(t.name)
    if (startDate) {
      const end = new Date(startDate + 'T00:00:00')
      end.setDate(end.getDate() + t.days - 1)
      setEndDate(end.toISOString().split('T')[0])
    }
  }

  async function handleAdd() {
    if (!name || !startDate || !endDate) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('holidays').insert({
      term_id: termId,
      organisation_id: orgId,
      name,
      start_date: startDate,
      end_date: endDate,
    })
    setSaving(false)
    setOpen(false)
    setName('')
    setStartDate('')
    setEndDate('')
    onAdded()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-cyan-400 hover:text-cyan-300 transition"
      >
        + Add Holiday
      </button>
    )
  }

  return (
    <div className="space-y-3 p-3 rounded-lg bg-white/5 border border-white/10">
      {/* Templates */}
      <div className="flex flex-wrap gap-1.5">
        {HOLIDAY_TEMPLATES.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => applyTemplate(t)}
            className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition"
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="Holiday name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        />
        <input
          type="date"
          value={startDate}
          min={termStart}
          max={termEnd}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 [color-scheme:dark]"
        />
        <input
          type="date"
          value={endDate}
          min={startDate || termStart}
          max={termEnd}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 [color-scheme:dark]"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={saving || !name || !startDate || !endDate}
          className="text-xs px-3 py-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-40 transition"
        >
          {saving ? 'Saving...' : 'Add Holiday'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/* ── Term Card ── */

function TermCard({
  term,
  holidays,
  orgId,
  onRefresh,
}: {
  term: Term
  holidays: Holiday[]
  orgId: string
  onRefresh: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(term.name)
  const [startDate, setStartDate] = useState(term.start_date)
  const [endDate, setEndDate] = useState(term.end_date)
  const [saving, setSaving] = useState(false)

  const termWeeks = weeksBetween(term.start_date, term.end_date)
  const holWeeks = holidayWeeks(holidays)
  const teachingWeeks = Math.max(0, termWeeks - holWeeks)

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('terms')
      .update({ name, start_date: startDate, end_date: endDate })
      .eq('id', term.id)
    setSaving(false)
    setEditing(false)
    onRefresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this term and all its holidays?')) return
    const supabase = createClient()
    await supabase.from('terms').delete().eq('id', term.id)
    onRefresh()
  }

  async function handleSetActive() {
    const supabase = createClient()
    // Deactivate all terms for this org, then activate this one
    await supabase
      .from('terms')
      .update({ is_active: false })
      .eq('organisation_id', orgId)
    await supabase
      .from('terms')
      .update({ is_active: true })
      .eq('id', term.id)
    onRefresh()
  }

  async function handleDeleteHoliday(id: string) {
    const supabase = createClient()
    await supabase.from('holidays').delete().eq('id', id)
    onRefresh()
  }

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        term.is_active
          ? 'bg-white/[0.06] border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.08)]'
          : 'bg-white/[0.03] border-white/10'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
          ) : (
            <h3 className="text-base font-semibold text-white truncate">{term.name}</h3>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge active={term.is_active} />
          {!term.is_active && (
            <button
              onClick={handleSetActive}
              className="text-[10px] px-2 py-1 rounded bg-white/10 text-white/50 hover:text-white hover:bg-white/20 transition"
            >
              Set Active
            </button>
          )}
        </div>
      </div>

      {/* Date range */}
      {editing ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 [color-scheme:dark]"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 [color-scheme:dark]"
          />
        </div>
      ) : (
        <p className="text-sm text-white/50 mb-3">
          {fmtDate(term.start_date)} &mdash; {fmtDate(term.end_date)}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-white">{termWeeks.toFixed(1)}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Total Weeks</div>
        </div>
        <div className="bg-red-500/10 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-red-300">{holWeeks.toFixed(1)}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Holiday Weeks</div>
        </div>
        <div className="bg-cyan-500/10 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-cyan-300">{teachingWeeks.toFixed(1)}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Teaching Weeks</div>
        </div>
      </div>

      {/* Holidays list */}
      {holidays.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider">Holidays</h4>
          {holidays.map((h) => (
            <HolidayRow key={h.id} holiday={h} onDelete={handleDeleteHoliday} />
          ))}
        </div>
      )}

      {/* Add holiday */}
      <AddHolidayForm
        termId={term.id}
        orgId={orgId}
        termStart={term.start_date}
        termEnd={term.end_date}
        onAdded={onRefresh}
      />

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
        {editing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-40 transition"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setName(term.name)
                setStartDate(term.start_date)
                setEndDate(term.end_date)
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Main Component ── */

export default function TermManager({
  orgId,
  initialTerms,
  initialHolidays,
}: {
  orgId: string
  initialTerms: Term[]
  initialHolidays: Holiday[]
}) {
  const router = useRouter()
  const [terms, setTerms] = useState(initialTerms)
  const [holidays, setHolidays] = useState(initialHolidays)

  // Add term form
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newActive, setNewActive] = useState(false)
  const [saving, setSaving] = useState(false)

  const [view, setView] = useState<'cards' | 'calendar'>('cards')

  function refresh() {
    router.refresh()
    // Also re-fetch client-side for instant feedback
    const supabase = createClient()
    supabase
      .from('terms')
      .select('*')
      .eq('organisation_id', orgId)
      .order('start_date', { ascending: true })
      .then(({ data }) => {
        if (data) setTerms(data as Term[])
      })
    supabase
      .from('holidays')
      .select('*')
      .eq('organisation_id', orgId)
      .order('start_date', { ascending: true })
      .then(({ data }) => {
        if (data) setHolidays(data as Holiday[])
      })
  }

  async function handleAddTerm() {
    if (!newName || !newStart || !newEnd) return
    setSaving(true)
    const supabase = createClient()

    if (newActive) {
      await supabase
        .from('terms')
        .update({ is_active: false })
        .eq('organisation_id', orgId)
    }

    await supabase.from('terms').insert({
      organisation_id: orgId,
      name: newName,
      start_date: newStart,
      end_date: newEnd,
      is_active: newActive,
    })

    setSaving(false)
    setShowAdd(false)
    setNewName('')
    setNewStart('')
    setNewEnd('')
    setNewActive(false)
    refresh()
  }

  const termHolidayMap = useMemo(() => {
    const map: Record<string, Holiday[]> = {}
    terms.forEach((t) => {
      map[t.id] = holidays.filter((h) => h.term_id === t.id)
    })
    return map
  }, [terms, holidays])

  const totalTeachingWeeks = useMemo(() => {
    return terms.reduce((sum, t) => {
      const tw = weeksBetween(t.start_date, t.end_date)
      const hw = holidayWeeks(termHolidayMap[t.id] || [])
      return sum + Math.max(0, tw - hw)
    }, 0)
  }, [terms, termHolidayMap])

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white">{terms.length}</div>
          <div className="text-xs text-white/40 mt-1">Terms</div>
        </div>
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white">{holidays.length}</div>
          <div className="text-xs text-white/40 mt-1">Holidays</div>
        </div>
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-cyan-300">{totalTeachingWeeks.toFixed(1)}</div>
          <div className="text-xs text-white/40 mt-1">Teaching Weeks</div>
        </div>
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-300">
            {terms.find((t) => t.is_active)?.name || 'None'}
          </div>
          <div className="text-xs text-white/40 mt-1">Current Term</div>
        </div>
      </div>

      {/* Timeline */}
      {terms.length > 0 && (
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Term Timeline</h2>
          <Timeline terms={terms} holidays={holidays} />
        </div>
      )}

      {/* View toggle + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setView('cards')}
            className={`text-xs px-3 py-1.5 rounded-md transition ${
              view === 'cards'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`text-xs px-3 py-1.5 rounded-md transition ${
              view === 'calendar'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            Calendar
          </button>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition font-medium"
        >
          + Add Term
        </button>
      </div>

      {/* Add term form */}
      {showAdd && (
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">New Term</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Term name (e.g. Autumn 2025)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
            <input
              type="date"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 [color-scheme:dark]"
            />
            <input
              type="date"
              value={newEnd}
              min={newStart}
              onChange={(e) => setNewEnd(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 [color-scheme:dark]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={newActive}
              onChange={(e) => setNewActive(e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
            />
            Set as active term
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleAddTerm}
              disabled={saving || !newName || !newStart || !newEnd}
              className="text-sm px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-40 transition font-medium"
            >
              {saving ? 'Creating...' : 'Create Term'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="text-sm px-4 py-2 rounded-lg bg-white/10 text-white/60 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'cards' ? (
        terms.length === 0 ? (
          <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl p-12 text-center">
            <p className="text-white/40 text-sm">No terms created yet. Click &quot;Add Term&quot; to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {terms.map((t) => (
              <TermCard
                key={t.id}
                term={t}
                holidays={termHolidayMap[t.id] || []}
                orgId={orgId}
                onRefresh={refresh}
              />
            ))}
          </div>
        )
      ) : (
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl p-5">
          <CalendarView terms={terms} holidays={holidays} />
        </div>
      )}
    </div>
  )
}
