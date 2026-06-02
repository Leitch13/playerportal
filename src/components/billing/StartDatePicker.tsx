'use client'

/**
 * Start-date picker for the subscribe flow.
 *
 * Two modes, switched by the `allowFutureStart` prop (set server-side from
 * the BILLING_FUTURE_START_ENABLED feature flag):
 *
 * - `allowFutureStart=false` (default, today-only): renders only the
 *   "Start today" pill + a "coming soon" notice. Cost preview always shows
 *   the immediate-prorated case. This is the Option B state used while
 *   Stage 3 is in build / awaiting activation.
 *
 * - `allowFutureStart=true` (Stage 3 enabled for this org): renders the
 *   "Next session" pill + native date input + range hint. Cost preview
 *   switches between "you pay today" (immediate) and "card saved; first
 *   charge on chosen date" (future) based on selection.
 *
 * Purely presentational. Lifts state up — the parent form owns the date.
 */

import { useMemo } from 'react'
import {
  estimateProratedPence,
  firstOfNextMonthLabel,
  isStartInCurrentMonth,
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
  /**
   * Stage 3 feature flag (server-checked, passed in as prop).
   * Default false → today-only behaviour (Option B clamp).
   */
  allowFutureStart?: boolean
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
  allowFutureStart = false,
}: Props) {
  // All hooks must run on every render, regardless of which branch we
  // render below. React's rules of hooks forbid conditional/early-return
  // hook calls.
  const today = useMemo(() => new Date(), [])
  const todayIso = useMemo(() => isoDate(today), [today])
  const maxIso = useMemo(() => isoDate(latestAllowedStartDate(today)), [today])
  const nextClass = useMemo(
    () => nextSessionDate({ day_of_week: classDayOfWeek, time_slot: classTimeSlot }, today),
    [classDayOfWeek, classTimeSlot, today],
  )
  const nextClassIso = nextClass ? isoDate(nextClass) : null

  const effectiveValue = value || todayIso
  const selectedDate = useMemo(() => new Date(effectiveValue + 'T00:00:00Z'), [effectiveValue])
  const todayDate = useMemo(() => new Date(todayIso + 'T00:00:00Z'), [todayIso])

  // ──────────────────────────────────────────────────────────────────
  // Today-only mode (Option B clamp / Stage 3 not enabled)
  // ──────────────────────────────────────────────────────────────────
  if (!allowFutureStart) {
    // Suppress unused-prop warning: parent always submits today via
    // defaultStartIso in this mode.
    void value
    void maxIso
    void nextClassIso
    void selectedDate
    void todayDate

    const startDate = new Date(todayIso + 'T00:00:00Z')
    const todayChargePence = estimateProratedPence(monthlyAmount, startDate)
    const anchorLabel = firstOfNextMonthLabel(startDate)

    return (
      <div>
        <label className="block text-xs text-white/50 mb-2">When does it start?</label>

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

        <div className="rounded-xl p-3 mb-3 border border-white/[0.06] bg-white/[0.02]">
          <p className="text-[11px] text-white/50 leading-relaxed">
            Scheduling a future start date is coming soon. For now, your child starts today and can attend their next class session.
          </p>
        </div>

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

  // ──────────────────────────────────────────────────────────────────
  // Full picker mode (Stage 3 enabled): today-or-future, up to today+28
  // (effectiveValue, selectedDate, todayDate are declared above so all
  // hooks run unconditionally — see rules-of-hooks comment.)
  // ──────────────────────────────────────────────────────────────────

  // Three start modes:
  //   1. Immediate prorated: start <= today AND in current month → charge today + 1st of next month
  //   2. Same-month future: start > today AND in current month → SetupIntent, first charge on start (prorated to 1st)
  //   3. Next-month future: start in a future calendar month → SetupIntent, first full charge on start_date (which IS the 1st in that month, typically)
  // The cost preview must reflect the chosen mode.
  const startsToday = isStartInCurrentMonth(selectedDate, todayDate) && selectedDate <= todayDate
  const todayChargePence = startsToday ? estimateProratedPence(monthlyAmount, selectedDate) : 0
  const anchorLabel = firstOfNextMonthLabel(selectedDate)

  return (
    <div>
      <label className="block text-xs text-white/50 mb-2">When does it start?</label>

      {/* Quick pick: Start today */}
      <button
        type="button"
        onClick={() => onChange(todayIso)}
        className="w-full text-left rounded-xl border-2 p-3 mb-2 bg-white/[0.04] transition-colors"
        style={{
          borderColor: effectiveValue === todayIso ? `${primaryColor}` : 'rgba(255,255,255,0.08)',
          boxShadow: effectiveValue === todayIso ? `0 0 16px ${primaryColor}25` : undefined,
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-white text-sm">Start today</div>
            <div className="text-[11px] text-white/40 mt-0.5">{classLabel}</div>
          </div>
          <div className="text-xs font-semibold text-white">{formatLabel(todayIso)}</div>
        </div>
      </button>

      {/* Quick pick: Next class session (if known and != today) */}
      {nextClassIso && nextClassIso !== todayIso && (
        <button
          type="button"
          onClick={() => onChange(nextClassIso)}
          className="w-full text-left rounded-xl border-2 p-3 mb-2 bg-white/[0.04] transition-colors"
          style={{
            borderColor: effectiveValue === nextClassIso ? `${primaryColor}` : 'rgba(255,255,255,0.08)',
            boxShadow: effectiveValue === nextClassIso ? `0 0 16px ${primaryColor}25` : undefined,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-white text-sm">Next session</div>
              <div className="text-[11px] text-white/40 mt-0.5">{classLabel}</div>
            </div>
            <div className="text-xs font-semibold text-white">{formatLabel(nextClassIso)}</div>
          </div>
        </button>
      )}

      {/* Custom date input */}
      <div className="rounded-xl border border-white/[0.06] p-3 mb-3 bg-white/[0.02]">
        <label className="block text-[11px] text-white/50 mb-1.5">
          Or pick another date (up to {formatLabel(maxIso)})
        </label>
        <input
          type="date"
          value={effectiveValue}
          min={todayIso}
          max={maxIso}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
          style={{ colorScheme: 'dark' }}
        />
      </div>

      {/* Cost preview — branches on startsToday */}
      <div
        className="rounded-xl p-3 text-sm"
        style={{
          backgroundColor: `${primaryColor}10`,
          borderColor: `${primaryColor}30`,
          borderWidth: 1,
          borderStyle: 'solid',
        }}
      >
        {startsToday ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-white/70">You&apos;ll pay today</span>
              <span className="font-bold text-white">&pound;{(todayChargePence / 100).toFixed(2)}</span>
            </div>
            <div className="text-[11px] text-white/50 mt-0.5">
              Covers {formatLabel(effectiveValue)} &rarr; {anchorLabel}
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
              Card saved. No charge until your start date.
            </div>
            <div className="border-t border-white/[0.08] my-2" />
            <div className="flex items-center justify-between">
              <span className="text-white/70">On {formatLabel(effectiveValue)}</span>
              <span className="font-bold text-white">
                {/* If start_date is in a future calendar month, first charge is
                    typically the full monthly amount (the 1st of that month).
                    If start_date is later in the current month, it's still a
                    prorated amount aligned to the 1st of next month. */}
                &pound;
                {(estimateProratedPence(monthlyAmount, selectedDate) / 100).toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] text-white/50 mt-0.5">
              First charge, aligned to the 1st of the next month
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
        )}
      </div>
    </div>
  )
}
