import { formatTermDateRange } from '@/lib/term'

/**
 * Shared term display block — Phase 1B parent surfaces.
 *
 * Lightweight by design: name, date range, optional parent_message.
 * No countdowns, progress bars, urgency colours, or state variants.
 *
 *   variant="block" — used on public booking page + class detail.
 *   variant="inline" — used on parent dashboard + Membership Hub.
 *
 * Renders nothing when given no data. Callers can therefore unconditionally
 * mount <TermInfo {...class.term} /> and the component self-disables when
 * the class has no term assigned.
 */
export interface TermInfoProps {
  name?: string | null
  start_date?: string | null
  end_date?: string | null
  parent_message?: string | null
  variant?: 'block' | 'inline'
}

export default function TermInfo({
  name,
  start_date,
  end_date,
  parent_message,
  variant = 'block',
}: TermInfoProps) {
  if (!name || !start_date || !end_date) return null

  const dateRange = formatTermDateRange(start_date, end_date)

  if (variant === 'inline') {
    return (
      <p className="text-xs text-white/55">
        <span className="font-medium text-white/75">{name}</span>
        <span className="mx-1.5 text-white/30">·</span>
        {dateRange}
      </p>
    )
  }

  return (
    <div
      className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4 sm:p-5"
      data-testid="term-info-block"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-sm sm:text-base font-semibold text-white">{name}</h3>
        <p className="text-xs sm:text-sm text-white/70">{dateRange}</p>
      </div>
      {parent_message && parent_message.trim().length > 0 && (
        <p className="text-sm text-white/75 mt-3 whitespace-pre-wrap leading-relaxed">
          {parent_message}
        </p>
      )}
    </div>
  )
}
