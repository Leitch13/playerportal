'use client'

import { useState } from 'react'

/**
 * One group on 1-2-1s → Needs you: a plain-English summary, any group action
 * (e.g. Resend all), then the rows — the first few shown, the rest behind
 * "Show all". John, 17 Oct 2026: the list "looks overload".
 */
export function NeedsGroup({ title, sub, actions, rows, show = 4, testId }: {
  title: string; sub?: string; actions?: React.ReactNode; rows: React.ReactNode[]; show?: number; testId?: string
}) {
  const [all, setAll] = useState(false)
  const visible = all ? rows : rows.slice(0, show)
  return (
    <div className="border-b border-[#1d2c42] px-5 py-4 last:border-0" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          {sub && <p className="mt-0.5 text-[13px] text-[#93a2ba]">{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      <ul className="mt-3 divide-y divide-[#1d2c42] rounded-xl border border-[#1d2c42] bg-[#080e18]/40">
        {visible.map((r, i) => <li key={i} className="px-4 py-3">{r}</li>)}
      </ul>
      {rows.length > show && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2.5 text-[13px] font-semibold text-[#4ecde6] hover:text-[#7fe0f0]" data-testid="needs-show-all">
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}
