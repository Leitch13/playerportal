'use client'

/**
 * Players List v2 — client-side interactivity layer.
 *
 * Receives the FULLY HYDRATED dataset from the server-rendered page. All
 * search, filter, and sort operations are pure JS reductions over that
 * dataset — NO refetch, NO API calls, NO Stripe contact, NO writes. The
 * current filter + sort are persisted in URL query params so the view
 * survives page reloads and can be deep-linked from elsewhere (e.g. the
 * future Action Queue can drop the user into `?filter=payment_issue`).
 *
 * Quick actions per row are LINKS ONLY — every secondary action navigates
 * to an existing page. There are no inline DB writes, no API endpoints
 * called from this component.
 *
 * Oct 2026 — the calm list. By default an owner sees search, a class
 * picker and three tabs (Active / Paused / Archived), with four columns:
 * player, class, parent, membership. Everything the old list had is still
 * here under "More filters": every filter chip, the sort, and the
 * Attendance + Last attended columns and risk labels. Deep links such as
 * ?filter=attendance_risk or ?filter=archived open with it showing.
 */

import Link from 'next/link'
import { PALETTE_ICON_PATHS } from '@/components/ui/PaletteIcon'
import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PlayerAvatar from '@/components/PlayerAvatar'
import type { DerivedRowStatus, DerivedSubStatus } from '@/lib/players-derive'
// Phase 2.4 — same enum + badge factory as the other visibility surfaces.
import { deriveTrialFollowUpBadge, type TrialStage } from '@/lib/trial-derive'
// Phase 2.8 — Attendance Risk. Pure helpers consumed for filter routing
// and the "Last attended" column formatter.
import {
  matchesAttendanceFilter,
  formatLastAttended,
  type AttendanceRiskAssessment,
  type AttendanceFilterKey,
} from '@/lib/attendance-risk-derive'
import { membershipPill, type PillTone } from '@/lib/needs-a-look'
import { classTint, classTintMap } from '@/lib/class-tint'

// ─── Row contract ──────────────────────────────────────────────────────
// The page-level loader computes these per player and hands the list to
// this component. Keeping the shape narrow means the table never has to
// reach back into the DB to render.
export interface PlayersTableRow {
  id: string
  first_name: string
  last_name: string
  photo_url: string | null
  playing_level: string | null
  parent_id: string | null
  parent_name: string | null
  parent_email: string | null
  age: number | null
  className: string
  attendancePct: number | null
  lastAttendanceDays: number | null  // null = no attendance recorded
  subStatus: DerivedSubStatus
  /** Raw membership statuses for this player. Feeds the one membership pill. */
  subStatuses?: Array<string | null>
  /** A 1-2-1 slot or camp booking, for a player with no class. Display only. */
  otherPlace?: '1-2-1s' | 'Camp' | null
  rowStatus: DerivedRowStatus
  reviewDue: boolean
  joinedAt: string  // ISO — for sort
  // Phase 2.4 — null when this player has no trial follow-up due. The page
  // computes this from the SAME derive layer the Enrolments / Parents pages
  // use; we do NOT re-derive in the client.
  trialFollowUpStage: TrialStage | null
  // Phase 2.5 — true when the player's parent has not been contacted in
  // 30+ days OR has never been contacted. Optional badge only, NO filter
  // chip, NO action.
  noContact30dPlus?: boolean
  // Phase 2.8 — server-computed Attendance Risk assessment. UI renders
  // fields directly; no client-side derivation. Optional for forward-
  // compat — old call sites can omit and the row degrades to no badge.
  attendanceRisk?: AttendanceRiskAssessment
  // Sprint 7 — archive metadata. null = active player. When non-null the
  // row is hidden from every filter except 'archived' and gets the
  // [ARCHIVED] badge + Restore action.
  archivedAt?: string | null
  archiveReason?: string | null
}

type FilterKey =
  | 'all' | 'active' | 'pending' | 'trial' | 'paused'
  | 'payment_issue' | 'no_attendance_30d' | 'review_due'
  | 'trial_followup'
  // Phase 2.8 — Attendance Risk chips.
  | 'attendance_risk' | 'no_attendance_14d'
  // Sprint 7 — Archived view. ONLY this filter shows archived rows.
  // Every other filter hides them by default.
  | 'archived'

