import Link from 'next/link'
import type { NeedsAttention } from '@/lib/needs-attention'

/**
 * The academy's own money problems, on the academy's own dashboard.
 *
 * Deliberately quiet when there is nothing wrong — a panel that always shows
 * something becomes wallpaper, which is exactly how a daily alert listing 27
 * unbilled children went unread for fifteen days.
 *
 * Leads with the £ figure, oldest first, and every group says what to DO.
 */
export default function NeedsAttentionPanel({ state }: { state: NeedsAttention }) {
  if (!state.totalItems) return null

  const money = state.totalMonthly > 0
    ? `£${state.totalMonthly.toLocaleString('en-GB', { maximumFractionDigits: 0 })}/mo`
    : null

  return (
    <section
      aria-labelledby="needs-attention-heading"
      className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-5 mb-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 id="needs-attention-heading" className="text-sm font-semibold text-amber-300">
          Needs your attention
        </h2>
        {money && (
          <span className="text-xs font-semibold text-amber-200/80 tabular-nums">
            {money} not being collected
          </span>
        )}
      </div>
      <p className="text-xs text-white/45 mb-4">
        {state.totalItems} {state.totalItems === 1 ? 'thing' : 'things'} worth a look. Nothing here stops your classes running.
      </p>

      <div className="space-y-4">
        {state.groups.map((g) => (
          <div key={g.kind}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-white/85">
                {g.title}
                <span className="ml-1.5 text-white/40 font-normal tabular-nums">{g.total}</span>
              </h3>
              {g.amount > 0 && (
                <span className="text-[12px] text-white/50 tabular-nums shrink-0">
                  £{g.amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}/mo
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-white/40 mt-0.5 mb-1.5">{g.action}</p>
            <ul className="space-y-0.5">
              {g.items.slice(0, 6).map((item, i) => (
                <li key={`${g.kind}-${i}`} className="flex items-baseline gap-2 text-[12.5px]">
                  {item.ageDays !== undefined && (
                    <span
                      className={`shrink-0 tabular-nums text-[11px] ${
                        item.ageDays >= 21 ? 'text-amber-400 font-semibold' : 'text-white/35'
                      }`}
                    >
                      {item.ageDays}d
                    </span>
                  )}
                  {item.href ? (
                    <Link href={item.href} className="text-[#4ecde6] hover:underline truncate">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-white/75 truncate">{item.label}</span>
                  )}
                  {item.amount ? (
                    <span className="text-white/35 tabular-nums shrink-0 ml-auto">£{item.amount}</span>
                  ) : null}
                </li>
              ))}
              {g.items.length > 6 && (
                <li className="text-[11.5px] text-white/35 pt-0.5">
                  and {g.items.length - 6} more
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
