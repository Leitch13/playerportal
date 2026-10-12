/**
 * Putting a list of children in order: by name, or by age.
 *
 * Academies coming from ClassForKids expect to sort a register by name or by
 * age and to narrow it to one age (asked for on the camp register, Oct 2026).
 * Pure, so every list that shows children can share it.
 */
export type RosterSort = 'booked' | 'name' | 'youngest' | 'oldest'

export const ROSTER_SORT_LABEL: Record<RosterSort, string> = { booked: 'Booked', name: 'A–Z', youngest: 'Youngest', oldest: 'Oldest' }

const byName = (a: string, b: string) => { const x = a.trim().toLowerCase(), y = b.trim().toLowerCase(); return x < y ? -1 : x > y ? 1 : 0 }

/** A new list in the chosen order. 'booked' keeps the order given. A child with no age goes last under either age order. */
export function sortRoster<T>(list: T[], sort: RosterSort, name: (t: T) => string | null | undefined, age: (t: T) => number | null | undefined): T[] {
  if (sort === 'booked') return [...list]
  const n = (t: T) => name(t) || ''
  if (sort === 'name') return [...list].sort((a, b) => byName(n(a), n(b)))
  return [...list].sort((a, b) => {
    const x = age(a), y = age(b)
    if (x == null && y == null) return byName(n(a), n(b))
    if (x == null) return 1
    if (y == null) return -1
    return (sort === 'youngest' ? x - y : y - x) || byName(n(a), n(b))
  })
}

/** The ages on a list, youngest first, with how many children are each age. */
export function agesPresent<T>(list: T[], age: (t: T) => number | null | undefined): { age: number; count: number }[] {
  const m = new Map<number, number>()
  for (const t of list) { const a = age(t); if (a != null) m.set(a, (m.get(a) || 0) + 1) }
  return [...m].sort((a, b) => a[0] - b[0]).map(([age, count]) => ({ age, count }))
}

/** 'all', or only the children of one age. */
export function onlyAge<T>(list: T[], want: number | 'all', age: (t: T) => number | null | undefined): T[] {
  return want === 'all' ? list : list.filter((t) => age(t) === want)
}
