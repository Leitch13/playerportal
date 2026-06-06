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
 */

import Link from 'next/link'
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
}

type FilterKey =
  | 'all' | 'active' | 'pending' | 'trial' | 'paused'
  | 'payment_issue' | 'no_attendance_30d' | 'review_due'
  | 'trial_followup'
  // Phase 2.8 — Attendance Risk chips.
  | 'attendance_risk' | 'no_attendance_14d'

type SortKey = 'name' | 'age' | 'last_attended' | 'attendance_pct' | 'joined'

const FILTER_CHIPS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending start' },
  { key: 'trial', label: 'Trial' },
  // Phase 2.4 — matches players in awaiting_followup OR stale_followup
  // (i.e. needsFollowUp(stage) === true). Booking-only follow-ups (no FK)
  // are not in this filter; they remain visible on /dashboard/enrolments
  // and /dashboard/trials.
  { key: 'trial_followup', label: 'Trial follow-up due' },
  { key: 'paused', label: 'Paused' },
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

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'name', label: 'Name (A→Z)' },
  { key: 'age', label: 'Age (youngest first)' },
  { key: 'last_attended', label: 'Last attended' },
  { key: 'attendance_pct', label: 'Attendance %' },
  { key: 'joined', label: 'Date joined' },
]

// Static chip palettes — kept JIT-safe.
const SUB_CHIP: Record<DerivedSubStatus, { label: string; emoji: string; cls: string }> = {
  active:    { label: 'Active',    emoji: '💳', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  past_due:  { label: 'Past due',  emoji: '⚠️', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  pending:   { label: 'Pending',   emoji: '⏳', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  cancelled: { label: 'Cancelled', emoji: '❌', cls: 'bg-white/[0.05] text-white/50 border-white/[0.10]' },
  none:      { label: 'No sub',    emoji: '·',  cls: 'bg-white/[0.04] text-white/40 border-white/[0.08]' },
}
const STATUS_CHIP: Record<DerivedRowStatus, { label: string; emoji: string; cls: string }> = {
  active:   { label: 'Active',   emoji: '🟢', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  pending:  { label: 'Pending',  emoji: '🟡', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  trial:    { label: 'Trial',    emoji: '🔵', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  paused:   { label: 'Paused',   emoji: '🟠', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  inactive: { label: 'Inactive', emoji: '·',  cls: 'bg-white/[0.04] text-white/40 border-white/[0.08]' },
}
const LEVEL_CHIP: Record<string, string> = {
  beginner:     'bg-green-500/15 text-green-400',
  development:  'bg-blue-500/15 text-blue-400',
  intermediate: 'bg-amber-500/15 text-amber-400',
  advanced:     'bg-purple-500/15 text-purple-400',
  elite:        'bg-red-500/15 text-red-400',
}

export default function PlayersTable({ rows }: { rows: PlayersTableRow[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL-backed state ─ search, filter, sort all live in the URL so the
  // view is shareable and survives reload. Local useState is only used to
  // make the input feel snappy (we debounce the URL push lightly via
  // setSearch).
  const filterParam = (searchParams.get('filter') as FilterKey | null) || 'all'
  const sortParam = (searchParams.get('sort') as SortKey | null) || 'name'
  const searchParam = searchParams.get('q') || ''
  const [search, setSearch] = useState(searchParam)

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
  }, [rows, search, filterParam, sortParam])

  return (
    <div className="space-y-4">
      {/* ── Toolbar: search + sort ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onBlur={() => updateUrl({ q: search })}
            onKeyDown={e => { if (e.key === 'Enter') updateUrl({ q: search }) }}
            placeholder="Search by player or parent name…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
          />
        </div>
        <select
          value={sortParam}
          onChange={e => updateUrl({ sort: e.target.value as SortKey })}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Filter chip row ── */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_CHIPS.map(f => {
          const active = filterParam === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => updateUrl({ filter: f.key })}
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

      {/* ── Result summary ── */}
      <div className="text-[11px] text-white/40">
        Showing {visibleRows.length} of {rows.length} player{rows.length === 1 ? '' : 's'}
      </div>

      {/* ── Table ── */}
      <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider">Player</th>
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider hidden sm:table-cell">Age</th>
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider hidden md:table-cell">Class</th>
                {/* Sprint M1 (MF-4) — Attendance % surfaces from sm: instead of md:
                    so phones get the headline retention signal alongside Age. */}
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider hidden sm:table-cell">Attendance</th>
                {/* Phase 2.8 — "Last attended" column. Hidden below lg
                    to preserve mobile layout. The badge cell inside
                    Player still shows the inline risk label so mobile
                    users see something. */}
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider hidden lg:table-cell">Last attended</th>
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider">Sub</th>
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider">Status</th>
                <th className="text-right py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-white/40 text-sm">No players match this filter.</td></tr>
              ) : visibleRows.map(r => (
                <PlayerRow key={r.id} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PlayerRow({ r }: { r: PlayersTableRow }) {
  const sub = SUB_CHIP[r.subStatus]
  const status = STATUS_CHIP[r.rowStatus]
  return (
    <tr className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
      <td className="py-2.5 px-3">
        <Link href={`/dashboard/players/${r.id}`} className="flex items-center gap-2 text-[#4ecde6] hover:underline">
          <PlayerAvatar photoUrl={r.photo_url} firstName={r.first_name} lastName={r.last_name} size="sm" />
          <span className="font-medium">{r.first_name} {r.last_name}</span>
          {r.playing_level && LEVEL_CHIP[r.playing_level] && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${LEVEL_CHIP[r.playing_level]}`}>
              {r.playing_level.charAt(0).toUpperCase() + r.playing_level.slice(1)}
            </span>
          )}
          {r.reviewDue && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30" title="Review due">📋</span>
          )}
          {/* Phase 2.4 — Trial follow-up badge. Tone shifts to rose when stale.
              Title text spells out the stage for the hover tooltip. */}
          {r.trialFollowUpStage && (() => {
            const badge = deriveTrialFollowUpBadge(r.trialFollowUpStage)
            if (!badge) return null
            const cls = badge.tone === 'rose'
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            return (
              <span
                title={badge.label}
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${cls}`}
              >
                {badge.emoji}
              </span>
            )
          })()}
          {/* Phase 2.5 — Optional "No contact 30+ days" badge. Rose tone so
              it lines up visually with the existing trial stale follow-up
              cue. No filter chip, no action — purely informational. */}
          {r.noContact30dPlus && (
            <span
              title="Parent has not been contacted in 30+ days"
              className="px-1.5 py-0.5 rounded-full text-[9px] font-medium border bg-rose-500/15 text-rose-300 border-rose-500/30"
            >
              📭
            </span>
          )}
        </Link>
        {/* Phase 2.8 — Attendance risk label. Reason-first wording per spec
            ("Never attended (Nd enrolled)" / "Drifted away (Nd since
            attendance)") — NO generic "High"/"Medium" labels. Tone follows
            the derive layer's level. Renders nothing for healthy /
            new_player / not_applicable. */}
        {r.attendanceRisk && (r.attendanceRisk.riskLevel === 'high' || r.attendanceRisk.riskLevel === 'medium') && (
          <div className="text-[11px] mt-1">
            <span
              className={
                r.attendanceRisk.riskLevel === 'high'
                  ? 'text-rose-300'
                  : 'text-amber-300'
              }
            >
              ⚠ {r.attendanceRisk.riskReason.label}
            </span>
          </div>
        )}
        {r.parent_name && (
          <div className="text-[11px] text-white/40 mt-0.5 truncate max-w-[260px]">↳ {r.parent_name}</div>
        )}
      </td>
      <td className="py-2.5 px-3 hidden sm:table-cell text-white/70 tabular-nums">{r.age ?? '—'}</td>
      <td className="py-2.5 px-3 hidden md:table-cell text-white/60 max-w-[200px] truncate" title={r.className}>{r.className || '—'}</td>
      <td className="py-2.5 px-3 hidden sm:table-cell">
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
      {/* Phase 2.8 — Last attended column. Pure render from the derive
          layer; formatter handles 'Today' / 'Yesterday' / 'N days ago'
          / 'Never'. Tone shifts to rose when high-risk, amber when
          medium, muted otherwise — same palette as the inline label. */}
      <td className="py-2.5 px-3 hidden lg:table-cell">
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
      <td className="py-2.5 px-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${sub.cls}`}>
          <span aria-hidden>{sub.emoji}</span>{sub.label}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${status.cls}`}>
          <span aria-hidden>{status.emoji}</span>{status.label}
        </span>
      </td>
      <td className="py-2.5 px-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1">
          <RowActionLink href={`/dashboard/players/${r.id}`} title="View profile">👤</RowActionLink>
          {r.parent_id && <RowActionLink href={`/dashboard/parents/${r.parent_id}`} title="View parent">👨‍👩‍👧</RowActionLink>}
          {r.parent_id && <RowActionLink href={`/dashboard/messages?to=${r.parent_id}`} title="Message parent">✉️</RowActionLink>}
          <RowActionLink href={`/dashboard/attendance?player=${r.id}`} title="Mark attendance">✓</RowActionLink>
          <RowActionLink href="/dashboard/enrolments" title="Move class">↔️</RowActionLink>
        </div>
      </td>
    </tr>
  )
}

function RowActionLink({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white transition-colors"
    >
      {children}
    </Link>
  )
}
