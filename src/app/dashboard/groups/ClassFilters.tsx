'use client'

/**
 * Day, age group, venue and coach filters for the Classes list.
 * Each choice goes in the page's address (?day=Tuesday&venue=…), so a filtered
 * list survives a refresh and can be shared. See src/lib/class-filters.ts.
 */
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type Option = { label: string; count: number }

export default function ClassFilters({ days, ages, venues, coaches, current, shown, total }: {
  days: Option[]; ages: Option[]; venues: Option[]; coaches: Option[]
  current: { day: string; age: string; venue: string; coach: string }
  shown: number; total: number
}) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams()
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value); else next.delete(key)
    router.push(next.toString() ? `${pathname}?${next}` : pathname)
  }
  const clear = () => {
    const next = new URLSearchParams(params.toString())
    for (const k of ['day', 'age', 'venue', 'coach']) next.delete(k)
    router.push(next.toString() ? `${pathname}?${next}` : pathname)
  }
  const on = [current.day, current.age, current.venue, current.coach].filter(Boolean).length
  const select = (key: 'day' | 'age' | 'venue' | 'coach', all: string, options: Option[]) => options.length > 1 || current[key] ? (
    <select
      value={current[key]}
      onChange={(e) => set(key, e.target.value)}
      aria-label={all}
      data-testid={`class-filter-${key}`}
      className={`min-w-0 rounded-xl border bg-[#0f1a2b] px-3 py-2 text-xs font-semibold outline-none transition-colors focus:border-[#4ecde6]/50 ${current[key] ? 'border-[#4ecde6]/60 text-white' : 'border-[#1d2c42] text-white/70'}`}
    >
      <option value="">{all}</option>
      {options.map((o) => <option key={o.label} value={o.label}>{o.label} ({o.count})</option>)}
    </select>
  ) : null
  const any = select('day', 'Any day', days) || select('age', 'Any age group', ages) || select('venue', 'Any venue', venues) || select('coach', 'Any coach', coaches)
  if (!any) return null
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="class-filters">
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
        {select('day', 'Any day', days)}
        {select('age', 'Any age group', ages)}
        {select('venue', 'Any venue', venues)}
        {select('coach', 'Any coach', coaches)}
      </div>
      {on > 0 && (
        <p className="text-xs text-white/50" data-testid="class-filters-summary">
          Showing <span className="font-semibold text-white/85">{shown}</span> of {total}{' '}
          <button type="button" onClick={clear} className="ml-1 font-semibold text-[#4ecde6] hover:underline" data-testid="class-filters-clear">Clear filters</button>
        </p>
      )}
    </div>
  )
}
