'use client'

/**
 * Start-date picker for the subscribe flow.
 *
 * OPTION B (current state): renders today as the only selectable start
 * date because Stage 3 (future-start via SetupIntent + activation cron)
 * is not yet built. The picker still surfaces the next class session
 * for context and shows the cost preview that matches today's billing.
 *
 * When Stage 3 ships, restore the date input + "Next session" pill +
 * remove the "coming soon" notice. Most of the cost-preview logic
 * already handles both today and future cases.
 *
 * Purely presentational. Lifts state up — the parent form owns the date.
 */

import { useMemo } from 'react'
import { estimateProratedPence, firstOfNextMonthLabel } from '@/lib/billing/anchor'
import { isoDate, nextSessionDate } from '@/lib/billing/next-session'

interface Props {
  /** ISO date "YYYY-MM-DD". Empty string = no selection yet. */
  value: string
  onChange: (iso: string) => void
  /** From training_groups.day_of_week + time_slot. Used to compute default. */
  classDayOfWeek: string | null
  classTimeSlot: string | null
  classLabel: string
  /** Monthly plan amount in £ (pounds, not pence). */
  monthlyAmount: number
  /** Hex color from the academy's brand for highlight. */
  primaryColor: string
}

function formatLabel(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

export function StartDatePicker({
  value,
  onChange,
  classDayOfWeek,
  classTimeSlot,
  classLabel,
  monthlyAmount,
  primaryColor,
}: Props) {
  // Suppress unused-prop warnings: `value` is intentionally ignored in
  // Option B (parent always submits today via defaultStartIso); reinstated
  // when Stage 3 ships.
  void value

  const today = useMemo(() => new Date(), [])
  const todayIso = useMemo(() => isoDate(today), [today])

  // Informational only — surfaces when the parent's first class session
  // falls so they know what they're committing to. Not a selectable date.
  const nextClass = useMemo(
    () => nextSessionDate({ day_of_week: classDayOfWeek, time_slot: classTimeSlot }, today),
    [classDayOfWeek, classTimeSlot, today],
  )

  const startDate = useMemo(() => new Date(todayIso + 'T00:00:00Z'), [todayIso])
  const todayChargePence = estimateProratedPence(monthlyAmount, startDate)
  const anchorLabel = firstOfNextMonthLabel(startDate)

  return (
    <div>
      <label className="block text-xs text-white/50 mb-2">When does it start?</label>

      {/* "Start today" — sole selectable start date until Stage 3 ships.
          Surfaces the next class session as informational subtext so the
          parent knows exactly when their child's first session is. */}
      <button
        type="button"
        onClick={() => onChange(todayIso)}
        className="w-full text-left rounded-xl border-2 p-4 mb-3 bg-white/[0.04]"
        style={{ borderColor: `${primaryColor}60`, boxShadow: `0 0 20px ${primaryColor}10` }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-white text-sm">Start today</div>
            <div className="text-xs text-white/40 mt-0.5">
              {classLabel}
              {nextClass ? ` — first session ${formatLabel(isoDate(nextClass))}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-white">{formatLabel(todayIso)}</div>
          </div>
        </div>
      </button>

      {/* Notice — explains why no future-date selection is offered. */}
      <div className="rounded-xl p-3 mb-3 border border-white/[0.06] bg-white/[0.02]">
        <p className="text-[11px] text-white/50 leading-relaxed">
          Scheduling a future start date is coming soon. For now, your child starts today and can attend their next class session.
        </p>
      </div>

      {/* Cost preview — always shows the "start today" case since that's the
          only selectable option in Option B. Restore the future-date branch
          (kept in git history at commit a519b67) when Stage 3 ships. */}
      <div
        className="mt-3 rounded-xl p-3 text-sm"
        style={{
          backgroundColor: `${primaryColor}10`,
          borderColor: `${primaryColor}30`,
          borderWidth: 1,
          borderStyle: 'solid',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-white/70">You&apos;ll pay today</span>
          <span className="font-bold text-white">&pound;{(todayChargePence / 100).toFixed(2)}</span>
        </div>
        <div className="text-[11px] text-white/50 mt-0.5">
          Covers {formatLabel(todayIso)} &rarr; {anchorLabel}
        </div>
        <div className="border-t border-white/[0.08] my-2" />
        <div className="flex items-center justify-between">
          <span className="text-white/70">Then on {anchorLabel}</span>
          <span className="font-bold text-white">&pound;{monthlyAmount.toFixed(2)}</span>
        </div>
        <div className="text-[11px] text-white/50 mt-0.5">
          Full month, and every 1st after that
        </div>
      </div>
    </div>
  )
}
