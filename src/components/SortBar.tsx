'use client'

import { ROSTER_SORT_LABEL, type RosterSort } from '@/lib/roster-sort'

/** Order a list of children by name or age, and narrow it to one age. Used above the bookings table and the day register. */
export default function SortBar({ sort, onSort, ages, age, onAge, options, testid }: {
  sort: RosterSort; onSort: (s: RosterSort) => void
  ages: { age: number; count: number }[]; age: number | 'all'; onAge: (a: number | 'all') => void
  options: RosterSort[]; testid: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={testid}>
      <div className="inline-flex overflow-hidden rounded-lg border border-[#1d2c42] bg-[#080e18] text-xs" role="group" aria-label="Sort by">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onSort(o)} aria-pressed={sort === o} data-sort={o}
            className={`px-2.5 py-1.5 font-semibold transition-colors ${sort === o ? 'bg-[#4ecde6]/[0.14] text-[#4ecde6]' : 'text-white/55 hover:text-white'}`}>
            {ROSTER_SORT_LABEL[o]}
          </button>
        ))}
      </div>
      {ages.length > 1 && (
        <select value={String(age)} onChange={(e) => onAge(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="Show one age" data-testid={`${testid}-age`}
          className="rounded-lg border border-[#1d2c42] bg-[#080e18] px-2 py-1.5 text-xs text-white/80 focus:border-[#4ecde6]/50 focus:outline-none">
          <option value="all">All ages</option>
          {ages.map((a) => <option key={a.age} value={a.age}>Age {a.age} ({a.count})</option>)}
        </select>
      )}
    </div>
  )
}
