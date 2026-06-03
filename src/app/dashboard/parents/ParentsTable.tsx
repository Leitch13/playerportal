'use client'

/**
 * Parents List v2 — client-side interactivity layer.
 *
 * Receives the fully-hydrated dataset from the server-rendered page; all
 * search / filter / sort operations are pure JS over that dataset. No
 * refetches, no API calls, no Stripe contact, no writes.
 *
 * State lives in URL params (?q=, ?filter=, ?sort=) so the view is
 * shareable and survives reload. Per-row quick actions are LINKS ONLY.
 * `ParentProfileEditor` is preserved in the actions cluster (existing
 * client component, untouched).
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import ParentProfileEditor from './ParentProfileEditor'
import {
  parentSearchHay,
  parentMatchesFilter,
  compareParents,
  type ParentRowFacts,
  type ParentFilterKey,
  type ParentSortKey,
} from '@/lib/parents-derive'
// Phase 2.5 — Last Contacted column. Pure helpers, no I/O.
import { formatContactAge, contactBucket } from '@/lib/contact-derive'

const FILTER_CHIPS: Array<{ key: ParentFilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'healthy', label: 'Healthy' },
  { key: 'payment_issues', label: 'Payment issues' },
  { key: 'pending_starts', label: 'Pending starts' },
  { key: 'trials', label: 'Trials' },
  // Phase 2.4 — matches rows with the trial_followup_due / trial_stale_followup
  // badge attached server-side. Same cohort surfaced on the Enrolments page.
  { key: 'trial_followup', label: 'Trial follow-up due' },
  { key: 'no_attendance_30d', label: 'No attendance (30d)' },
  { key: 'review_due', label: 'Review due' },
  // Phase 2.5 — Last Contacted chips. Routed via matchesContactFilter so the
  // 30-day boundary stays in exactly one place (contact-derive.ts).
  { key: 'contacted_recently', label: 'Contacted recently' },
  { key: 'not_contacted_30d', label: 'Not contacted 30+ days' },
  { key: 'never_contacted', label: 'Never contacted' },
]

const SORT_OPTIONS: Array<{ key: ParentSortKey; label: string }> = [
  { key: 'name', label: 'Name (A→Z)' },
  { key: 'children', label: 'Most children first' },
  { key: 'value', label: 'Highest monthly value' },
  { key: 'joined', label: 'Most recent join' },
]

// Health chip palette
const HEALTH: Record<ParentRowFacts['billingStatus'], { label: string; emoji: string; cls: string }> = {
  healthy:        { label: 'Healthy',       emoji: '🟢', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  payment_issue:  { label: 'Payment issue', emoji: '⚠️', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  pending_start:  { label: 'Pending start', emoji: '⏳', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  none:           { label: 'No sub',        emoji: '·',  cls: 'bg-white/[0.04] text-white/40 border-white/[0.10]' },
}

const BADGE_TONE: Record<string, string> = {
  rose:    'bg-rose-500/15    text-rose-300    border-rose-500/30',
  amber:   'bg-amber-500/15   text-amber-300   border-amber-500/30',
  sky:     'bg-sky-500/15     text-sky-300     border-sky-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
}

// The ParentProfileEditor expects this shape — we keep the original
// editor untouched and feed it from the row payload. `full_name` is
// non-null to match the editor's existing prop type; the page coerces
// any DB null to '' when building this payload.
interface EditorParentInput {
  id: string
  full_name: string
  phone: string | null
  address: string | null
  secondary_contact_name: string | null
  secondary_contact_phone: string | null
  notes: string | null
}

export interface ParentsTableRow extends ParentRowFacts {
  editor: EditorParentInput
}

export default function ParentsTable({ rows }: { rows: ParentsTableRow[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const filterParam = (searchParams.get('filter') as ParentFilterKey | null) || 'all'
  const sortParam = (searchParams.get('sort') as ParentSortKey | null) || 'name'
  const searchParam = searchParams.get('q') || ''
  const [search, setSearch] = useState(searchParam)

  const updateUrl = (next: { q?: string; filter?: ParentFilterKey; sort?: ParentSortKey }) => {
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
    router.replace(qs ? `/dashboard/parents?${qs}` : '/dashboard/parents', { scroll: false })
  }

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = rows.filter(r => {
      if (!parentMatchesFilter(r, filterParam)) return false
      if (q.length > 0 && !parentSearchHay(r).includes(q)) return false
      return true
    })
    out = [...out].sort((a, b) => compareParents(a, b, sortParam))
    return out
  }, [rows, search, filterParam, sortParam])

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onBlur={() => updateUrl({ q: search })}
          onKeyDown={e => { if (e.key === 'Enter') updateUrl({ q: search }) }}
          placeholder="Search by parent, email, phone, or child name…"
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
        />
        <select
          value={sortParam}
          onChange={e => updateUrl({ sort: e.target.value as ParentSortKey })}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
        >
          {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {/* ── Filter chips ── */}
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

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-white/40">
          Showing {visibleRows.length} of {rows.length} {rows.length === 1 ? 'family' : 'families'}
        </div>
        {/* Phase 2.3b: surface a deep-link to BulkMessageForm whenever the
            admin has actively filtered (filter != all) AND the visible cohort
            has 2+ recipients. URL state is the source of truth — the link
            carries the visible IDs into /dashboard/messages?recipients=... */}
        {filterParam !== 'all' && visibleRows.length >= 2 && (
          <Link
            href={`/dashboard/messages?recipients=${encodeURIComponent(visibleRows.map(r => r.id).join(','))}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[#4ecde6]/15 text-[#4ecde6] border border-[#4ecde6]/40 hover:bg-[#4ecde6]/25 transition-colors"
          >
            ✉ Message {visibleRows.length} families
          </Link>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider">Family</th>
                <th className="text-center py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider">Children</th>
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider hidden md:table-cell">Monthly value</th>
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider">Billing health</th>
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider hidden md:table-cell">Attention</th>
                {/* Phase 2.5 — Last contact column, hidden below lg to avoid horizontal overflow on tablets. */}
                <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider hidden lg:table-cell">Last contact</th>
                <th className="text-right py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-white/40 text-sm">No families match this filter.</td></tr>
              ) : visibleRows.map(r => <ParentRow key={r.id} r={r} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ParentRow({ r }: { r: ParentsTableRow }) {
  const health = HEALTH[r.billingStatus]
  const waNumber = (r.parentPhone || '').replace(/[\s\-()+]+/g, '').replace(/^0/, '44')
  const actionableBadges = r.badges.filter(b => b.key !== 'sibling_eligible')

  return (
    <tr className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
      <td className="py-2.5 px-3">
        <Link href={`/dashboard/parents/${r.id}`} className="text-[#4ecde6] hover:underline font-medium">
          {r.parentName}
        </Link>
        {(r.parentEmail || r.parentPhone) && (
          <div className="text-[11px] text-white/40 mt-0.5 truncate max-w-[260px]">
            {r.parentEmail}{r.parentEmail && r.parentPhone ? ' · ' : ''}{r.parentPhone}
          </div>
        )}
      </td>
      {/* Child count — prominent per user spec */}
      <td className="py-2.5 px-3 text-center">
        <div className="inline-flex flex-col items-center">
          <span className="text-xl font-extrabold tabular-nums leading-none text-white">{r.childCount}</span>
          {r.childrenNames.length > 0 && (
            <span className="text-[10px] text-white/40 mt-0.5 max-w-[120px] truncate" title={r.childrenNames.join(', ')}>
              {r.childrenNames.slice(0, 2).map(n => n.split(' ')[0]).join(', ')}{r.childrenNames.length > 2 ? ` +${r.childrenNames.length - 2}` : ''}
            </span>
          )}
        </div>
      </td>
      <td className="py-2.5 px-3 hidden md:table-cell text-white/80 tabular-nums">
        {r.familyValue > 0 ? `£${r.familyValue.toFixed(0)}/mo` : <span className="text-white/40">—</span>}
      </td>
      <td className="py-2.5 px-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${health.cls}`}>
          <span aria-hidden>{health.emoji}</span>{health.label}
        </span>
      </td>
      <td className="py-2.5 px-3 hidden md:table-cell">
        {actionableBadges.length === 0 ? (
          <span className="text-white/40 text-xs">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {actionableBadges.slice(0, 3).map(b => (
              <span
                key={b.key}
                title={b.label}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${BADGE_TONE[b.tone] || BADGE_TONE.amber}`}
              >
                <span aria-hidden>{b.emoji}</span>{b.label.replace(/:\s.*/, '')}
              </span>
            ))}
            {actionableBadges.length > 3 && <span className="text-[10px] text-white/40">+{actionableBadges.length - 3}</span>}
          </div>
        )}
      </td>
      {/* Phase 2.5 — Last contact cell. Three-state colour:
            • Today/recent_7d/recent_30d → muted (no signal needed)
            • stale_30plus               → amber (mild warning)
            • never                      → rose  (loudest — needs first contact)
          Pure render from the pre-attached signal; no client-side fetch. */}
      <td className="py-2.5 px-3 hidden lg:table-cell">
        {(() => {
          const sig = r.contactSignal ?? null
          const bucket = contactBucket(sig)
          const label = formatContactAge(sig)
          const cls =
            bucket === 'never'        ? 'text-rose-300'
            : bucket === 'stale_30plus' ? 'text-amber-300'
            : 'text-white/70'
          return <span className={`text-xs tabular-nums ${cls}`}>{label}</span>
        })()}
      </td>
      <td className="py-2.5 px-3 text-right">
        <div className="inline-flex items-center gap-1 whitespace-nowrap">
          <RowActionLink href={`/dashboard/parents/${r.id}`} title="View family">👨‍👩‍👧</RowActionLink>
          <RowActionLink href={`/dashboard/messages?to=${r.id}`} title="Message">✉️</RowActionLink>
          {r.parentPhone && <RowActionAnchor href={`tel:${r.parentPhone}`} title="Call">📞</RowActionAnchor>}
          {r.parentPhone && <RowActionAnchor href={`https://wa.me/${waNumber}`} title="WhatsApp" external>💬</RowActionAnchor>}
          {r.parentEmail && <RowActionAnchor href={`mailto:${r.parentEmail}`} title="Email">📧</RowActionAnchor>}
          <ParentProfileEditor parent={r.editor} />
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

function RowActionAnchor({ href, title, children, external }: { href: string; title: string; children: React.ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      title={title}
      aria-label={title}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white transition-colors"
    >
      {children}
    </a>
  )
}
