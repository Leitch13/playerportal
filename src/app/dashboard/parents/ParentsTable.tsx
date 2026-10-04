'use client'

/**
 * Parents list — client-side interactivity layer.
 *
 * Receives the fully-hydrated dataset from the server-rendered page; all
 * search / filter / sort operations are pure JS over that dataset. No
 * refetches, no API calls, no Stripe contact, no writes.
 *
 * Oct 2026 — the calm list. By default an owner sees one line per family
 * (who, children, what they pay, one membership pill) and ONE filter,
 * "Needs a look", which only holds real problems (failed payment, recent
 * invite not confirmed, a child not in a class). Everything the old list
 * had is still here under "More filters": every filter chip, the sort, and
 * the Attention + Last contact columns. Deep links such as
 * ?filter=payment_issues or ?filter=needs_attention open with it showing.
 *
 * State lives in URL params (?q=, ?filter=, ?sort=) so the view is
 * shareable and survives reload. Per-row quick actions are LINKS ONLY.
 * `ParentProfileEditor` is preserved in the actions cluster (existing
 * client component, untouched).
 */

import { useMemo, useState } from 'react'
import { PALETTE_ICON_PATHS } from '@/components/ui/PaletteIcon'
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
import { initialsOf, type LookReason, type MembershipPill, type PillTone } from '@/lib/needs-a-look'
import { classTint, type ClassTints } from '@/lib/class-tint'

// 'look' is this list's own filter: families with a real problem. It is not a
// ParentFilterKey, so it never reaches parentMatchesFilter.
type ListFilter = ParentFilterKey | 'look'

const FILTER_CHIPS: Array<{ key: ParentFilterKey; label: string }> = [
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
  // Phase 2.6 — At-Risk chips. Tier / no-contact / attendance breakouts route
  // through at-risk-derive so all surfaces agree on what counts as risk.
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'high_risk', label: 'High risk' },
  { key: 'no_contact', label: 'No contact' },
  { key: 'attendance_risk', label: 'Attendance risk' },
]

const SORT_OPTIONS: Array<{ key: ParentSortKey; label: string }> = [
  { key: 'name', label: 'Name (A→Z)' },
  { key: 'children', label: 'Most children first' },
  { key: 'value', label: 'Highest monthly value' },
  { key: 'joined', label: 'Most recent join' },
]

const PILL_TONE: Record<PillTone, string> = {
  ok:   'text-[#67c79a] bg-[#67c79a]/[0.12]',
  warn: 'text-[#d8a95a] bg-[#d8a95a]/[0.13]',
  bad:  'text-[#e0736d] bg-[#e0736d]/[0.13]',
  off:  'text-[#93a2ba] bg-[#93a2ba]/[0.10]',
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
  /** Real problems only (failed payment, recent invite, child with no class). Empty = fine. */
  look: LookReason[]
  /** One membership pill for the family. */
  pill: MembershipPill
  /** Live children and where they train, for the family cards. */
  kids: Array<{ id: string; firstName: string; className: string | null; place: string }>
}

