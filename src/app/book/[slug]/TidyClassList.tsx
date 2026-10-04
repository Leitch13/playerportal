import Link from 'next/link'
import type { ProgrammeGroup, SlotChip } from './GroupedClassList'

/**
 * Tidy "every class" breakdown for the public booking page.
 *
 * No filters and nothing to choose first: every class the academy sells, under
 * its own class types, youngest first. Every class is the same shape (name and
 * age on the left, price on the right, its times underneath) and every time
 * sits in the same four columns: day and time, venue, places left, button. A
 * class sold at many times (1-2-1s) becomes a grid by day instead of a long
 * column.
 *
 * Strictly presentational, like GroupedClassList: it takes the same
 * ProgrammeGroup data, and every button links to the same
 * /book/[slug]/class/[id] page as before. No billing surface is touched.
 */

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TYPE_ORDER = ['Soccer Tots', 'Group', 'Small Group', 'Academy', 'Intensity', 'Accelerator', 'Elite', 'Goalkeeper', 'Girls Only', 'Girls', '2-1 Pair', '2-1', '1-2-1', 'Adults', 'Trial', 'Camp']
// Above this many times, rows would be a wall; show a grid by day instead.
const GRID_ABOVE = 6

// Same rule as GroupedClassList.ageRange. Copied, not imported: that file is a
// client component and its functions can't be called from a server component.
function ageRange(name: string, ageGroups: string[]): [number, number] | null {
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

// Black or white, whichever reads on the academy's colour (dark text on a
// mid-blue button was hard to read; on gold it's right).
function inkOn(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n) || full.length !== 6) return '#0a0a0a'
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return L > 0.36 ? '#0a0a0a' : '#ffffff'
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function priceParts(label: string | null): { amount: string; unit: string } | null {
  if (!label) return null
  if (label.endsWith('/mo')) return { amount: label.slice(0, -3), unit: 'a month' }
  if (label.endsWith('/session')) return { amount: label.slice(0, -8), unit: 'a session' }
  return { amount: label, unit: '' }
}

function placesText(s: SlotChip): { text: string; warn: boolean } {
  if (s.isFull) return { text: 'Full', warn: false }
  if (s.spotsLeft <= 3) return { text: `${s.spotsLeft} ${s.spotsLeft === 1 ? 'place' : 'places'} left`, warn: true }
  return { text: 'Spaces', warn: false }
}

