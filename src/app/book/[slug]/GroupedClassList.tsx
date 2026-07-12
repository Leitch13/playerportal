'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import TermInfo from '@/components/TermInfo'

/**
 * Grouped "Weekly Classes" view for busy academies.
 *
 * Academies like Gold & Gray publish 50+ bookable slots where many rows are
 * the same programme at different times (14 cards literally named "1-2-1").
 * One full-size card per slot made the booking page ~18 screens tall. This
 * view renders ONE card per (programme name, term) with the individual slots
 * as compact chips, plus a day filter — matching how parents actually choose:
 * programme first, then a time.
 *
 * Strictly presentational. Every chip links to the same /book/[slug]/class/[id]
 * page the old cards linked to; seat counts arrive pre-computed from the same
 * anon-safe RPC; no billing, trial-copy, or data-model surface is touched.
 * The server component only mounts this above GROUPED_VIEW_THRESHOLD classes —
 * small academies keep the original rich cards.
 */

export interface SlotChip {
  id: string
  day: string | null
  time: string | null
  location: string | null
  spotsLeft: number
  capacity: number
  isFull: boolean
}

export interface ProgrammeGroup {
  key: string
  name: string
  typeLabel: string
  typeColor: string
  ageGroups: string[]
  priceLabel: string | null
  shortDesc: string | null
  isFeatured: boolean
  term: { name: string; start_date: string; end_date: string; parent_message: string | null } | null
  slots: SlotChip[]
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function shortDay(day: string | null): string {
  return day ? day.slice(0, 3) : 'TBA'
}

function shortLocation(loc: string | null): string | null {
  if (!loc) return null
  return loc.split(',')[0].trim()
}

export default function GroupedClassList({
  groups,
  primaryColor,
  slug,
}: {
  groups: ProgrammeGroup[]
  primaryColor: string
  slug: string
}) {
  const [activeDay, setActiveDay] = useState<string>('All')

  const daysPresent = useMemo(() => {
    const set = new Set<string>()
    for (const g of groups) for (const s of g.slots) if (s.day) set.add(s.day)
    return DAY_ORDER.filter((d) => set.has(d))
  }, [groups])

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      visibleSlots: activeDay === 'All' ? g.slots : g.slots.filter((s) => s.day === activeDay),
    }))
    .filter((g) => g.visibleSlots.length > 0)

  return (
    <div>
      {/* Day filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 sm:mb-6 sm:justify-center" role="tablist" aria-label="Filter classes by day">
        {['All', ...daysPresent].map((d) => {
          const active = activeDay === d
          return (
            <button
              key={d}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveDay(d)}
              className="shrink-0 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all"
              style={
                active
                  ? { backgroundColor: primaryColor, color: '#0a0a0a', borderColor: primaryColor }
                  : { backgroundColor: '#141414', color: '#9ca3af', borderColor: '#2a2a2a' }
              }
            >
              {d === 'All' ? 'All days' : shortDay(d)}
            </button>
          )
        })}
      </div>

      {visibleGroups.length === 0 && (
        <p className="text-center text-sm text-gray-500 py-8">No classes on {activeDay} — try another day.</p>
      )}

      <div className="space-y-4">
        {visibleGroups.map((g) => (
          <div
            key={g.key}
            className={`rounded-2xl border bg-[#141414] p-4 sm:p-5 transition-all ${g.isFeatured ? 'border-2' : 'border-[#1e1e1e]'}`}
            style={g.isFeatured ? { borderColor: `${primaryColor}60` } : undefined}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                  style={{ color: g.typeColor, borderColor: `${g.typeColor}50`, backgroundColor: `${g.typeColor}15` }}
                >
                  {g.typeLabel}
                </span>
                <h3 className="font-bold text-base sm:text-lg text-white leading-tight">{g.name}</h3>
                {g.ageGroups.map((a) => (
                  <span key={a} className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/70">{a}</span>
                ))}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.06] text-white/50">
                  {g.slots.length} weekly {g.slots.length === 1 ? 'slot' : 'slots'}
                </span>
              </div>
              {g.priceLabel && (
                <span className="shrink-0 text-base sm:text-lg font-extrabold text-white whitespace-nowrap">{g.priceLabel}</span>
              )}
            </div>

            {g.shortDesc && <p className="text-xs text-gray-400 mb-2 line-clamp-2">{g.shortDesc}</p>}

            {g.term && (
              <div className="mb-3 mt-2">
                <TermInfo
                  name={g.term.name}
                  start_date={g.term.start_date}
                  end_date={g.term.end_date}
                  parent_message={g.term.parent_message}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {g.visibleSlots.map((s) => (
                <Link
                  key={s.id}
                  href={`/book/${slug}/class/${s.id}`}
                  className="group inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm transition-all hover:-translate-y-0.5"
                  style={
                    s.isFull
                      ? { backgroundColor: '#151515', borderColor: '#242424', color: '#6b7280' }
                      : { backgroundColor: '#1b1b1b', borderColor: '#2e2e2e', color: '#e5e7eb' }
                  }
                  title={
                    s.isFull
                      ? `${g.name} — ${s.day ?? 'TBA'} ${s.time ?? ''} — full, join the waitlist`
                      : `${g.name} — ${s.day ?? 'TBA'} ${s.time ?? ''} — ${s.spotsLeft} of ${s.capacity} spots left`
                  }
                >
                  <span className="font-bold text-white group-hover:underline" style={s.isFull ? { color: '#9ca3af' } : undefined}>
                    {shortDay(s.day)}
                  </span>
                  {s.time && <span>{s.time}</span>}
                  {shortLocation(s.location) && (
                    <span className="text-gray-500 hidden sm:inline">· {shortLocation(s.location)}</span>
                  )}
                  {s.isFull ? (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400">Waitlist</span>
                  ) : s.spotsLeft <= 3 ? (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400">{s.spotsLeft} left</span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