export default function ParentsTable({ rows, tints = {} }: { rows: ParentsTableRow[]; tints?: ClassTints }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const filterParam = (searchParams.get('filter') as ListFilter | null) || 'all'
  const sortParam = (searchParams.get('sort') as ParentSortKey | null) || 'name'
  const searchParam = searchParams.get('q') || ''
  const [search, setSearch] = useState(searchParam)

  // "More filters" holds the old chips, the sort and the two extra columns. It
  // opens by itself when a deep link (or the owner) is using one of them.
  const usingOldFilter = filterParam !== 'all' && filterParam !== 'look'
  const [moreOpen, setMoreOpen] = useState(usingOldFilter || sortParam !== 'name')
  const showMore = moreOpen || usingOldFilter
  // Cards are the everyday view. The list is one click away, and opens by itself
  // with "More filters" because that is where its extra columns live.
  const [asList, setAsList] = useState(false)
  const listView = asList || showMore

  const updateUrl = (next: { q?: string; filter?: ListFilter; sort?: ParentSortKey }) => {
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

  const lookCount = useMemo(() => rows.filter(r => r.look.length > 0).length, [rows])

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = rows.filter(r => {
      if (filterParam === 'look') {
        if (r.look.length === 0) return false
      } else if (!parentMatchesFilter(r, filterParam)) return false
      if (q.length > 0 && !parentSearchHay(r).includes(q)) return false
      return true
    })
    out = [...out].sort((a, b) => compareParents(a, b, sortParam))
    return out
  }, [rows, search, filterParam, sortParam])

  const colCount = showMore ? 7 : 5

  return (
    <div className="space-y-4">
      {/* ── Toolbar: search + the two views + More filters ── */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5b6c86]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onBlur={() => updateUrl({ q: search })}
            onKeyDown={e => { if (e.key === 'Enter') updateUrl({ q: search }) }}
            placeholder="Search a parent, child, email or phone"
            aria-label="Search parents"
            className="w-full bg-[#0f1a2b] border border-[#1d2c42] rounded-[10px] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#5b6c86] focus:outline-none focus:border-[#4ecde6]/60"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex gap-0.5 rounded-[10px] border border-[#1d2c42] bg-[#0f1a2b] p-[3px]" role="group" aria-label="Which families to show">
            <SegButton active={filterParam === 'all'} onClick={() => updateUrl({ filter: 'all' })}>
              All <Count>{rows.length}</Count>
            </SegButton>
            <SegButton active={filterParam === 'look'} onClick={() => updateUrl({ filter: 'look' })}>
              Needs a look <Count warn={lookCount > 0}>{lookCount}</Count>
            </SegButton>
          </div>
          <div className="inline-flex gap-0.5 rounded-[10px] border border-[#1d2c42] bg-[#0f1a2b] p-[3px]" role="group" aria-label="Layout">
            <SegButton active={!listView} onClick={() => { setAsList(false); setMoreOpen(false); if (usingOldFilter) updateUrl({ filter: 'all' }) }}>Cards</SegButton>
            <SegButton active={listView} onClick={() => setAsList(true)}>List</SegButton>
          </div>
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

      {/* ── More filters: every filter and sort the list had before ── */}
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
              onChange={e => updateUrl({ sort: e.target.value as ParentSortKey })}
              className="bg-[#080e18] border border-[#1d2c42] rounded-lg px-2.5 py-1.5 text-[13px] text-white focus:outline-none focus:border-[#4ecde6]/60"
            >
              {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
        </div>
      )}

      {(filterParam !== 'all' || search.trim()) && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-[#5b6c86] tabular-nums">
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
              Message {visibleRows.length} families
            </Link>
          )}
        </div>
      )}

      {/* ── Needs a look: a short strip above the cards, only when something does ── */}
      {!listView && filterParam === 'all' && !search.trim() && lookCount > 0 && (
        <section aria-label="Needs a look" className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] px-4 py-3.5 sm:px-5" data-testid="parents-look-strip">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">Needs a look · {lookCount}</h2>
            {lookCount > 3 && (
              <button type="button" onClick={() => updateUrl({ filter: 'look' })} className="text-xs font-semibold text-[#4ecde6] hover:text-white">See all {lookCount}</button>
            )}
          </div>
          <ul className="mt-2 divide-y divide-[#1d2c42]">
            {rows.filter(r => r.look.length > 0).slice(0, 3).map(r => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5">
                <p className="flex min-w-0 items-start gap-2.5 text-sm">
                  <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#d8a95a]" />
                  <span className="min-w-0"><span className="font-semibold text-white">{r.parentName}</span> <span className="text-[#93a2ba]">· {r.look[0].todo}</span></span>
                </p>
                <Link href={`/dashboard/parents/${r.id}`} className="shrink-0 rounded-[9px] border border-[#293b58] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:border-[#4ecde6]">Open family</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Family cards (everyday view) ── */}
      {!listView && (
        visibleRows.length === 0 ? (
          <p className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] px-4 py-10 text-center text-sm text-[#93a2ba]">
            {filterParam === 'look' && !search.trim()
              ? 'Nothing needs a look. No failed payments, and everyone who should be in a class is.'
              : 'No families match this.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-testid="parents-cards">
            {visibleRows.map(r => <FamilyCard key={r.id} r={r} tints={tints} showTodo={filterParam === 'look'} />)}
          </div>
        )
      )}

      {/* ── List ── */}
      {listView && (
      <div className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1d2c42] bg-white/[0.015]">
                <Th>Family</Th>
                <Th className="hidden sm:table-cell">Children</Th>
                <Th className="hidden md:table-cell">Monthly</Th>
                <Th className="hidden sm:table-cell">Membership</Th>
                {showMore && <Th className="hidden md:table-cell">Attention</Th>}
                {showMore && <Th className="hidden lg:table-cell">Last contact</Th>}
                <Th className="hidden sm:table-cell text-right"><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr><td colSpan={colCount} className="text-center py-10 px-4 text-[#93a2ba] text-sm">
                  {filterParam === 'look' && !search.trim()
                    ? 'Nothing needs a look. No failed payments, and everyone who should be in a class is.'
                    : 'No families match this.'}
                </td></tr>
              ) : visibleRows.map(r => <ParentRow key={r.id} r={r} showMore={showMore} showTodo={filterParam === 'look'} />)}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  )
}

