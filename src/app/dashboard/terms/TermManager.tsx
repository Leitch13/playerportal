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
    <div className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-[#080e18] border border-[#1d2c42]">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full bg-[#d8a95a] shrink-0" />
        <span className="text-white/80 font-medium">{holiday.name}</span>
        <span className="text-white/40 text-xs">
          {fmtShort(holiday.start_date)} - {fmtShort(holiday.end_date)}
        </span>
      </div>
      <button
        onClick={() => onDelete(holiday.id)}
        className="text-[#5b6c86] hover:text-[#e0736d] text-xs transition"
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
        className="rounded-[9px] border border-[#293b58] px-2.5 py-1.5 text-xs font-medium text-[#93a2ba] transition-colors hover:border-[#4ecde6] hover:text-[#eef2f9]"
      >
        + Add a holiday
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
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-semibold text-[#5b6c86] uppercase tracking-[0.07em]">
          Classes in this term · {assigned.length}
        </h4>
        {canWrite && !picking && available.length > 0 && (
          <button
            onClick={() => setPicking(true)}
            className="rounded-[9px] border border-[#293b58] px-2.5 py-1.5 text-xs font-medium text-[#93a2ba] transition-colors hover:border-[#4ecde6] hover:text-[#eef2f9]"
          >
            + Add classes
          </button>
        )}
      </div>

      {assigned.length === 0 && !picking && (
        <p className="text-xs text-[#93a2ba]">
          No classes yet. Parents only see a term&apos;s dates on the classes that are in it.
        </p>
      )}

      {assigned.length > 0 && (
        <div className="space-y-1">
          {assigned.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-[#080e18] border border-[#1d2c42]"
            >
              <div className="flex items-center gap-2 text-sm min-w-0">
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
                  className="text-[#5b6c86] hover:text-[#e0736d] text-xs transition shrink-0"
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
                      className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
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
                  className="text-xs px-3 py-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-40 transition"
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
  todayISO,
}: {
  term: Term
  holidays: Holiday[]
  orgId: string
  onRefresh: () => void
  classes: ClassRow[]
  canWrite: boolean
  todayISO: string | null
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

  // Whole weeks, in plain words. "6.6 weeks" helped nobody.
  const wholeWeeks = Math.max(1, Math.round(termWeeks))
  const teachWhole = Math.max(0, Math.round(teachingWeeks))
  const lengthText = holidays.length > 0 && teachWhole !== wholeWeeks
    ? `${wholeWeeks} weeks, ${teachWhole} of them with sessions`
    : `${wholeWeeks} ${wholeWeeks === 1 ? 'week' : 'weeks'}`
  // Where the term is against today's date. Empty until mounted (no clock on the server).
  const when = todayISO == null ? null
    : todayISO < term.start_date ? { text: `Starts ${fmtShort(term.start_date)}`, tone: 'border-[#293b58] text-[#93a2ba]' }
    : todayISO > term.end_date ? { text: `Finished ${fmtShort(term.end_date)}`, tone: 'border-[#293b58] text-[#93a2ba]' }
    : { text: 'Running now', tone: 'border-[#67c79a]/40 text-[#67c79a]' }
  const quietBtn = 'rounded-[9px] border border-[#293b58] px-2.5 py-1.5 text-xs font-medium text-[#93a2ba] transition-colors hover:border-[#4ecde6] hover:text-[#eef2f9]'
  const field = 'bg-[#080e18] border border-[#293b58] rounded-[10px] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4ecde6]'

  return (
    <section className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b]" data-testid="term-card">
      {/* Header: name, dates, length, where it is today */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1d2c42] px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} aria-label="Term name" className={field} />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="First day" className={`${field} [color-scheme:dark]`} />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="Last day" className={`${field} [color-scheme:dark]`} />
            </div>
          ) : (
            <>
              <h3 className="truncate text-[17px] font-semibold text-[#eef2f9]">{term.name}</h3>
              <p className="mt-0.5 text-sm text-[#93a2ba]">
                {fmtDate(term.start_date)} to {fmtDate(term.end_date)} · {lengthText}
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {when && !editing && (
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${when.tone}`}>{when.text}</span>
          )}
          {canWrite && (editing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="rounded-[9px] bg-[#4ecde6] px-3 py-1.5 text-xs font-semibold text-[#04141a] disabled:opacity-40">
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
                className={quietBtn}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className={quietBtn}>Edit</button>
              <details className="relative">
                <summary className={`${quietBtn} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label={`More for ${term.name}`}>More</summary>
                <div className="absolute right-0 z-10 mt-1 w-60 overflow-hidden rounded-[11px] border border-[#293b58] bg-[#142236] py-1 shadow-xl">
                  {!term.is_active && (
                    <button onClick={handleSetActive} className="block w-full px-3 py-2 text-left text-xs text-[#eef2f9] hover:bg-white/[0.06]">Use this term for the awards table</button>
                  )}
                  <button onClick={handleDelete} className="block w-full px-3 py-2 text-left text-xs text-[#e0736d] hover:bg-white/[0.06]">Delete term</button>
                </div>
              </details>
            </>
          ))}
        </div>
      </div>

      <div className="grid gap-5 px-4 py-4 sm:px-5 lg:grid-cols-2">
        {/* Left: what parents are told, and the breaks */}
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">What parents are told</h4>
            {editing ? (
              <>
                <textarea
                  value={parentMessage}
                  onChange={(e) => setParentMessage(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Shown to parents on the booking page, dashboard, and emails. e.g. ‘No classes during July while our Summer Camp runs.’"
                  className={`w-full ${field} placeholder-white/30`}
                />
                <p className="mt-1 text-right text-[10px] text-[#5b6c86]">{parentMessage.length}/1000</p>
              </>
            ) : term.parent_message ? (
              <p className="whitespace-pre-wrap text-sm text-[#eef2f9]">{term.parent_message}</p>
            ) : (
              <p className="text-xs text-[#93a2ba]">Just the dates. Press Edit to add a note, such as a week with no sessions.</p>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">Holidays in this term · {holidays.length}</h4>
            {holidays.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {holidays.map((h) => (
                  <HolidayRow key={h.id} holiday={h} onDelete={handleDeleteHoliday} />
                ))}
              </div>
            )}
            {canWrite && (
              <AddHolidayForm
                termId={term.id}
                orgId={orgId}
                termStart={term.start_date}
                termEnd={term.end_date}
                onAdded={onRefresh}
              />
            )}
          </div>
          {term.is_active && <p className="text-xs text-[#5b6c86]">The awards table counts this term.</p>}
        </div>

        {/* Right: the classes that run in it */}
        <ClassAssignmentSection
          termId={term.id}
          allClasses={classes}
          onRefresh={onRefresh}
          canWrite={canWrite}
        />
      </div>
    </section>
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

  // One plain line instead of a band, four tiles and a timeline.
  const headline = (() => {
    if (terms.length === 0) return 'No terms yet.'
    const count = `${terms.length} ${terms.length === 1 ? 'term' : 'terms'}`
    if (!todayISO) return count
    const running = terms.find((t) => t.start_date <= todayISO && todayISO <= t.end_date)
    if (running) {
      const left = dayDiff(todayISO, running.end_date)
      return `${count} · ${running.name} is running and ends ${fmtShort(running.end_date)}${left >= 0 ? ` (${left === 0 ? 'today' : left === 1 ? 'tomorrow' : `in ${left} days`})` : ''}`
    }
    const next = terms.find((t) => t.start_date > todayISO)
    return next ? `${count} · no term running today · ${next.name} starts ${fmtShort(next.start_date)}` : `${count} · no term running today`
  })()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#93a2ba]" data-testid="terms-headline">{headline}</p>
        <div className="flex items-center gap-2">
          {terms.length > 0 && (
            <div className="inline-flex gap-0.5 rounded-[10px] border border-[#1d2c42] bg-[#0f1a2b] p-[3px]" role="group" aria-label="Layout">
              {(['cards', 'calendar'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${view === v ? 'bg-[#142236] text-white' : 'text-[#93a2ba] hover:text-white'}`}
                >
                  {v === 'cards' ? 'List' : 'Calendar'}
                </button>
              ))}
            </div>
          )}
          {canWrite && !showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-[10px] bg-[#4ecde6] px-3.5 py-2 text-xs font-semibold text-[#04141a] transition-colors hover:bg-[#7fdcee]"
            >
              + Add term
            </button>
          )}
        </div>
      </div>

      {/* Add term form */}
      {canWrite && showAdd && (
        <div className="bg-[#0f1a2b] border border-[#293b58] rounded-[15px] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">New term</h3>
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
            Use this term for the awards table
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleAddTerm}
              disabled={saving || !newName || !newStart || !newEnd}
              className="rounded-[10px] bg-[#4ecde6] px-4 py-2 text-sm font-semibold text-[#04141a] hover:bg-[#7fdcee] disabled:opacity-40 transition"
            >
              {saving ? 'Creating...' : 'Create term'}
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
          <div className="bg-[#0f1a2b] border border-[#1d2c42] rounded-[15px] p-12 text-center">
            <p className="text-[#93a2ba] text-sm">No terms yet. Press &quot;Add term&quot; to set your first one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {terms.map((t) => (
              <TermCard
                key={t.id}
                term={t}
                holidays={termHolidayMap[t.id] || []}
                orgId={orgId}
                onRefresh={refresh}
                classes={classes}
                canWrite={canWrite}
                todayISO={todayISO}
              />
            ))}
          </div>
        )
      ) : (
        <div className="bg-[#0f1a2b] border border-[#1d2c42] rounded-[15px] p-5">
          <CalendarView terms={terms} holidays={holidays} />
        </div>
      )}
    </div>
  )
}