export default function TidyClassList({
  groups,
  primaryColor,
  slug,
}: {
  groups: ProgrammeGroup[]
  primaryColor: string
  slug: string
}) {
  const types = [...new Set(groups.map((g) => g.typeLabel))].sort(
    (a, b) => (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99),
  )
  const sections = types.map((t) => ({
    type: t,
    items: groups
      .filter((g) => g.typeLabel === t)
      .map((g) => ({ g, lo: ageRange(g.name, g.ageGroups)?.[0] ?? 99 }))
      .sort((a, b) => a.lo - b.lo || a.g.name.localeCompare(b.g.name))
      .map((x) => x.g),
  }))

  // When every class carries the same term note (one term for the whole
  // academy), say it once above the list instead of on every card.
  const notes = [...new Set(groups.map((g) => g.term?.parent_message || ''))]
  const sharedNote = groups.length > 1 && notes.length === 1 && notes[0] ? notes[0] : null

  if (groups.length === 0) {
    return <p className="rounded-2xl border border-dashed border-[#2a2a2a] px-4 py-8 text-center text-sm text-gray-500">No classes on sale yet. Check back soon.</p>
  }

  return (
    <div className="space-y-8" data-testid="tidy-class-list">
      {sharedNote && <p className="-mt-2 text-sm text-gray-400" data-testid="tidy-term-note">{sharedNote}</p>}
      {sections.map((sec) => (
        <section key={sec.type}>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.09em] text-gray-500">{sec.type}</h3>
          <div className="space-y-2.5">
            {sec.items.map((g) => {
              const price = priceParts(g.priceLabel)
              const sub = [g.ageGroups.join(', '), g.term ? `${fmtDate(g.term.start_date)} to ${fmtDate(g.term.end_date)}` : ''].filter(Boolean).join(' · ')
              const venues = [...new Set(g.slots.map((s) => (s.location || '').split(',')[0].trim()).filter(Boolean))]
              return (
                <article key={g.key} className="overflow-hidden rounded-2xl border border-[#232323] bg-[#141414]" data-testid="tidy-class">
                  <header className="flex items-baseline justify-between gap-4 px-4 pb-3 pt-3.5 sm:px-5">
                    <div className="min-w-0">
                      <h4 className="text-base font-bold leading-snug text-white sm:text-[17px]">{g.name}</h4>
                      {sub && <p className="mt-0.5 text-[13px] text-gray-400">{sub}</p>}
                      {g.shortDesc && <p className="mt-1 line-clamp-2 text-[13px] text-gray-500">{g.shortDesc}</p>}
                      {!sharedNote && g.term?.parent_message && <p className="mt-1 text-[12px] text-gray-500">{g.term.parent_message}</p>}
                    </div>
                    {price && (
                      <p className="shrink-0 whitespace-nowrap text-base font-extrabold tabular-nums text-white sm:text-[17px]">
                        {price.amount}{price.unit && <span className="text-xs font-medium text-gray-400"> {price.unit}</span>}
                      </p>
                    )}
                  </header>

                  {g.slots.length > GRID_ABOVE ? (
                    <div className="space-y-2.5 border-t border-[#232323] px-4 pb-4 pt-3 sm:px-5">
                      {DAY_ORDER.filter((d) => g.slots.some((s) => s.day === d)).concat(g.slots.some((s) => !s.day || !DAY_ORDER.includes(s.day)) ? ['Other'] : []).map((d) => {
                        const daySlots = g.slots.filter((s) => (d === 'Other' ? !s.day || !DAY_ORDER.includes(s.day) : s.day === d))
                        return (
                          <div key={d} className="grid gap-x-3 gap-y-1.5 sm:grid-cols-[100px_1fr] sm:items-start">
                            <p className="text-sm font-semibold text-white sm:pt-2">{d}</p>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2">
                              {daySlots.map((s) => (
                                <Link
                                  key={s.id}
                                  href={`/book/${slug}/class/${s.id}`}
                                  title={`${g.name}, ${s.day ?? 'day to be confirmed'} ${s.time ?? ''}${s.location ? `, ${s.location}` : ''}`}
                                  className={`rounded-[10px] border px-2 py-1.5 text-center text-sm tabular-nums transition-colors ${
                                    s.isFull ? 'border-[#262626] font-semibold text-gray-500' : 'border-[#333] bg-[#1b1b1b] font-bold text-white hover:border-[color:var(--brand-primary)]'
                                  }`}
                                >
                                  {s.time ? s.time.split(/[-–]/)[0].trim() : 'Time TBC'}
                                  <span className="block text-[11px] font-medium text-gray-500">
                                    {s.isFull ? 'Full, wait list' : s.spotsLeft <= 3 ? `${s.spotsLeft} left` : 'Book'}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      {venues.length > 0 && <p className="pt-0.5 text-[12.5px] text-gray-500">{venues.length === 1 ? `At ${venues[0]}.` : `At ${venues.join(', ')}. Tap a time to see where.`}</p>}
                    </div>
                  ) : (
                    g.slots.map((s) => {
                      const p = placesText(s)
                      return (
                        <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 border-t border-[#232323] px-4 py-2.5 sm:grid-cols-[210px_1fr_auto_140px] sm:px-5">
                          <p className="whitespace-nowrap text-sm font-semibold text-white">
                            {s.day || 'Day to be confirmed'}
                            {s.time && <span className="ml-2 font-medium tabular-nums text-gray-400">{s.time}</span>}
                          </p>
                          <p className="col-start-1 row-start-2 min-w-0 truncate text-[13px] text-gray-400 sm:col-start-2 sm:row-start-1 sm:text-sm">{(s.location || '').split(',')[0]}</p>
                          <p className={`col-start-2 row-start-2 text-center text-[12.5px] font-semibold sm:col-start-3 sm:row-start-1 sm:text-right ${p.warn ? 'text-[#e2a84b]' : 'text-gray-500'}`}>{p.text}</p>
                          <Link
                            href={`/book/${slug}/class/${s.id}`}
                            className={`col-start-2 row-start-1 block min-w-[118px] rounded-[10px] border px-3 py-2 text-center text-[13.5px] transition-opacity hover:opacity-90 sm:col-start-4 ${
                              s.isFull ? 'border-[#333] font-semibold text-gray-400' : 'border-transparent font-bold'
                            }`}
                            style={s.isFull ? undefined : { backgroundColor: primaryColor, color: inkOn(primaryColor) }}
                          >
                            {s.isFull ? 'Join waiting list' : 'Book'}
                          </Link>
                        </div>
                      )
                    })
                  )}
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
