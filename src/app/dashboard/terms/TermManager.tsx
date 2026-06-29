'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Term, Holiday, ClassRow } from './page'

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

/* ── Current Teaching Period derivation (read-only, pure) ── */

const DAY_MS = 86_400_000

function todayISOFromMs(nowMs: number) {
  const d = new Date(nowMs)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Whole-day diff between two ISO dates (b - a), midnight-anchored.
function dayDiff(aISO: string, bISO: string) {
  const a = new Date(aISO + 'T00:00:00').getTime()
  const b = new Date(bISO + 'T00:00:00').getTime()
  return Math.round((b - a) / DAY_MS)
}

type CurrentPeriod = {
  activeTerm: Term | null
  status: 'in_progress' | 'not_started' | 'ended' | 'on_break' | 'none'
  weekX: number
  weekY: number
  weeksRemaining: number
  teachingWeeks: number
  holidayWeeksTotal: number
  endsInDays: number | null
  startsInDays: number | null
  endedDaysAgo: number | null
  onBreak: Holiday | null
  nextHoliday: { holiday: Holiday; inDays: number } | null
  nextTerm: { term: Term; inDays: number } | null
}

// Derives the "right now" picture from already-loaded data + a client clock.
// Reads the existing is_active flag — never writes it, never re-derives a
// different "current" term. Pure: no I/O.
function deriveCurrentPeriod(terms: Term[], holidays: Holiday[], nowMs: number): CurrentPeriod {
  const today = todayISOFromMs(nowMs)
  const active = terms.find((t) => t.is_active) ?? null

  // Forward-looking, term-independent signals (across ALL loaded rows).
  const nextTermRow = terms
    .filter((t) => t.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  const nextTerm = nextTermRow ? { term: nextTermRow, inDays: dayDiff(today, nextTermRow.start_date) } : null

  // "next holiday" = the soonest holiday not yet finished; if one straddles today → on break.
  const upcomingOrLive = holidays
    .filter((h) => h.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  const onBreak = upcomingOrLive.find((h) => h.start_date <= today && today <= h.end_date) ?? null
  const nextHolidayRow = upcomingOrLive.find((h) => h.start_date > today) ?? null
  const nextHoliday = nextHolidayRow ? { holiday: nextHolidayRow, inDays: dayDiff(today, nextHolidayRow.start_date) } : null

  if (!active) {
    return {
      activeTerm: null, status: 'none', weekX: 0, weekY: 0, weeksRemaining: 0,
      teachingWeeks: 0, holidayWeeksTotal: 0, endsInDays: null, startsInDays: null,
      endedDaysAgo: null, onBreak, nextHoliday, nextTerm,
    }
  }

  const termHols = holidays.filter((h) => h.term_id === active.id)
  const teachingWeeks = Math.max(0, weeksBetween(active.start_date, active.end_date) - holidayWeeks(termHols))
  const holidayWeeksTotal = holidayWeeks(termHols)

  // Status relative to today.
  let status: CurrentPeriod['status']
  let startsInDays: number | null = null
  let endedDaysAgo: number | null = null
  if (today < active.start_date) {
    status = 'not_started'
    startsInDays = dayDiff(today, active.start_date)
  } else if (today > active.end_date) {
    status = 'ended'
    endedDaysAgo = dayDiff(active.end_date, today)
  } else if (onBreak && onBreak.term_id === active.id) {
    status = 'on_break'
  } else {
    status = 'in_progress'
  }

  // Teaching-week progress (holiday-aware), only meaningful once started.
  const weekY = Math.max(1, Math.ceil(teachingWeeks))
  let weekX = 0
  let weeksRemaining = teachingWeeks
  if (status !== 'not_started') {
    const cappedToday = today > active.end_date ? active.end_date : today
    const holsBefore = termHols.filter((h) => h.end_date <= cappedToday)
    const elapsedTeaching = Math.max(0, weeksBetween(active.start_date, cappedToday) - holidayWeeks(holsBefore))
    weekX = Math.min(weekY, Math.max(1, Math.ceil(elapsedTeaching)))
    const holsAfter = termHols.filter((h) => h.end_date >= cappedToday)
    weeksRemaining = today > active.end_date
      ? 0
      : Math.max(0, weeksBetween(cappedToday, active.end_date) - holidayWeeks(holsAfter))
  }

  return {
    activeTerm: active, status, weekX, weekY,
    weeksRemaining: Math.round(weeksRemaining * 10) / 10,
    teachingWeeks: Math.round(teachingWeeks * 10) / 10,
    holidayWeeksTotal: Math.round(holidayWeeksTotal * 10) / 10,
    endsInDays: status === 'ended' ? null : dayDiff(today, active.end_date),
    startsInDays, endedDaysAgo, onBreak: status === 'on_break' ? onBreak : null,
    nextHoliday, nextTerm,
  }
}

function countdownLabel(days: number) {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 14) return `in ${days} days`
  if (days < 60) return `in ${Math.round(days / 7)} weeks`
  return `in ${Math.round(days / 30)} months`
}

/* ── Current Teaching Period Band (read-only) ── */

function CountdownChip({
  tone, eyebrow, title, sub,
}: { tone: 'cyan' | 'amber' | 'rose' | 'muted'; eyebrow: string; title: string; sub?: string }) {
  const tones: Record<string, string> = {
    cyan: 'bg-[#4ecde6]/10 border-[#4ecde6]/25',
    amber: 'bg-amber-500/10 border-amber-500/25',
    rose: 'bg-rose-500/10 border-rose-500/25',
    muted: 'bg-white/[0.04] border-white/[0.08]',
  }
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <p className="text-[10px] uppercase tracking-wider text-white/45">{eyebrow}</p>
      <p className="text-sm font-semibold text-white mt-0.5 truncate">{title}</p>
      {sub && <p className="text-[11px] text-white/50 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

function CurrentPeriodBand({ period }: { period: CurrentPeriod }) {
  const p = period
  // Headline status line for the active term (read-only; reflects is_active + today).
  let statusLine = ''
  let statusTone = 'text-white/60'
  if (p.status === 'in_progress') { statusLine = `Week ${p.weekX} of ${p.weekY} · ${p.weeksRemaining} teaching ${p.weeksRemaining === 1 ? 'week' : 'weeks'} left`; statusTone = 'text-[#4ecde6]' }
  else if (p.status === 'on_break') { statusLine = p.onBreak ? `On break: ${p.onBreak.name} until ${fmtShort(p.onBreak.end_date)}` : 'On break'; statusTone = 'text-amber-300' }
  else if (p.status === 'not_started') { statusLine = `Starts ${countdownLabel(p.startsInDays ?? 0)} · ${p.teachingWeeks} teaching weeks`; statusTone = 'text-white/70' }
  else if (p.status === 'ended') { statusLine = `Ended ${p.endedDaysAgo} ${p.endedDaysAgo === 1 ? 'day' : 'days'} ago`; statusTone = 'text-rose-300' }

  const progressPct = p.weekY > 0 ? Math.min(100, Math.round((p.weekX / p.weekY) * 100)) : 0
  const showProgress = p.status === 'in_progress' || p.status === 'on_break'

  return (
    <section aria-label="Current teaching period" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white/70">Current teaching period</h2>
        <span className="text-[11px] text-white/40">Where your academy is right now</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Active term + progress */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          {p.activeTerm ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-300 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </span>
                <h3 className="text-base font-bold text-white truncate">{p.activeTerm.name}</h3>
                <span className={`text-xs font-semibold ${statusTone}`}>{statusLine}</span>
              </div>
              <p className="text-xs text-white/50 mt-1.5">
                {fmtDate(p.activeTerm.start_date)} &mdash; {fmtDate(p.activeTerm.end_date)}
                {p.endsInDays != null && p.status !== 'ended' && (
                  <span className="text-white/40"> · ends {countdownLabel(p.endsInDays)}</span>
                )}
              </p>
              {showProgress && (
                <div className="mt-3">
                  <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className="h-full rounded-full bg-[#4ecde6] transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/40 mt-1">
                    <span>{p.teachingWeeks} teaching wks</span>
                    <span>{p.holidayWeeksTotal} holiday wks</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.12] flex items-center justify-center text-white/50 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </span>
              <div>
                <h3 className="text-base font-bold text-white">No active term set</h3>
                <p className="text-xs text-white/50 mt-0.5">Set a term active to track the teaching period.</p>
              </div>
            </div>
          )}
        </div>

        {/* Countdown chips */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          {p.nextHoliday ? (
            <CountdownChip tone="amber" eyebrow="Next holiday" title={p.nextHoliday.holiday.name}
              sub={`${countdownLabel(p.nextHoliday.inDays)} · ${fmtShort(p.nextHoliday.holiday.start_date)}`} />
          ) : (
            <CountdownChip tone="muted" eyebrow="Next holiday" title="None scheduled" />
          )}
          {p.nextTerm ? (
            <CountdownChip tone="cyan" eyebrow="Next term" title={p.nextTerm.term.name}
              sub={`${countdownLabel(p.nextTerm.inDays)} · ${fmtShort(p.nextTerm.term.start_date)}`} />
          ) : (
            <CountdownChip tone="muted" eyebrow="Next term" title="None scheduled" />
          )}
        </div>
      </div>
    </section>
  )
}

/* ── Timeline Bar ── */

function Timeline({
  terms,
  holidays,
  todayISO,
}: {
  terms: Term[]
  holidays: Holiday[]
  todayISO?: string | null
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

  // Today marker only when today falls within the charted span.
  const todayPct = todayISO != null ? pct(todayISO) : null
  const showToday = todayPct != null && todayPct >= 0 && todayPct <= 100

  return (
    <div className="overflow-x-auto">
    <div className="relative w-full min-w-[520px] h-20 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      {/* today marker */}
      {showToday && (
        <div
          className="absolute top-0 bottom-0 w-px bg-[#4ecde6] z-10 pointer-events-none"
          style={{ left: `${todayPct}%` }}
          title="Today"
        >
          <span className="absolute -top-0 left-1 text-[8px] font-bold text-[#4ecde6] whitespace-nowrap">Today</span>
        </div>
      )}
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

      {/* labels row — active term only, to avoid overlap (others on hover title) */}
      {terms.filter((t) => t.is_active).map((t) => {
        const left = pct(t.start_date)
        return (
          <div
            key={t.id + '-label'}
            className="absolute bottom-1 text-[9px] text-[#4ecde6]/70 whitespace-nowrap"
            style={{ left: `${left}%` }}
          >
            {fmtShort(t.start_date)}
          </div>
        )
      })}
    </div>
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

/* ── Class Assignment Section (Phase 1B) ── */

function ClassAssignmentSection({
  termId,
  allClasses,
  onRefresh,
  canWrite,
}: {
  termId: string
  allClasses: ClassRow[]
  onRefresh: () => void
  canWrite: boolean
}) {
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const assigned = useMemo(
    () => allClasses.filter((c) => c.term_id === termId),
    [allClasses, termId],
  )
  const available = useMemo(
    () => allClasses.filter((c) => c.term_id == null || c.term_id !== termId),
    [allClasses, termId],
  )

  function toggle(id: string) {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  async function handleAssign() {
    if (picked.size === 0) return
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('training_groups')
      .update({ term_id: termId })
      .in('id', Array.from(picked))
    setSaving(false)
    setPicked(new Set())
    setPicking(false)
    onRefresh()
  }

  async function handleRemove(classId: string) {
    const supabase = createClient()
    await supabase.from('training_groups').update({ term_id: null }).eq('id', classId)
    onRefresh()
  }

  return (
    <div className="mt-3 mb-3 pt-3 border-t border-white/5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider">
          Assigned Classes ({assigned.length})
        </h4>
        {canWrite && !picking && available.length > 0 && (
          <button
            onClick={() => setPicking(true)}
            className="text-xs text-[#4ecde6] hover:text-[#7dddf0] transition"
          >
            + Assign classes
          </button>
        )}
      </div>

      {assigned.length === 0 && !picking && (
        <p className="text-xs text-white/35 italic">
          No classes assigned. Parents won&apos;t see this term anywhere until you
          assign at least one class.
        </p>
      )}

      {assigned.length > 0 && (
        <div className="space-y-1">
          {assigned.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between py-1.5 px-2 rounded bg-white/5 border border-white/10"
            >
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#4ecde6] shrink-0" />
                <span className="text-white/80 font-medium truncate">{c.name}</span>
                {(c.day_of_week || c.time_slot) && (
                  <span className="text-white/40 text-xs truncate">
                    {c.day_of_week}
                    {c.day_of_week && c.time_slot ? ' · ' : ''}
                    {c.time_slot}
                  </span>
                )}
              </div>
              {canWrite && (
                <button
                  onClick={() => handleRemove(c.id)}
                  className="text-white/40 hover:text-red-400 text-xs transition shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {picking && (
        <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
          {available.length === 0 ? (
            <p className="text-xs text-white/40 italic">
              No unassigned classes available.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-white/50">
                Tick the classes you want to assign to this term. Classes already
                in another term will be moved.
              </p>
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {available.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="rounded border-white/20 bg-white/5 focus:ring-[#4ecde6]/40"
                      style={{ accentColor: '#4ecde6' }}
                    />
                    <span className="text-white/80 font-medium truncate">{c.name}</span>
                    {(c.day_of_week || c.time_slot) && (
                      <span className="text-white/40 text-xs truncate">
                        {c.day_of_week}
                        {c.day_of_week && c.time_slot ? ' · ' : ''}
                        {c.time_slot}
                      </span>
                    )}
                    {c.term_id && c.term_id !== termId && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 shrink-0">
                        in another term
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAssign}
                  disabled={saving || picked.size === 0}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#7dddf0] disabled:opacity-40 transition"
                >
                  {saving ? 'Assigning…' : `Assign ${picked.size || 0}`}
                </button>
                <button
                  onClick={() => {
                    setPicking(false)
                    setPicked(new Set())
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Term Card ── */

function TermCard({
  term,
  holidays,
  orgId,
  onRefresh,
  classes,
  canWrite,
}: {
  term: Term
  holidays: Holiday[]
  orgId: string
  onRefresh: () => void
  classes: ClassRow[]
  canWrite: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(term.name)
  const [startDate, setStartDate] = useState(term.start_date)
  const [endDate, setEndDate] = useState(term.end_date)
  const [parentMessage, setParentMessage] = useState(term.parent_message || '')
  const [saving, setSaving] = useState(false)

  const termWeeks = weeksBetween(term.start_date, term.end_date)
  const holWeeks = holidayWeeks(holidays)
  const teachingWeeks = Math.max(0, termWeeks - holWeeks)

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('terms')
      .update({
        name,
        start_date: startDate,
        end_date: endDate,
        parent_message: parentMessage.trim() ? parentMessage.trim() : null,
      })
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
          {canWrite && !term.is_active && (
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

      {/* Parent message (Phase 1B) */}
      {editing ? (
        <div className="mb-3">
          <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-1">
            Parent message (optional)
          </label>
          <textarea
            value={parentMessage}
            onChange={(e) => setParentMessage(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Shown to parents on the booking page, dashboard, and emails. e.g. ‘No classes during July while our Summer Camp runs.’"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
          <p className="text-[10px] text-white/35 mt-1 text-right">
            {parentMessage.length}/1000
          </p>
        </div>
      ) : term.parent_message ? (
        <div className="mb-3 px-3 py-2 rounded-lg border border-[#4ecde6]/20 bg-[#4ecde6]/[0.05]">
          <p className="text-[10px] uppercase tracking-wider text-[#4ecde6]/70 mb-1">
            Parent message
          </p>
          <p className="text-xs text-white/70 whitespace-pre-wrap">
            {term.parent_message}
          </p>
        </div>
      ) : null}

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
      {canWrite && (
        <AddHolidayForm
          termId={term.id}
          orgId={orgId}
          termStart={term.start_date}
          termEnd={term.end_date}
          onAdded={onRefresh}
        />
      )}

      {/* Class assignment (Phase 1B) */}
      <ClassAssignmentSection
        termId={term.id}
        allClasses={classes}
        onRefresh={onRefresh}
        canWrite={canWrite}
      />

      {/* Actions */}
      {canWrite && (
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
                  setParentMessage(term.parent_message || '')
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
      )}
    </div>
  )
}

/* ── Main Component ── */

export default function TermManager({
  orgId,
  initialTerms,
  initialHolidays,
  initialClasses,
  canWrite,
}: {
  orgId: string
  initialTerms: Term[]
  initialHolidays: Holiday[]
  initialClasses: ClassRow[]
  canWrite: boolean
}) {
  const router = useRouter()
  const [terms, setTerms] = useState(initialTerms)
  const [holidays, setHolidays] = useState(initialHolidays)
  const [classes, setClasses] = useState(initialClasses)

  // Add term form
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newActive, setNewActive] = useState(false)
  const [newParentMessage, setNewParentMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const [view, setView] = useState<'cards' | 'calendar'>('cards')

  // Client clock — set AFTER mount so SSR and first client render match
  // (avoids a Date-based hydration mismatch). Band/marker appear once mounted.
  const [nowMs, setNowMs] = useState<number | null>(null)
  useEffect(() => {
    setNowMs(Date.now())
  }, [])
  const todayISO = nowMs != null ? todayISOFromMs(nowMs) : null

  const period = useMemo(
    () => (nowMs != null ? deriveCurrentPeriod(terms, holidays, nowMs) : null),
    [terms, holidays, nowMs],
  )

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
    supabase
      .from('training_groups')
      .select('id, name, day_of_week, time_slot, term_id')
      .eq('organisation_id', orgId)
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setClasses(data as ClassRow[])
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
      parent_message: newParentMessage.trim() ? newParentMessage.trim() : null,
    })

    setSaving(false)
    setShowAdd(false)
    setNewName('')
    setNewStart('')
    setNewEnd('')
    setNewActive(false)
    setNewParentMessage('')
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
      {/* Current Teaching Period band (read-only; appears after mount) */}
      {period && terms.length > 0 && <CurrentPeriodBand period={period} />}

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Terms */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
          <span className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.12] flex items-center justify-center text-white/70 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </span>
          <div className="text-2xl font-bold text-white">{terms.length}</div>
          <div className="text-xs text-white/50 mt-0.5">Terms</div>
          <div className="text-[11px] text-white/35 mt-0.5">{terms.filter((t) => t.is_active).length} active</div>
        </div>
        {/* Holidays */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
          <span className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-300 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36l-.7-.7M6.34 6.34l-.7-.7m12.72 0l-.7.7M6.34 17.66l-.7.7M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </span>
          <div className="text-2xl font-bold text-white">{holidays.length}</div>
          <div className="text-xs text-white/50 mt-0.5">Holidays</div>
          <div className="text-[11px] text-white/35 mt-0.5">across all terms</div>
        </div>
        {/* Teaching weeks */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
          <span className="w-8 h-8 rounded-lg bg-[#4ecde6]/15 border border-[#4ecde6]/25 flex items-center justify-center text-[#4ecde6] mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.42a12 12 0 01.84 4.42 12 12 0 01-14 0 12 12 0 01.84-4.42L12 14z" /></svg>
          </span>
          <div className="text-2xl font-bold text-[#4ecde6]">{totalTeachingWeeks.toFixed(1)}</div>
          <div className="text-xs text-white/50 mt-0.5">Teaching Weeks</div>
          <div className="text-[11px] text-white/35 mt-0.5">this academic year</div>
        </div>
        {/* Current term — name at readable size + range sub-label */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
          <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-300 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </span>
          {(() => {
            const active = terms.find((t) => t.is_active)
            return active ? (
              <>
                <div className="text-base font-bold text-emerald-300 truncate">{active.name}</div>
                <div className="text-xs text-white/50 mt-0.5">Current Term</div>
                <div className="text-[11px] text-white/35 mt-0.5 truncate">{fmtShort(active.start_date)} – {fmtShort(active.end_date)}</div>
              </>
            ) : (
              <>
                <div className="text-base font-bold text-white/50">Not set</div>
                <div className="text-xs text-white/50 mt-0.5">Current Term</div>
                <div className="text-[11px] text-white/35 mt-0.5">No active term</div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Timeline */}
      {terms.length > 0 && (
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Term Timeline</h2>
          <Timeline terms={terms} holidays={holidays} todayISO={todayISO} />
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
        {canWrite && (
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition font-medium"
          >
            + Add Term
          </button>
        )}
      </div>

      {/* Add term form */}
      {canWrite && showAdd && (
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
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-1">
              Parent message (optional)
            </label>
            <textarea
              value={newParentMessage}
              onChange={(e) => setNewParentMessage(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Shown to parents on the booking page, dashboard, and emails. e.g. ‘No classes during July while our Summer Camp runs.’"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
            <p className="text-[10px] text-white/35 mt-1 text-right">
              {newParentMessage.length}/1000
            </p>
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
                classes={classes}
                canWrite={canWrite}
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
