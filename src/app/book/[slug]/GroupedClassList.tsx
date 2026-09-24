'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

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

// Programme sections in the order a parent scans them: youngest first, then
// group sessions, then the specialist and premium options.
const TYPE_ORDER = ['Soccer Tots', 'Group', 'Small Group', 'Academy', 'Intensity', 'Accelerator', 'Elite', 'Goalkeeper', 'Girls', '2-1', '1-2-1', 'Adults', 'Trial', 'Camp']

// Age bands a parent picks from. Programmes are matched by overlap with the
// age range parsed from their name ("(7-9 yrs)", "18mths - 3yrs") or age group
// ("U10"). A programme with no age information is shown under every band.
const AGE_BANDS: { label: string; lo: number; hi: number }[] = [
  { label: 'Under 5', lo: 0, hi: 4 },
  { label: '5–7', lo: 5, hi: 7 },
  { label: '8–10', lo: 8, hi: 10 },
  { label: '11–13', lo: 11, hi: 13 },
  { label: '14+', lo: 14, hi: 99 },
]

export function ageRange(name: string, ageGroups: string[]): [number, number] | null {
  const n = name.toLowerCase()
  // Birth years ("2015 - 2017", "2018 & 2019s") → ages this year.
  const now = new Date().getUTCFullYear()
  const years = [...n.matchAll(/\b(20[0-2]\d)s?\b/g)].map((m) => Number(m[1])).filter((y) => y > now - 19 && y <= now)
  if (years.length) return [now - Math.max(...years) - 1, now - Math.min(...years)]
  const months = n.match(/(\d+)\s*(?:m|mths|months)\s*[-–to]+\s*(\d+)\s*(?:y|yrs|years)/)
  if (months) return [0, Number(months[2])]
  const range = n.match(/(\d{1,2})\s*(?:yrs?|years)?\s*[-–]\s*(\d{1,2})\s*(?:yrs?|years|\))/)
  if (range) { const a = Number(range[1]), b = Number(range[2]); if (a <= b && b <= 18) return [a, b] }
  const plus = n.match(/(\d{1,2})\s*\+/)
  if (plus) return [Number(plus[1]), 99]
  const us = ageGroups.map((g) => g.match(/^u\s*(\d{1,2})$/i)).filter(Boolean).map((m) => Number(m![1]))
  if (us.length) return [Math.max(0, Math.min(...us) - 3), Math.max(...us) - 1]
  return null
}

function shortDay(day: string | null): string {
  return day ? day.slice(0, 3) : 'TBA'
}

