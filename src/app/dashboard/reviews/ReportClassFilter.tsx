'use client'

/** The class dropdown on Player Reports. The choice lives in the address (?class=…). See src/lib/report-class-filter.ts. */
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function ReportClassFilter({ classes, current }: { classes: { id: string; label: string; count: number }[]; current: string }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams()
  const pick = (id: string) => {
    const next = new URLSearchParams(params.toString())
    if (id) next.set('class', id); else next.delete('class')
    next.delete('add')
    router.push(next.toString() ? `${pathname}?${next}` : pathname)
  }
  if (classes.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="report-class-filter">
      <select value={current} onChange={(e) => pick(e.target.value)} aria-label="Show reports for a class" data-testid="report-class-select"
        className={`w-full min-w-0 rounded-xl border bg-[#0f1a2b] px-3 py-2.5 text-sm font-semibold outline-none transition-colors focus:border-[#4ecde6]/50 sm:w-auto sm:min-w-[16rem] ${current ? 'border-[#4ecde6]/60 text-white' : 'border-[#1d2c42] text-white/70'}`}>
        <option value="">All classes</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.count})</option>)}
      </select>
      {current && <button type="button" onClick={() => pick('')} className="text-xs font-semibold text-[#4ecde6] hover:underline" data-testid="report-class-clear">Show all classes</button>}
    </div>
  )
}
