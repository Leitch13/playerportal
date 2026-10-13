/**
 * Narrowing the Classes list by day, age group, venue and coach.
 *
 * Asked for by an academy used to ClassForKids (Oct 2026): with thirty classes the
 * list needs more than a search box. Pure, so the page and its tests agree.
 */
export interface FilterableClass {
  day_of_week?: string | null
  age_group?: string | null
  location?: string | null
  coachName?: string | null
}

export interface ClassFilters { day?: string; age?: string; venue?: string; coach?: string }

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const clean = (s: string | null | undefined) => (s || '').trim()
const same = (a: string | null | undefined, b: string | null | undefined) => clean(a).toLowerCase() === clean(b).toLowerCase()

/** "U9" before "U11" before "U14": by the first number in the label, then by name. */
function byAgeLabel(a: string, b: string): number {
  const n = (s: string) => { const m = /\d+/.exec(s); return m ? Number(m[0]) : Number.POSITIVE_INFINITY }
  return n(a) - n(b) || a.localeCompare(b)
}

/** The choices to offer, built from the classes themselves, each with how many classes it has. */
export function classFilterOptions(classes: FilterableClass[]) {
  const tally = (pick: (c: FilterableClass) => string | null | undefined) => {
    const m = new Map<string, { label: string; count: number }>()
    for (const c of classes) { const v = clean(pick(c)); if (!v) continue; const k = v.toLowerCase(); m.set(k, { label: m.get(k)?.label || v, count: (m.get(k)?.count || 0) + 1 }) }
    return [...m.values()]
  }
  return {
    days: tally((c) => c.day_of_week).sort((a, b) => DAY_ORDER.indexOf(a.label) - DAY_ORDER.indexOf(b.label)),
    ages: tally((c) => c.age_group).sort((a, b) => byAgeLabel(a.label, b.label)),
    venues: tally((c) => c.location).sort((a, b) => a.label.localeCompare(b.label)),
    coaches: tally((c) => c.coachName).sort((a, b) => a.label.localeCompare(b.label)),
  }
}

/** Does this class pass every filter that is set? An unset filter passes everything. */
export function matchesClassFilters(c: FilterableClass, f: ClassFilters): boolean {
  return (!clean(f.day) || same(c.day_of_week, f.day))
    && (!clean(f.age) || same(c.age_group, f.age))
    && (!clean(f.venue) || same(c.location, f.venue))
    && (!clean(f.coach) || same(c.coachName, f.coach))
}

export function activeFilterCount(f: ClassFilters): number {
  return [f.day, f.age, f.venue, f.coach].filter((v) => clean(v)).length
}