function shortLocation(loc: string | null): string | null {
  if (!loc) return null
  return loc.split(',')[0].trim()
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function Chip({ active, onClick, children, primaryColor }: { active: boolean; onClick: () => void; children: React.ReactNode; primaryColor: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="shrink-0 px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold border transition-colors whitespace-nowrap"
      style={active ? { backgroundColor: primaryColor, color: '#0a0a0a', borderColor: primaryColor } : { backgroundColor: '#141414', color: '#b5b8bd', borderColor: '#2a2a2a' }}
    >
      {children}
    </button>
  )
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
  const [day, setDay] = useState<string>('All')
  const [age, setAge] = useState<string>('All')
  const [venue, setVenue] = useState<string>('All')
  const [type, setType] = useState<string>('All')

  const withAge = useMemo(() => groups.map((g) => ({ ...g, range: ageRange(g.name, g.ageGroups) })), [groups])

  const daysPresent = useMemo(() => {
    const set = new Set<string>()
    for (const g of groups) for (const s of g.slots) if (s.day) set.add(s.day)
    return DAY_ORDER.filter((d) => set.has(d))
  }, [groups])
  const venuesPresent = useMemo(() => {
    const set = new Set<string>()
    for (const g of groups) for (const s of g.slots) { const v = shortLocation(s.location); if (v) set.add(v) }
    return [...set].sort()
  }, [groups])
  const typesPresent = useMemo(() => {
    const set = new Set(groups.map((g) => g.typeLabel))
    return [...set].sort((a, b) => (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99))
  }, [groups])
  const agesPresent = useMemo(
    () => AGE_BANDS.filter((b) => withAge.some((g) => g.range && g.range[0] <= b.hi && g.range[1] >= b.lo)),
    [withAge],
  )

  const band = AGE_BANDS.find((b) => b.label === age)
  const visible = withAge
    .filter((g) => type === 'All' || g.typeLabel === type)
    .filter((g) => !band || !g.range || (g.range[0] <= band.hi && g.range[1] >= band.lo))
    .map((g) => ({
      ...g,
      visibleSlots: g.slots.filter((s) => (day === 'All' || s.day === day) && (venue === 'All' || shortLocation(s.location) === venue)),
    }))
    .filter((g) => g.visibleSlots.length > 0)

  // Sections by programme type; inside a section, youngest first.
  const sections = typesPresent
    .map((t) => ({
      type: t,
      color: groups.find((g) => g.typeLabel === t)?.typeColor || primaryColor,
      items: visible
        .filter((g) => g.typeLabel === t)
        .sort((a, b) => (a.isFeatured !== b.isFeatured ? (a.isFeatured ? -1 : 1) : (a.range?.[0] ?? 99) - (b.range?.[0] ?? 99) || a.name.localeCompare(b.name))),
    }))
    .filter((s) => s.items.length > 0)

  const filtering = day !== 'All' || age !== 'All' || venue !== 'All' || type !== 'All'
  const totalSlots = groups.reduce((n, g) => n + g.slots.length, 0)
  const shownSlots = visible.reduce((n, g) => n + g.visibleSlots.length, 0)

  const row = (label: string, items: string[], value: string, set: (v: string) => void, fmt: (v: string) => string = (v) => v) =>
    items.length > 1 && (
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 w-14 text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1 [scrollbar-width:none]">
          <Chip active={value === 'All'} onClick={() => set('All')} primaryColor={primaryColor}>All</Chip>
          {items.map((v) => <Chip key={v} active={value === v} onClick={() => set(v)} primaryColor={primaryColor}>{fmt(v)}</Chip>)}
        </div>
      </div>
    )

  return (
    <div>
      {/* Filters — sticky so a parent can refine without scrolling back up */}
      <div className="sticky z-10 -mx-4 px-4 sm:mx-0 sm:px-4 py-3 mb-5 rounded-none sm:rounded-2xl border-y sm:border border-[#1e1e1e] bg-[#0b0b0b]/95 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="grid gap-2">
          {row('Age', agesPresent.map((b) => b.label), age, setAge)}
          {row('Day', daysPresent, day, setDay, shortDay)}
          {row('Venue', venuesPresent, venue, setVenue)}
          {row('Type', typesPresent, type, setType)}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
          <span>{filtering ? `${shownSlots} of ${totalSlots} sessions` : `${totalSlots} weekly sessions across ${groups.length} programmes`}</span>
          {filtering && (
            <button type="button" className="font-semibold underline underline-offset-2" style={{ color: primaryColor }} onClick={() => { setDay('All'); setAge('All'); setVenue('All'); setType('All') }}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {sections.length === 0 && (
        <p className="text-center text-sm text-gray-500 py-8">Nothing matches those filters — try clearing one.</p>
      )}

      <div className="space-y-9">
        {sections.map((sec) => (
          <div key={sec.type}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sec.color }} />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">{sec.type}</h3>
              <span className="text-xs text-gray-500">{sec.items.length}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              {sec.items.map((g) => (
                <div
                  key={g.key}
                  className="rounded-2xl border bg-[#141414] p-4 flex flex-col gap-3 min-w-0 overflow-hidden"
                  style={{ borderColor: g.isFeatured ? `${primaryColor}70` : '#1f1f1f' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-[15px] sm:text-base text-white leading-snug">{g.name}</h4>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {g.ageGroups.map((a) => (
                          <span key={a} className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-white/10 text-white/70">{a}</span>
                        ))}
                        {g.term && (
                          <span className="text-[11px] text-gray-500">{fmtDate(g.term.start_date)} – {fmtDate(g.term.end_date)}</span>
                        )}
                      </div>
                    </div>
                    {g.priceLabel && <span className="shrink-0 text-[15px] sm:text-base font-extrabold text-white whitespace-nowrap">{g.priceLabel}</span>}
                  </div>
                  {g.shortDesc && <p className="text-xs text-gray-400 line-clamp-1" title={g.shortDesc}>{g.shortDesc}</p>}
                  {g.term?.parent_message && <p className="text-[11px] text-gray-500 -mt-1">{g.term.parent_message}</p>}
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {g.visibleSlots.map((s) => (
                      <Link
                        key={s.id}
                        href={`/book/${slug}/class/${s.id}`}
                        className="group inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-[13px] transition-colors whitespace-nowrap max-w-full"
                        style={s.isFull ? { backgroundColor: '#151515', borderColor: '#242424', color: '#6b7280' } : { backgroundColor: '#1b1b1b', borderColor: '#2e2e2e', color: '#e5e7eb' }}
                        title={s.isFull ? `${g.name} — ${s.day ?? 'TBA'} ${s.time ?? ''} — full, join the waitlist` : `${g.name} — ${s.day ?? 'TBA'} ${s.time ?? ''} — ${s.spotsLeft} of ${s.capacity} spots left`}
                      >
                        <span className="font-bold text-white group-hover:underline" style={s.isFull ? { color: '#9ca3af' } : undefined}>{shortDay(s.day)}</span>
                        {s.time && <span>{s.time}</span>}
                        {shortLocation(s.location) && venue === 'All' && <span className="text-gray-500 truncate min-w-0">· {shortLocation(s.location)}</span>}
                        {s.isFull ? (
                          <span className="ml-1 shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400">Waitlist</span>
                        ) : s.spotsLeft <= 3 ? (
                          <span className="ml-1 shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400">{s.spotsLeft} left</span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