type SortKey = 'name' | 'age' | 'last_attended' | 'attendance_pct' | 'joined'

// The Active / Paused / Archived tabs sit above these; the chips below are the
// finer filters, kept under "More filters".
const FILTER_CHIPS: Array<{ key: FilterKey; label: string }> = [
  { key: 'active', label: 'In a class' },
  { key: 'pending', label: 'Pending start' },
  { key: 'trial', label: 'Trial' },
  // Phase 2.4 — matches players in awaiting_followup OR stale_followup
  // (i.e. needsFollowUp(stage) === true). Booking-only follow-ups (no FK)
  // are not in this filter; they remain visible on /dashboard/enrolments
  // and /dashboard/trials.
  { key: 'trial_followup', label: 'Trial follow-up due' },
  { key: 'payment_issue', label: 'Payment issue' },
  { key: 'review_due', label: 'Review due' },
  // Phase 2.8 — Attendance Risk filters. Routed through
  // matchesAttendanceFilter so the 14d/30d thresholds live in exactly
  // one place (attendance-risk-derive.ts). 'no_attendance_30d' was
  // previously an alias for the same threshold via the old summarised-
  // attendance signal; the new route reuses the same chip key so any
  // existing deep-links keep working.
  { key: 'attendance_risk', label: 'Attendance risk' },
  { key: 'no_attendance_14d', label: 'No attendance (14d)' },
  { key: 'no_attendance_30d', label: 'No attendance (30d)' },
]
const TAB_KEYS: FilterKey[] = ['all', 'paused', 'archived']

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'name', label: 'Name (A→Z)' },
  { key: 'age', label: 'Age (youngest first)' },
  { key: 'last_attended', label: 'Last attended' },
  { key: 'attendance_pct', label: 'Attendance %' },
  { key: 'joined', label: 'Date joined' },
]

const PILL_TONE: Record<PillTone, string> = {
  ok:   'text-[#67c79a] bg-[#67c79a]/[0.12]',
  warn: 'text-[#d8a95a] bg-[#d8a95a]/[0.13]',
  bad:  'text-[#e0736d] bg-[#e0736d]/[0.13]',
  off:  'text-[#93a2ba] bg-[#93a2ba]/[0.10]',
}
// The squad sheet's "who has paid" — the same rule as the list's membership pill.
type SquadPay = 'paying' | 'problem' | 'invite' | 'none' | 'other'
const SQUAD_PAY_ORDER: SquadPay[] = ['paying', 'problem', 'invite', 'none', 'other']
const SQUAD_PAY: Record<SquadPay, { label: string; card: string; text: string; dot: string }> = {
  paying:  { label: 'paying',               card: 'Paying',               text: 'text-[#67c79a]', dot: 'bg-[#67c79a]' },
  problem: { label: 'payment problem',      card: 'Payment problem',      text: 'text-[#e0736d]', dot: 'bg-[#e0736d]' },
  invite:  { label: 'invite not confirmed', card: 'Invite not confirmed', text: 'text-[#d8a95a]', dot: 'bg-[#d8a95a]' },
  none:    { label: 'no membership',        card: 'No membership',        text: 'text-[#d8a95a]', dot: 'bg-[#d8a95a]' },
  other:   { label: 'trial or not started', card: '',                     text: 'text-[#93a2ba]', dot: 'bg-[#5b6c86]' },
}
function squadPay(r: PlayersTableRow): SquadPay {
  const m = membershipPill(r.subStatuses ?? [])
  if (m.tone === 'bad') return 'problem'
  if (m.tone === 'ok') return 'paying'
  if (m.tone === 'warn') return 'invite'
  // A trial, a class that hasn't started, or a paused/scheduled membership is not "unpaid".
  if (m.label !== 'No membership' || r.rowStatus === 'trial' || r.rowStatus === 'pending') return 'other'
  return 'none'
}

