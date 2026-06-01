'use client'

/**
 * Start-date picker for the subscribe flow.
 *
 * - Renders a single section in the booking funnel between "Choose Plan" and "Confirm & Pay"
 * - Default selection = the class's next upcoming session
 * - Parent can pick a different date (today through +28 days)
 * - Shows a tiny cost-preview ("You'll pay £X today, then £Y on 1 Jul")
 *
 * Purely presentational. Lifts state up — the parent form owns the date.
 */

import { useMemo } from 'react'
import {
  estimateProratedPence,
  firstOfNextMonthLabel,
  isStartInCurrentMonth,
  isStartTodayOrEarlier,
} from '@/lib/billing/anchor'
import { isoDate, latestAllowedStartDate, nextSessionDate } from '@/lib/billing/next-session'

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
  const today = useMemo(() => new Date(), [])
  const todayIso = useMemo(() => isoDate(today), [today])
  const latestIso = useMemo(() => isoDate(latestAllowedStartDate(today)), [today])

  // Suggested default: next session of THIS class. Fall back to today if
  // we can't compute it (no day_of_week, etc.).
  const suggested = useMemo(() => {
    const next = nextSessionDate({ day_of_week: classDayOfWeek, time_slot: classTimeSlot }, today)
    return next ? isoDate(next) : todayIso
  }, [classDayOfWeek, classTimeSlot, today, todayIso])

  // If the field is empty, default to the suggested session
  const effective = value || suggested

  const startDate = useMemo(() => new Date(effective + 'T00:00:00Z'), [effective])

  // Compute the "you'll pay" preview. Three cases:
  //   1. start today/earlier + this month → prorated charge now
  //   2. start in future month, on the 1st → full month charged on start_date
  //   3. start in future, mid-next-month → £0 today, prorated charge on start_date
  const isToday = isStartTodayOrEarlier(startDate, today)
  const isThisMonth = isStartInCurrentMonth(startDate, today)
  const proratedPenceFromStart = estimateProratedPence(monthlyAmount, startDate)
  const todayChargePence = isToday && isThisMonth ? proratedPenceFromStart : 0

  const anchorLabel = firstOfNextMonthLabel(startDate)

  const isSuggested = effective === suggested

  return (
    <div>
      <label className="block text-xs text-white/50 mb-2">
        When does it start? <span className="text-white/30">(you can change this)</span>
      </label>

      {/* Suggested "Next session" pill */}
      <button
        type="button"
        onClick={() => onChange(suggested)}
        className={`w-full text-left rounded-xl border-2 p-4 mb-2 transition-all ${
          isSuggested ? 'bg-white/[0.04]' : 'border-white/[0.06] hover:border-white/[0.12]'
        }`}
        style={
          isSuggested
            ? { borderColor: `${primaryColor}60`, boxShadow: `0 0 20px ${primaryColor}10` }
            : undefined
        }
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-white text-sm">Next session</div>
            <div className="text-xs text-white/40 mt-0.5">{classLabel}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-white">{formatLabel(suggested)}</div>
          </div>
        </div>
      </button>

      {/* Manual date picker */}
      <div className="rounded-xl border-2 border-white/[0.06] p-3">
        <label className="block text-xs text-white/40 mb-1.5">Or pick a different date</label>
        <input
          type="date"
          value={effective}
          min={todayIso}
          max={latestIso}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all [color-scheme:dark]"
        />
        <p className="text-[10px] text-white/30 mt-2">
          Earliest: today &middot; latest: {formatLabel(latestIso)}
        </p>
      </div>

      {/* Cost preview */}
      <div
        className="mt-3 rounded-xl p-3 text-sm"
        style={{
          backgroundColor: `${primaryColor}10`,
          borderColor: `${primaryColor}30`,
          borderWidth: 1,
          borderStyle: 'solid',
        }}
      >
        {todayChargePence > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-white/70">You&apos;ll pay today</span>
              <span className="font-bold text-white">&pound;{(todayChargePence / 100).toFixed(2)}</span>
            </div>
            <div className="text-[11px] text-white/50 mt-0.5">
              Covers {formatLabel(effective)} &rarr; {anchorLabel}
            </div>
            <div className="border-t border-white/[0.08] my-2" />
            <div className="flex items-center justify-between">
              <span className="text-white/70">Then on {anchorLabel}</span>
              <span className="font-bold text-white">&pound;{monthlyAmount.toFixed(2)}</span>
            </div>
            <div className="text-[11px] text-white/50 mt-0.5">
              Full month, and every 1st after that
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-white/70">You&apos;ll pay today</span>
              <span className="font-bold text-white">&pound;0.00</span>
            </div>
            <div className="text-[11px] text-white/50 mt-0.5">
              Card saved now &mdash; first charge on {formatLabel(effective)}
            </div>
            <div className="border-t border-white/[0.08] my-2" />
            <div className="flex items-center justify-between">
              <span className="text-white/70">On {formatLabel(effective)}</span>
              <span className="font-bold text-white">
                {/* If start is the 1st → full month; if mid-month → prorated from start to next 1st */}
                &pound;
                {((isStartInCurrentMonth(startDate, startDate)
                  ? estimateProratedPence(monthlyAmount, startDate)
                  : Math.round(monthlyAmount * 100)) /
                  100
                ).toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] text-white/50 mt-0.5">
              Then £{monthlyAmount.toFixed(2)} on the 1st of every month after
            </div>
          </>
        )}
      </div>
    </div>
  )
}
