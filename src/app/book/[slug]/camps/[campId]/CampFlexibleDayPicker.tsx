'use client'

// Flexible Camps — Phase 2 (parent day picker, VIEW ONLY).
//
// Renders when the camp is booking_mode='flexible_days' AND
// FLEXIBLE_CAMPS_ENABLED is on. Lets a parent see days, toggle selection,
// see a live total, and see the minimum-days requirement. It does NOT
// submit anything anywhere — no Stripe, no /api/stripe/camp-checkout,
// no camp_bookings insert, no camp_booking_days insert, no /api call
// at all. The final action is a disabled "Booking not live yet"
// button with the exact copy required by the Phase 2 brief.
//
// Whole-camp bookings still use the existing CampBookingForm — this
// component is only rendered by page.tsx for flexible camps.

import { useMemo, useState } from 'react'

type CampDay = {
  id: string
  date: string        // ISO YYYY-MM-DD
  price: number | null // per-day override; NULL falls back to flexPricePerDay
  is_available: boolean
  sort_order: number | null
}

type Props = {
  campName: string
  flexPricePerDay: number | null
  flexMinDays: number | null
  days: CampDay[]
  primaryColor: string
}

function formatDayLabel(dateStr: string): { weekday: string; date: string } {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'long' }),
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }),
  }
}

function formatGBP(amount: number): string {
  return `£${amount.toFixed(2).replace(/\.00$/, '')}`
}

const BLOCKED_MESSAGE =
  'Flexible day booking is not live yet. Please contact the academy to book this camp.'

export default function CampFlexibleDayPicker({
  campName,
  flexPricePerDay,
  flexMinDays,
  days,
  primaryColor,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const pricePerDay = flexPricePerDay ?? 0

  const priceFor = (day: CampDay): number =>
    day.price != null ? Number(day.price) : pricePerDay

  const toggle = (day: CampDay) => {
    if (!day.is_available) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(day.id)) next.delete(day.id)
      else next.add(day.id)
      return next
    })
  }

  const orderedDays = useMemo(
    () =>
      [...days].sort((a, b) => {
        const so = (a.sort_order ?? 0) - (b.sort_order ?? 0)
        if (so !== 0) return so
        return a.date.localeCompare(b.date)
      }),
    [days],
  )

  const selectedCount = selected.size
  const total = orderedDays.reduce(
    (sum, d) => (selected.has(d.id) ? sum + priceFor(d) : sum),
    0,
  )

  const minDaysUnmet =
    flexMinDays != null && flexMinDays > 0 && selectedCount < flexMinDays
  const daysStillNeeded =
    minDaysUnmet && flexMinDays ? flexMinDays - selectedCount : 0

  const hasAvailable = orderedDays.some((d) => d.is_available)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-white mb-1">Choose Your Days</h3>
        <div
          className="h-0.5 w-10 rounded-full mb-3"
          style={{ backgroundColor: primaryColor }}
        />
        <p className="text-sm text-white/60">
          Select the days your child will attend
          {campName ? ` ${campName}` : ''}.
        </p>
      </div>

      {flexMinDays != null && flexMinDays > 0 && (
        <div
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/70"
          role="note"
        >
          Minimum booking: <span className="font-semibold text-white">{flexMinDays} day{flexMinDays === 1 ? '' : 's'}</span>
        </div>
      )}

      {!hasAvailable ? (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-4 text-center text-sm text-white/60">
          There are no available days on this camp yet. Please check back
          soon.
        </div>
      ) : (
        <ul className="space-y-2" role="list">
          {orderedDays.map((day) => {
            const { weekday, date } = formatDayLabel(day.date)
            const price = priceFor(day)
            const checked = selected.has(day.id)
            const disabled = !day.is_available

            return (
              <li key={day.id} role="listitem">
                <label
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 min-h-[56px] transition-colors ${
                    disabled
                      ? 'border-white/[0.08] bg-white/[0.02] opacity-50 cursor-not-allowed'
                      : checked
                        ? 'border-white/[0.25] bg-white/[0.08] cursor-pointer'
                        : 'border-white/[0.08] bg-white/[0.04] cursor-pointer hover:bg-white/[0.06]'
                  }`}
                  style={
                    checked && !disabled
                      ? { borderColor: `${primaryColor}66`, backgroundColor: `${primaryColor}14` }
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-white/20 flex-shrink-0"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(day)}
                    aria-label={`${weekday} ${date}${disabled ? ' (not available)' : ''}, ${formatGBP(price)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {weekday}
                    </div>
                    <div className="text-xs text-white/50 truncate">{date}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-white">
                      {formatGBP(price)}
                    </div>
                    {disabled && (
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">
                        Not available
                      </div>
                    )}
                  </div>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <div
        className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3"
        aria-live="polite"
        role="status"
      >
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            You&apos;re booking
          </div>
          <div className="text-sm text-white/80">
            {selectedCount} day{selectedCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
          <div className="text-lg font-bold text-white">
            {formatGBP(total)}
          </div>
        </div>
      </div>

      {minDaysUnmet && (
        <p className="text-xs text-amber-300/80" role="alert">
          Please select {daysStillNeeded} more day{daysStillNeeded === 1 ? '' : 's'} to meet the minimum booking.
        </p>
      )}

      {/* Booking action — HARD-DISABLED in Phase 2. No form submit, no
          onClick, no fetch. The final action is delivered in Phase 3
          once checkout + camp_bookings + camp_booking_days are wired.
          Do not remove or soften this block until Phase 3 lands. */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <span className="text-amber-400 text-base mt-0.5" aria-hidden="true">
            &#9888;
          </span>
          <div>
            <div className="text-sm font-semibold text-amber-200">
              Booking coming soon
            </div>
            <p className="text-xs text-amber-100/80 mt-1 leading-relaxed">
              {BLOCKED_MESSAGE}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-4 py-3 text-sm font-semibold text-white/40 cursor-not-allowed"
        >
          Booking not available yet
        </button>
      </div>
    </div>
  )
}