const LEVEL_CHIP: Record<string, string> = {
  beginner:     'bg-green-500/15 text-green-400',
  development:  'bg-blue-500/15 text-blue-400',
  intermediate: 'bg-amber-500/15 text-amber-400',
  advanced:     'bg-purple-500/15 text-purple-400',
  elite:        'bg-red-500/15 text-red-400',
}

export interface PlayersClassInfo { name: string; when: string; capacity: number | null }

export default function PlayersTable({ rows, classes = [] }: { rows: PlayersTableRow[]; classes?: PlayersClassInfo[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL-backed state ─ search, filter, sort all live in the URL so the
  // view is shareable and survives reload. Local useState is only used to
  // make the input feel snappy (we debounce the URL push lightly via
  // setSearch).
  const filterParam = (searchParams.get('filter') as FilterKey | null) || 'all'
  const sortParam = (searchParams.get('sort') as SortKey | null) || 'name'
  // `search` is what the Attendance and Enrolments pages link with; `q` is this list's own.
  const searchParam = searchParams.get('q') || searchParams.get('search') || ''
  const [search, setSearch] = useState(searchParam)
  const [classPick, setClassPick] = useState('')

  // "More filters" holds the finer chips, the sort and the attendance columns.
  // It opens by itself when a deep link (or the owner) is using one of them.
  const usingChip = !TAB_KEYS.includes(filterParam)
  const [moreOpen, setMoreOpen] = useState(usingChip || sortParam !== 'name')
  const showMore = moreOpen || usingChip
  // Squad sheets (one block per class) are the everyday view of the Active tab.
  // The list is one click away, and opens by itself with "More filters".
  const [asList, setAsList] = useState(false)
  const tab: 'active' | 'paused' | 'archived' = filterParam === 'archived' ? 'archived' : filterParam === 'paused' ? 'paused' : 'active'

  const squadView = tab === 'active' && !asList && !showMore

  const tabCounts = useMemo(() => ({
    active: rows.filter(r => !r.archivedAt && r.rowStatus !== 'paused').length,
    paused: rows.filter(r => !r.archivedAt && r.rowStatus === 'paused').length,
    archived: rows.filter(r => !!r.archivedAt).length,
  }), [rows])
  const classOptions = useMemo(() => [...new Set(
    rows.filter(r => !r.archivedAt).flatMap(r => r.className.split(', ').filter(Boolean)),
  )].sort((a, b) => a.localeCompare(b)), [rows])

  // Push a single URL update for any (search, filter, sort) change. We
  // don't router.refresh() — the data is already on the client.
  const updateUrl = (next: { q?: string; filter?: FilterKey; sort?: SortKey }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q)
      else params.delete('q')
    }
    if (next.filter !== undefined) {
      if (next.filter === 'all') params.delete('filter')
      else params.set('filter', next.filter)
    }
    if (next.sort !== undefined) {
      if (next.sort === 'name') params.delete('sort')
      else params.set('sort', next.sort)
    }
    const qs = params.toString()
    router.replace(qs ? `/dashboard/players?${qs}` : '/dashboard/players', { scroll: false })
  }

  // Apply filter + sort + search over the dataset in memory.
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()

    let out = rows.filter(r => {
      // Sprint 7 — Archive gate. Default behaviour: hide archived players
      // from EVERY filter except the dedicated 'archived' chip. The
      // archived chip flips this: only archived rows pass.
      const isArchived = !!r.archivedAt
      if (filterParam === 'archived') {
        if (!isArchived) return false
        // No further filters apply on the archived view.
        // Still honour search below.
      } else {
        if (isArchived) return false
      }

      // The plain view is the Active tab: everyone who isn't archived or paused.
      // Paused children have their own tab.
      if (filterParam === 'all'           && r.rowStatus === 'paused')         return false
      if (classPick && !r.className.split(', ').includes(classPick))           return false

      // Filter chip
      if (filterParam === 'active'        && r.rowStatus !== 'active')         return false
      if (filterParam === 'pending'       && r.rowStatus !== 'pending')        return false
      if (filterParam === 'trial'         && r.rowStatus !== 'trial')          return false
      if (filterParam === 'paused'        && r.rowStatus !== 'paused')         return false
      if (filterParam === 'payment_issue' && r.subStatus  !== 'past_due')      return false
      if (filterParam === 'review_due'    && !r.reviewDue)                     return false
      if (filterParam === 'trial_followup' && !r.trialFollowUpStage)            return false
      // Phase 2.8 — Attendance Risk routing through the derive layer.
      // Reuses the SAME chip key 'no_attendance_30d' that existed in
      // Phase 2.4 but with stricter semantics: tenure-gated, never_
      // attended distinguished from drifted. Old behaviour was an
      // approximation using a 30-day summary window; this is the
      // canonical check.
      const attendanceFilters: AttendanceFilterKey[] = ['attendance_risk', 'no_attendance_14d', 'no_attendance_30d']
      if (attendanceFilters.includes(filterParam as AttendanceFilterKey)) {
        if (!r.attendanceRisk) return false
        if (!matchesAttendanceFilter(r.attendanceRisk, filterParam as AttendanceFilterKey)) return false
      }

      // Search — name or parent name
      if (q.length > 0) {
        const hay = `${r.first_name} ${r.last_name} ${r.parent_name || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    // Sort
    const cmp = (a: PlayersTableRow, b: PlayersTableRow): number => {
      switch (sortParam) {
        case 'age': {
          const aa = a.age ?? Number.POSITIVE_INFINITY
          const bb = b.age ?? Number.POSITIVE_INFINITY
          if (aa !== bb) return aa - bb
          return a.first_name.localeCompare(b.first_name)
        }
        case 'last_attended': {
          // Most recent first. Players with no attendance go to the bottom.
          const aa = a.lastAttendanceDays ?? Number.POSITIVE_INFINITY
          const bb = b.lastAttendanceDays ?? Number.POSITIVE_INFINITY
          if (aa !== bb) return aa - bb
          return a.first_name.localeCompare(b.first_name)
        }
        case 'attendance_pct': {
          // Highest first.
          const aa = a.attendancePct ?? -1
          const bb = b.attendancePct ?? -1
          if (aa !== bb) return bb - aa
          return a.first_name.localeCompare(b.first_name)
        }
        case 'joined': {
          // Newest first.
          return b.joinedAt.localeCompare(a.joinedAt)
        }
        case 'name':
        default:
          return a.first_name.localeCompare(b.first_name) || a.last_name.localeCompare(b.last_name)
      }
    }
    out = [...out].sort(cmp)
    return out
  }, [rows, search, filterParam, sortParam, classPick])

  const tints = useMemo(() => classTintMap(classes.map(c => c.name)), [classes])

  // One block per class, in class-name order; children with no class come last.
  // `total` counts everyone active in the class (not just the search matches),
  // so "7 of 16 places" stays true while searching.
  const squads = useMemo(() => {
    const totals = new Map<string, number>()
    // Who has paid, per class — counted over everyone in the class, like `total`.
    const pay = new Map<string, Record<SquadPay, number>>()
    for (const r of rows) {
      if (r.archivedAt || r.rowStatus === 'paused') continue
      const state = squadPay(r)
      for (const c of r.className.split(', ').filter(Boolean)) {
        totals.set(c, (totals.get(c) || 0) + 1)
        if (!pay.has(c)) pay.set(c, { paying: 0, problem: 0, invite: 0, none: 0, other: 0 })
        pay.get(c)![state] += 1
      }
    }
    const by = new Map<string, PlayersTableRow[]>()
    for (const r of visibleRows) {
      const names = r.className.split(', ').filter(Boolean)
      for (const c of (names.length ? names : [''])) {
        if (classPick && c !== classPick) continue
        if (!by.has(c)) by.set(c, [])
        by.get(c)!.push(r)
      }
    }
    const info = new Map(classes.map(c => [c.name, c]))
    return [...by.entries()]
      .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
      .map(([name, players]) => ({
        name,
        players,
        total: totals.get(name) ?? players.length,
        when: info.get(name)?.when || '',
        pay: name ? (pay.get(name) ?? null) : null,
        capacity: name ? (info.get(name)?.capacity ?? null) : null,
      }))
  }, [rows, visibleRows, classes, classPick])

  return (
    <div className="space-y-4">
      {/* ── Toolbar: search + class + the three tabs + More filters ── */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5b6c86]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onBlur={() => updateUrl({ q: search })}
            onKeyDown={e => { if (e.key === 'Enter') updateUrl({ q: search }) }}
            placeholder="Search a player or parent"
            aria-label="Search players"
            className="w-full bg-[#0f1a2b] border border-[#1d2c42] rounded-[10px] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#5b6c86] focus:outline-none focus:border-[#4ecde6]/60"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {classOptions.length > 1 && (
            <select
              value={classPick}
              onChange={e => setClassPick(e.target.value)}
              aria-label="Class"
              className="max-w-[220px] bg-[#0f1a2b] border border-[#1d2c42] rounded-[10px] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#4ecde6]/60"
            >
              <option value="">All classes</option>
              {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <div className="inline-flex gap-0.5 rounded-[10px] border border-[#1d2c42] bg-[#0f1a2b] p-[3px]" role="group" aria-label="Which players to show">
            <SegButton active={tab === 'active'} onClick={() => updateUrl({ filter: 'all' })}>Active <Count>{tabCounts.active}</Count></SegButton>
            <SegButton active={tab === 'paused'} onClick={() => updateUrl({ filter: 'paused' })}>Paused <Count>{tabCounts.paused}</Count></SegButton>
            <SegButton active={tab === 'archived'} onClick={() => updateUrl({ filter: 'archived' })}>Archived <Count>{tabCounts.archived}</Count></SegButton>
          </div>
          {tab === 'active' && (
            <div className="inline-flex gap-0.5 rounded-[10px] border border-[#1d2c42] bg-[#0f1a2b] p-[3px]" role="group" aria-label="Layout">
              <SegButton active={squadView} onClick={() => { setAsList(false); setMoreOpen(false); if (usingChip) updateUrl({ filter: 'all' }) }}>By class</SegButton>
              <SegButton active={!squadView} onClick={() => setAsList(true)}>List</SegButton>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMoreOpen(o => !o)}
            aria-expanded={showMore}
            className={`rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors ${showMore ? 'bg-[#142236] text-white' : 'text-[#93a2ba] hover:text-white'}`}
          >
            More filters
          </button>
        </div>
      </div>

      {/* ── More filters: every finer filter and sort the list had before ── */}
      {showMore && (
        <div className="rounded-[12px] border border-[#1d2c42] bg-[#0f1a2b] p-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTER_CHIPS.map(f => {
              const active = filterParam === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => updateUrl({ filter: active ? 'all' : f.key })}
                  aria-pressed={active}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? 'bg-[#4ecde6]/15 text-[#4ecde6] border-[#4ecde6]/40'
                      : 'bg-white/[0.03] text-white/60 border-white/[0.08] hover:bg-white/[0.06]'
                  }`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
          <label className="flex items-center gap-2 text-xs text-[#93a2ba]">
            Sort by
            <select
              value={sortParam}
              onChange={e => updateUrl({ sort: e.target.value as SortKey })}
              className="bg-[#080e18] border border-[#1d2c42] rounded-lg px-2.5 py-1.5 text-[13px] text-white focus:outline-none focus:border-[#4ecde6]/60"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* ── Result summary, only when something is narrowing the list ── */}
      {(usingChip || classPick || search.trim()) && (
        <div className="text-xs text-[#5b6c86] tabular-nums">
          Showing {visibleRows.length} of {rows.length} player{rows.length === 1 ? '' : 's'}
        </div>
      )}

      {/* ── Squad sheets: one block per class (everyday view) ── */}
      {squadView && (
        visibleRows.length === 0 ? (
          <p className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] px-4 py-10 text-center text-sm text-[#93a2ba]">No players match this.</p>
        ) : (
          <div className="space-y-3.5" data-testid="players-squads">
            {squads.map(sq => {
              const tint = classTint(tints, sq.name)
              const pct = sq.capacity ? Math.min(100, Math.round((sq.total / sq.capacity) * 100)) : null
              const free = sq.capacity != null ? Math.max(0, sq.capacity - sq.total) : null
              return (
                <section key={sq.name || 'none'} className="overflow-hidden rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b]">
                  <header className="border-b border-[#1d2c42] px-4 py-3.5 sm:px-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-white">
                        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: tint }} />
                        {sq.name || 'Not in a class yet'}
                      </h2>
                      <p className="text-xs tabular-nums text-[#93a2ba]">
                        {sq.name
                          ? (sq.capacity != null ? `${sq.total} of ${sq.capacity} places` : `${sq.total} ${sq.total === 1 ? 'player' : 'players'}`)
                          : `${sq.players.length} ${sq.players.length === 1 ? 'player' : 'players'}`}
                        {sq.players.length !== sq.total && sq.name ? ` · showing ${sq.players.length}` : ''}
                      </p>
                    </div>
                    {sq.when && <p className="mt-0.5 text-xs text-[#93a2ba]">{sq.when}</p>}
                    {sq.pay && (
                      <p className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 text-xs tabular-nums" data-testid="squad-pay">
                        {SQUAD_PAY_ORDER.filter(k => sq.pay![k] > 0).map(k => (
                          <span key={k} className={`inline-flex items-center gap-1.5 ${SQUAD_PAY[k].text}`}>
                            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${SQUAD_PAY[k].dot}`} />
                            {sq.pay![k]} {SQUAD_PAY[k].label}
                          </span>
                        ))}
                      </p>
                    )}
                    {pct != null && (
                      <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-[#1d2c42]" aria-hidden>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tint }} />
                      </div>
                    )}
                  </header>
                  <ul className="grid grid-cols-1 gap-2 p-3.5 min-[420px]:grid-cols-2 sm:px-5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                    {sq.players.map(r => {
                      const state = squadPay(r)
                      const flag = sq.name && state !== 'paying' && state !== 'other' ? SQUAD_PAY[state] : null
                      return (
                        <li key={r.id}>
                          <Link href={`/dashboard/players/${r.id}`} className="flex h-full items-center gap-2.5 rounded-[11px] border border-[#1d2c42] bg-[#080e18] px-2.5 py-2 transition-colors hover:border-[#293b58]">
                            <PlayerAvatar photoUrl={r.photo_url} firstName={r.first_name} lastName={r.last_name} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-white">{r.first_name} {r.last_name}</span>
                              <span className="block truncate text-[11px] text-[#93a2ba]">
                                {r.age != null ? `Age ${r.age}` : 'Age not set'}
                                {!sq.name && r.otherPlace ? ` · ${r.otherPlace}` : ''}
                                {r.rowStatus === 'trial' ? ' · on a trial' : ''}
                              </span>
                              {flag && <span className={`block truncate text-[11px] font-semibold ${flag.text}`}>{flag.card}</span>}
                            </span>
                            {flag && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${flag.dot}`} />}
                          </Link>
                        </li>
                      )
                    })}
                    {free != null && free > 0 && !search.trim() && (
                      <li className="flex items-center justify-center rounded-[11px] border border-dashed border-[#293b58] px-2.5 py-2 text-xs text-[#5b6c86]">
                        {free} {free === 1 ? 'place' : 'places'} free
                      </li>
                    )}
                  </ul>
                </section>
              )
            })}
          </div>
        )
      )}

      {/* ── List ── */}
      {!squadView && (
      <div className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1d2c42] bg-white/[0.015]">
                <Th>Player</Th>
                <Th className="hidden md:table-cell">Class</Th>
                <Th className="hidden lg:table-cell">Parent</Th>
                {/* Sprint M1 (MF-4) / Phase 2.8 — attendance columns, now under "More filters". */}
                {showMore && <Th className="hidden sm:table-cell">Attendance</Th>}
                {showMore && <Th className="hidden lg:table-cell">Last attended</Th>}
                <Th className="hidden sm:table-cell">Membership</Th>
                <Th className="hidden sm:table-cell text-right"><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr><td colSpan={showMore ? 7 : 5} className="text-center py-10 px-4 text-[#93a2ba] text-sm">
                  {tab === 'paused' && !search.trim() ? 'Nobody is paused.' : tab === 'archived' && !search.trim() ? 'No archived players.' : 'No players match this.'}
                </td></tr>
              ) : visibleRows.map(r => (
                <PlayerRow key={r.id} r={r} showMore={showMore} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left py-2.5 px-4 font-semibold text-[#5b6c86] text-[11px] uppercase tracking-[0.07em] ${className}`}>{children}</th>
}

function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${active ? 'bg-[#142236] text-white' : 'text-[#93a2ba] hover:text-white'}`}
    >
      {children}
    </button>
  )
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#1d2c42] px-1.5 py-px text-[11px] font-semibold tabular-nums text-[#93a2ba]">{children}</span>
}

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${PILL_TONE[tone]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

function PlayerRow({ r, showMore }: { r: PlayersTableRow; showMore: boolean }) {
  const isArchived = !!r.archivedAt
  // One pill: archived, then paused class, then the membership's own state, then trial.
  const pill: { label: string; tone: PillTone } =
    isArchived ? { label: 'Archived', tone: 'off' }
    : r.rowStatus === 'paused' ? { label: 'Paused', tone: 'off' }
    : (() => {
        const m = membershipPill(r.subStatuses ?? [])
        if (m.label === 'No membership' && r.rowStatus === 'trial') return { label: 'On a trial', tone: 'off' as PillTone }
        return m
      })()
  const paying = pill.tone === 'ok' || pill.tone === 'bad'
  const actions = (
    <div className="inline-flex items-center gap-1">
      <RowActionLink href={`/dashboard/players/${r.id}`} title="View profile"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['eye']}</svg></RowActionLink>
      {r.parent_id && <RowActionLink href={`/dashboard/parents/${r.parent_id}`} title="View parent"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['parents']}</svg></RowActionLink>}
      {r.parent_id && <RowActionLink href={`/dashboard/messages?to=${r.parent_id}`} title="Message parent"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['chat']}</svg></RowActionLink>}
      <RowActionLink href={`/dashboard/attendance?player=${r.id}`} title="Mark attendance"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['check']}</svg></RowActionLink>
      <RowActionLink href="/dashboard/enrolments" title="Move class"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['move']}</svg></RowActionLink>
    </div>
  )
  return (
    <tr className={`border-b border-[#1d2c42] last:border-0 hover:bg-[#142236] transition-colors ${isArchived ? 'opacity-60' : ''}`}>
      {/* On phones this is the only column: membership and actions sit under the name. */}
      <td className="py-3 px-4 max-sm:w-full max-sm:max-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <PlayerAvatar photoUrl={r.photo_url} firstName={r.first_name} lastName={r.last_name} size="sm" />
          <div className="min-w-0">
            <Link
              href={`/dashboard/players/${r.id}`}
              className="block truncate font-semibold text-white hover:text-[#4ecde6]"
              title={isArchived ? `Archived${r.archiveReason ? ` — ${r.archiveReason.replace(/_/g, ' ')}` : ''}${r.archivedAt ? ` on ${new Date(r.archivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}` : undefined}
            >
              {r.first_name} {r.last_name}
            </Link>
            <div className="text-xs text-[#93a2ba] truncate">
              {r.age !== null ? `Age ${r.age}` : 'Age not set'}
              {/* Narrow screens hide the Class and Parent columns, so they sit here instead. */}
              <span className="md:hidden">{r.className || r.otherPlace ? ` · ${r.className || r.otherPlace}` : ''}</span>
              <span className="lg:hidden">{r.parent_name ? ` · ${r.parent_name}` : ''}</span>
            </div>
            {showMore && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {r.playing_level && LEVEL_CHIP[r.playing_level] && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${LEVEL_CHIP[r.playing_level]}`}>
                    {r.playing_level.charAt(0).toUpperCase() + r.playing_level.slice(1)}
                  </span>
                )}
                {r.reviewDue && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">Review due</span>
                )}
                {/* Phase 2.4 — Trial follow-up badge. Tone shifts to rose when stale. */}
                {r.trialFollowUpStage && (() => {
                  const badge = deriveTrialFollowUpBadge(r.trialFollowUpStage)
                  if (!badge) return null
                  const cls = badge.tone === 'rose'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  return <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${cls}`}>{badge.label}</span>
                })()}
                {/* Phase 2.5 — "No contact 30+ days". Informational only. */}
                {r.noContact30dPlus && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium border bg-rose-500/15 text-rose-300 border-rose-500/30">No contact 30+ days</span>
                )}
                {/* Phase 2.8 — Attendance risk label, reason-first wording. */}
                {r.attendanceRisk && (r.attendanceRisk.riskLevel === 'high' || r.attendanceRisk.riskLevel === 'medium') && (
                  <span className={`text-[11px] ${r.attendanceRisk.riskLevel === 'high' ? 'text-rose-300' : 'text-amber-300'}`}>
                    {r.attendanceRisk.riskReason.label}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 sm:hidden">
          <Pill tone={pill.tone}>{pill.label}</Pill>
          {actions}
        </div>
      </td>
      <td className="py-3 px-4 hidden md:table-cell max-w-[240px] truncate" title={r.className}>
        {r.className
          ? <span className="text-white/90">{r.className}</span>
          : r.otherPlace
            ? <span className="text-white/90">{r.otherPlace}</span>
            // A paused, pending or trial place isn't "no class": only say that when there is none at all.
            : isArchived || r.rowStatus === 'paused' ? <span className="text-[#5b6c86]">—</span>
            : r.rowStatus === 'pending' ? <span className="text-[#93a2ba]">Starts soon</span>
            : r.rowStatus === 'trial' ? <span className="text-[#93a2ba]">On a trial</span>
            : <span className={paying ? 'text-[#d8a95a]' : 'text-[#5b6c86]'}>No class yet</span>}
      </td>
      <td className="py-3 px-4 hidden lg:table-cell max-w-[200px] truncate">
        {r.parent_id && r.parent_name
          ? <Link href={`/dashboard/parents/${r.parent_id}`} className="text-[#93a2ba] hover:text-white">{r.parent_name}</Link>
          : <span className="text-[#5b6c86]">—</span>}
      </td>
      {showMore && (
        <td className="py-3 px-4 hidden sm:table-cell">
          {r.attendancePct === null ? (
            <span className="text-white/40">—</span>
          ) : (
            <div className="flex flex-col">
              <span className="font-medium tabular-nums">{r.attendancePct}%</span>
              {r.lastAttendanceDays !== null && (
                <span className="text-[10px] text-white/40 tabular-nums">{r.lastAttendanceDays === 0 ? 'today' : `${r.lastAttendanceDays}d ago`}</span>
              )}
            </div>
          )}
        </td>
      )}
      {/* Phase 2.8 — Last attended column. Pure render from the derive layer. */}
      {showMore && (
        <td className="py-3 px-4 hidden lg:table-cell">
          {r.attendanceRisk ? (() => {
            const label = formatLastAttended(r.attendanceRisk)
            const level = r.attendanceRisk.riskLevel
            const cls =
              level === 'high'   ? 'text-rose-300 font-medium'
              : level === 'medium' ? 'text-amber-300 font-medium'
              : level === 'not_applicable' ? 'text-white/40'
              : 'text-white/70'
            return <span className={`text-xs tabular-nums ${cls}`}>{label}</span>
          })() : <span className="text-white/40">—</span>}
        </td>
      )}
      <td className="py-3 px-4 hidden sm:table-cell">
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </td>
      <td className="py-3 px-4 hidden sm:table-cell text-right whitespace-nowrap">{actions}</td>
    </tr>
  )
}

function RowActionLink({ href, title, children, className = 'inline-flex' }: { href: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className={`${className} items-center justify-center w-7 h-7 rounded-md text-[12px] text-[#5b6c86] hover:bg-white/[0.08] hover:text-white transition-colors`}
    >
      {children}
    </Link>
  )
}
