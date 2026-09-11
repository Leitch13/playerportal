'use client'

/**
 * Start-date picker for the signup flow — the same for every academy.
 *
 * Lists today (if it is a class day) and the upcoming class dates within the
 * next 28 days. The parent picks one, pays NOW for the sessions from that
 * date to the end of that month, and the plan bills on the 1st. If the class
 * has no set day, a plain date input is offered instead.
 *
 * The "pay today" figure comes from firstChargeFor() — the same function the
 * checkout route charges with — so what is shown is what is charged.
 * See BILLING_RULES.md.
 */

import { useEffect, useMemo } from 'react'
import { firstOfNextMonthLabel, firstOfNextMonthUnix } from '@/lib/billing/anchor'
import { isoDate, latestAllowedStartDate } from '@/lib/billing/next-session'
import { firstChargeFor, firstChargeLabel, generateSessionDates } from '@/lib/billing/sessions'

interface Props {
  /** ISO date "YYYY-MM-DD". Empty string = no selection yet. */
  value: string
  onChange: (iso: string) => void
  classDayOfWeek: string | null
  classTimeSlot: string | null
  classLabel: string
  /** Monthly plan amount in £ (pounds). */
  monthlyAmount: number
  primaryColor: string
}

function formatLabel(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

export function StartDatePicker({ value, onChange, classDayOfWeek, classLabel, monthlyAmount, primaryColor }: Props) {
  const today = useMemo(() => new Date(), [])
  const todayIso = useMemo(() => isoDate(today), [today])
  const maxIso = useMemo(() => isoDate(latestAllowedStartDate(today)), [today])

  // Class dates in [today, today+28]. Empty when the class has no set day.
  const sessionDateOptions = useMemo(() => {
    if (!classDayOfWeek) return [] as string[]
    const end = new Date(todayIso + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + 29)
    return generateSessionDates(todayIso, end.toISOString().slice(0, 10), classDayOfWeek)
  }, [todayIso, classDayOfWeek])
  const dayKnown = sessionDateOptions.length > 0

  // Default to the first class date so the preview is right from first render.
  useEffect(() => {
    if (!dayKnown) return
    if (value && sessionDateOptions.includes(value)) return
    onChange(sessionDateOptions[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKnown, sessionDateOptions.join('|')])

  const effectiveValue = value || (dayKnown ? sessionDateOptions[0] : todayIso)
  const startDate = new Date(effectiveValue + 'T00:00:00Z')
  const anchorIso = new Date(firstOfNextMonthUnix(startDate) * 1000).toISOString().slice(0, 10)
  const fc = firstChargeFor(monthlyAmount, effectiveValue, anchorIso, classDayOfWeek)
  const anchorLabel = firstOfNextMonthLabel(startDate)

  const pill = (iso: string, title: string) => (
    <button
      key={iso}
      type="button"
      onClick={() => onChange(iso)}
      className="w-full text-left rounded-xl border-2 p-3 mb-2 bg-white/[0.04] transition-colors"
      style={{
        borderColor: effectiveValue === iso ? `${primaryColor}` : 'rgba(255,255,255,0.08)',
        boxShadow: effectiveValue === iso ? `0 0 16px ${primaryColor}25` : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-white text-sm">{title}</div>
          <div className="text-[11px] text-white/40 mt-0.5">{classLabel}</div>
        </div>
        <div className="text-xs font-semibold text-white">{formatLabel(iso)}</div>
      </div>
    </button>
  )

  return (
    <div>
      <label className="block text-xs text-white/50 mb-2">When does it start?</label>

      {dayKnown ? (
        <>
          <div className="text-[11px] text-white/50 mb-2">
            {classLabel} meets on {classDayOfWeek}s — pick your first session:
          </div>
          {sessionDateOptions.map((iso, idx) => pill(iso, iso === todayIso ? 'Start today' : idx === 0 ? 'Next session' : 'Session'))}
        </>
      ) : (
        <>
          {pill(todayIso, 'Start today')}
          <div className="rounded-xl border border-white/[0.06] p-3 mb-3 bg-white/[0.02]">
            <label className="block text-[11px] text-white/50 mb-1.5">
              Pick a start date — your coach will confirm session times.
            </label>
            <input
              type="date"
              value={effectiveValue}
              min={todayIso}
              max={maxIso}
              onChange={(e) => onChange(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              style={{ colorScheme: 'dark' }}
            />
            <div className="text-[11px] text-white/40 mt-1.5">Up to {formatLabel(maxIso)}.</div>
          </div>
        </>
      )}

      <div
        className="rounded-xl p-3 text-sm"
        style={{ backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}30`, borderWidth: 1, borderStyle: 'solid' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-white/70">You&apos;ll pay today</span>
          <span className="font-bold text-white">&pound;{(fc.pence / 100).toFixed(2)}</span>
        </div>
        <div className="text-[11px] text-white/50 mt-0.5">
          {fc.pence > 0 ? `${firstChargeLabel(fc)} — ${formatLabel(effectiveValue)} to ${anchorLabel}` : `Nothing to pay before ${anchorLabel}`}
        </div>
        <div className="border-t border-white/[0.08] my-2" />
        <div className="flex items-center justify-between">
          <span className="text-white/70">Then on {anchorLabel}</span>
          <span className="font-bold text-white">&pound;{monthlyAmount.toFixed(2)}</span>
        </div>
        <div className="text-[11px] text-white/50 mt-0.5">Full month, and every 1st after that</div>
      </div>
    </div>
  )
}
