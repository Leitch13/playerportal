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

/** "Mini Ballers (18mths - 3yrs)" → ["Mini Ballers", "18mths - 3yrs"]: the age goes on its own line. */
function splitName(name: string): [string, string | null] {
  const m = name.match(/^(.*?)\s*[(（]([^)）]*\d[^)）]*)[)）]\s*$/)
  return m && m[1].trim().length >= 3 ? [m[1].trim(), m[2].trim()] : [name, null]
}

function sectionAges(ranges: ([number, number] | null)[]): string | null {
  const r = ranges.filter((x): x is [number, number] => !!x)
  if (!r.length) return null
  const lo = Math.min(...r.map((x) => x[0])), hi = Math.max(...r.map((x) => x[1]))
  if (hi >= 99) return `${lo}+ years`
  if (lo <= 0) return `Up to ${hi} years`
  return lo === hi ? `${lo} years` : `${lo}–${hi} years`
}

function Select({ label, value, onChange, options, all }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; t: string }[]; all: string }) {
  return (
    <label className="relative flex items-center gap-2 rounded-xl border border-[#2e2e2e] bg-[#141414] pl-3 pr-8 py-2 text-[13.5px] text-gray-200 focus-within:border-[#4a4a4a]">
      <span className="text-gray-500 text-xs">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none bg-transparent outline-none text-gray-100 pr-1 cursor-pointer">
        <option value="All" className="bg-[#141414]">{all}</option>
        {options.map((o) => <option key={o.v} value={o.v} className="bg-[#141414]">{o.t}</option>)}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-3 text-[10px] text-gray-500">▼</span>
    </label>
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

  const clear = () => { setDay('All'); setAge('All'); setVenue('All'); setType('All') }

  return (
    <div>
      {/* Filters: dropdowns, so a busy academy's filters stay one tidy line (were four rows of pills). */}
      <div className="flex flex-wrap items-center gap-2.5 pb-5 mb-7 border-b border-[#262626]">
        {agesPresent.length > 1 && <Select label="Age" value={age} onChange={setAge} all="All ages" options={agesPresent.map((b) => ({ v: b.label, t: b.label === 'Under 5' ? 'Under 5' : `${b.label} years` }))} />}
        {daysPresent.length > 1 && <Select label="Day" value={day} onChange={setDay} all="Any day" options={daysPresent.map((d) => ({ v: d, t: d }))} />}
        {venuesPresent.length > 1 && <Select label="Venue" value={venue} onChange={setVenue} all="All venues" options={venuesPresent.map((v) => ({ v, t: v }))} />}
        {typesPresent.length > 1 && <Select label="Type" value={type} onChange={setType} all="All classes" options={typesPresent.map((t) => ({ v: t, t }))} />}
        <span className="ml-auto text-[13px] text-gray-500">
          {filtering ? <>{shownSlots} of {totalSlots} classes · <button type="button" className="font-semibold underline underline-offset-2" style={{ color: primaryColor }} onClick={clear}>Clear</button></> : `${totalSlots} classes a week`}
        </span>
      </div>

      {sections.length === 0 && (
        <p className="text-center text-sm text-gray-500 py-8">Nothing matches those filters. <button type="button" className="underline" onClick={clear}>Clear them</button></p>
      )}

      <div className="space-y-10 sm:space-y-12">
        {sections.map((sec) => {
          const ages = sectionAges(sec.items.map((g) => g.range))
          const n = sec.items.reduce((a, g) => a + g.visibleSlots.length, 0)
          return (
            <section key={sec.type}>
              <div className="flex items-baseline gap-3 mb-3.5">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{sec.type}</h3>
                {ages && <span className="text-sm font-medium" style={{ color: primaryColor }}>{ages}</span>}
                <span className="ml-auto text-[13px] text-gray-500">{n} {n === 1 ? 'class' : 'classes'}</span>
              </div>
              <div className="rounded-2xl border border-[#262626] bg-[#111] overflow-hidden divide-y divide-[#222]">
                {sec.items.map((g) => {
                  const [title, ageText] = splitName(g.name)
                  const ageLine = ageText || g.ageGroups.join(', ') || null
                  return (
                    <div key={g.key} className="grid gap-3 px-4 sm:px-5 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,2.7fr)] sm:items-center">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-[15px] text-white leading-snug">{title}</h4>
                        {ageLine && <p className="text-[13px] text-gray-400 mt-0.5">{ageLine}</p>}
                        {g.term?.parent_message && <p className="text-xs text-gray-500 mt-1">{g.term.parent_message}</p>}
                      </div>
                      <div className="space-y-2 min-w-0">
                        {g.visibleSlots.map((s, i) => (
                          <div key={s.id} className="flex items-center gap-3 min-w-0">
                            <p className="flex-1 min-w-0 text-[13.5px] text-gray-100">
                              <span className="font-medium">{shortDay(s.day)} {s.time}</span>
                              {shortLocation(s.location) && <span className="text-gray-400"> · {shortLocation(s.location)}</span>}
                              {s.isFull ? (
                                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 whitespace-nowrap">Full</span>
                              ) : s.spotsLeft <= 3 ? (
                                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 whitespace-nowrap">{s.spotsLeft} left</span>
                              ) : null}
                            </p>
                            <span className={`shrink-0 w-[4.5rem] text-right text-[15px] font-semibold text-white ${i > 0 ? 'invisible' : ''}`}>
                              {g.priceLabel ? <>{g.priceLabel.replace(/\/(mo|session)$/, '')}<span className="text-xs font-medium text-gray-400">/{g.priceLabel.endsWith('/session') ? 'session' : 'mo'}</span></> : null}
                            </span>
                            <Link
                              href={`/book/${slug}/class/${s.id}`}
                              className="shrink-0 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-opacity hover:opacity-90"
                              style={s.isFull ? { backgroundColor: '#1f1f1f', color: '#d1d5db' } : { backgroundColor: primaryColor, color: textOn(primaryColor) }}
                              title={s.isFull ? `${g.name}, ${s.day ?? 'TBA'} ${s.time ?? ''}: full, join the waiting list` : `${g.name}, ${s.day ?? 'TBA'} ${s.time ?? ''}: ${s.spotsLeft} of ${s.capacity} places left`}
                            >
                              {s.isFull ? 'Waitlist' : 'Book'}
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** Dark text on a light brand colour, white on a dark one. */
function textOn(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(n)) return '#0a0a0a'
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6 ? '#0a0a0a' : '#ffffff'
}