function FamilyCard({ r, showTodo, tints }: { r: ParentsTableRow; showTodo: boolean; tints: ClassTints }) {
  const waNumber = (r.parentPhone || '').replace(/[\s\-()+]+/g, '').replace(/^0/, '44')
  return (
    <article className="flex flex-col gap-3 rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] p-4 transition-colors hover:border-[#293b58]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/dashboard/parents/${r.id}`} className="block truncate text-[15px] font-semibold text-white hover:text-[#4ecde6]">{r.parentName}</Link>
          {(r.parentEmail || r.parentPhone) && (
            <p className="truncate text-xs text-[#93a2ba]">{r.parentEmail || r.parentPhone}</p>
          )}
        </div>
        <p className="shrink-0 whitespace-nowrap text-xl font-bold tabular-nums text-white">
          {r.familyValue > 0
            ? <>£{r.familyValue.toFixed(0)}<span className="text-[11px] font-medium text-[#93a2ba]"> /mo</span></>
            : <span className="text-sm font-normal text-[#5b6c86]">—</span>}
        </p>
      </div>

      {r.kids.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[#293b58] px-3 py-2 text-xs text-[#5b6c86]">No children added</p>
      ) : (
        <ul className="space-y-1.5">
          {r.kids.map(k => (
            <li key={k.id}>
              <Link href={`/dashboard/players/${k.id}`} className="flex items-center gap-2.5 rounded-[10px] border border-[#1d2c42] bg-[#080e18] px-2.5 py-1.5 text-[13px] transition-colors hover:border-[#293b58]">
                <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-[#080e18]" style={{ background: classTint(tints, k.className) }}>
                  {k.firstName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 truncate">
                  <span className="font-medium text-white">{k.firstName}</span>
                  <span className={`text-xs ${k.className ? 'text-[#93a2ba]' : 'text-[#5b6c86]'}`}> · {k.place}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showTodo && r.look.map(l => <p key={l.key} className="text-xs leading-snug text-[#93a2ba]">{l.todo}</p>)}

      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-2 pt-0.5">
        <Pill tone={r.pill.tone}>{r.pill.label}</Pill>
        <div className="ml-auto inline-flex items-center gap-1">
          <RowActionLink href={`/dashboard/messages?to=${r.id}`} title="Message"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['chat']}</svg></RowActionLink>
          {r.parentPhone && <RowActionAnchor href={`tel:${r.parentPhone}`} title="Call"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['phone']}</svg></RowActionAnchor>}
          {r.parentPhone && <RowActionAnchor href={`https://wa.me/${waNumber}`} title="WhatsApp" external><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['chat']}</svg></RowActionAnchor>}
        </div>
        {/* The Edit button sits with the icons; once open, the form takes the card's full width. */}
        <div className="has-[input]:basis-full [&>div]:!mt-0 [&>div]:!w-full [&>div>div]:!grid-cols-1">
          <ParentProfileEditor parent={r.editor} />
        </div>
      </div>
    </article>
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

function Count({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span className={`rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums ${warn ? 'bg-[#d8a95a]/[0.16] text-[#d8a95a]' : 'bg-[#1d2c42] text-[#93a2ba]'}`}>
      {children}
    </span>
  )
}

function ParentRow({ r, showMore, showTodo }: { r: ParentsTableRow; showMore: boolean; showTodo: boolean }) {
  const waNumber = (r.parentPhone || '').replace(/[\s\-()+]+/g, '').replace(/^0/, '44')
  const actionableBadges = r.badges.filter(b => b.key !== 'sibling_eligible')
  // The pill says the money state; a child with no class is a second, smaller flag.
  const noClass = r.look.find(l => l.key === 'no_class')
  const firstNames = r.childrenNames.map(n => n.split(' ')[0])

  const pills = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill tone={r.pill.tone}>{r.pill.label}</Pill>
      {noClass && <Pill tone="warn">{noClass.label}</Pill>}
    </div>
  )
  const todos = showTodo && r.look.map(l => (
    <p key={l.key} className="mt-1.5 max-w-[340px] text-xs leading-snug text-[#93a2ba]">{l.todo}</p>
  ))
  const actions = (
    <div className="inline-flex flex-wrap items-center gap-1 whitespace-nowrap sm:justify-end">
      <RowActionLink href={`/dashboard/parents/${r.id}`} title="View family"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['eye']}</svg></RowActionLink>
      <RowActionLink href={`/dashboard/messages?to=${r.id}`} title="Message"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['chat']}</svg></RowActionLink>
      {r.parentPhone && <RowActionAnchor href={`tel:${r.parentPhone}`} title="Call"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['phone']}</svg></RowActionAnchor>}
      {r.parentPhone && <RowActionAnchor href={`https://wa.me/${waNumber}`} title="WhatsApp" external><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['chat']}</svg></RowActionAnchor>}
      {r.parentEmail && <RowActionLink href={`/dashboard/messages?to=${r.id}`} title="Email"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{PALETTE_ICON_PATHS['mail']}</svg></RowActionLink>}
      <ParentProfileEditor parent={r.editor} />
    </div>
  )

  return (
    <tr className="border-b border-[#1d2c42] last:border-0 hover:bg-[#142236] transition-colors">
      {/* On phones this is the only column: membership and actions sit under the name. */}
      <td className="py-3 px-4 max-sm:w-full max-sm:max-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <span aria-hidden className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border border-[#4ecde6]/[0.22] bg-[#4ecde6]/[0.10] text-xs font-semibold text-[#4ecde6]">
            {initialsOf(r.parentName)}
          </span>
          <div className="min-w-0">
            <Link href={`/dashboard/parents/${r.id}`} className="block truncate font-semibold text-white hover:text-[#4ecde6]">
              {r.parentName}
            </Link>
            {(r.parentEmail || r.parentPhone) && (
              <div className="text-xs text-[#93a2ba] truncate max-w-[280px]">
                {r.parentEmail}{r.parentEmail && r.parentPhone ? ' · ' : ''}{r.parentPhone}
              </div>
            )}
            {/* Phones hide the Children column, so the names sit under the parent there. */}
            {firstNames.length > 0 && (
              <div className="text-xs text-[#93a2ba] truncate sm:hidden">{firstNames.join(', ')}</div>
            )}
          </div>
        </div>
        <div className="mt-2.5 sm:hidden">
          {pills}
          {todos}
          <div className="mt-2">{actions}</div>
        </div>
      </td>
      <td className="py-3 px-4 hidden sm:table-cell text-white/90">
        {firstNames.length === 0
          ? <span className="text-[#5b6c86]">No children added</span>
          : <span className="block max-w-[220px] truncate" title={r.childrenNames.join(', ')}>{firstNames.join(', ')}</span>}
      </td>
      <td className="py-3 px-4 hidden md:table-cell font-semibold tabular-nums text-white">
        {r.familyValue > 0
          ? <>£{r.familyValue.toFixed(0)}<span className="text-xs font-normal text-[#93a2ba]">/mo</span></>
          : <span className="font-normal text-[#5b6c86]">—</span>}
      </td>
      <td className="py-3 px-4 hidden sm:table-cell">
        {pills}
        {todos}
      </td>
      {showMore && (
        <td className="py-3 px-4 hidden md:table-cell">
          {actionableBadges.length === 0 ? (
            <span className="text-[#5b6c86] text-xs">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {actionableBadges.slice(0, 3).map(b => (
                <span
                  key={b.key}
                  title={b.label}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${BADGE_TONE[b.tone] || BADGE_TONE.amber}`}
                >
                  {b.label.replace(/:\s.*/, '')}
                </span>
              ))}
              {actionableBadges.length > 3 && <span className="text-[10px] text-white/40">+{actionableBadges.length - 3}</span>}
            </div>
          )}
        </td>
      )}
      {/* Phase 2.5 — Last contact cell, now only under "More filters". */}
      {showMore && (
        <td className="py-3 px-4 hidden lg:table-cell">
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
      )}
      <td className="py-3 px-4 hidden sm:table-cell text-right">{actions}</td>
    </tr>
  )
}

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${PILL_TONE[tone]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

const ACTION_CLS = 'items-center justify-center w-7 h-7 rounded-md text-[12px] text-[#5b6c86] hover:bg-white/[0.08] hover:text-white transition-colors'

function RowActionLink({ href, title, children, className = 'inline-flex' }: { href: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} title={title} aria-label={title} className={`${className} ${ACTION_CLS}`}>
      {children}
    </Link>
  )
}

function RowActionAnchor({ href, title, children, external, className = 'inline-flex' }: { href: string; title: string; children: React.ReactNode; external?: boolean; className?: string }) {
  return (
    <a
      href={href}
      title={title}
      aria-label={title}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`${className} ${ACTION_CLS}`}
    >
      {children}
    </a>
  )
}
