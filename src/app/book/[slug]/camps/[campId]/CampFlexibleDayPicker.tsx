'use client'

// Flexible Camps — Phase 3D (parent UI wired to backend).
//
// Renders when the camp is booking_mode='flexible_days' AND
// FLEXIBLE_CAMPS_ENABLED is on (both gates enforced by
// `/book/[slug]/camps/[campId]/page.tsx`).
//
// ─── What this component does ───
//   * Day picker (reads camp_days rows fetched server-side)
//   * Parent/child details form (duplicated from CampBookingForm rather
//     than extracted to keep the whole-camp file byte-identical)
//   * Live total display (CLIENT-SIDE, DISPLAY ONLY — server recomputes)
//   * "Continue to Payment" POSTs { selectedCampDayIds, parent/child
//     fields } to /api/stripe/flexible-camp-checkout. NO totals sent.
//   * Redirects to Stripe on paid; renders the booked state on free
//   * Handles server-returned `fullDayIds` by marking those days
//     locally full + removing them from selection (never silently drops)
//   * Renders confirmation UI when `bookingId` is passed (post-Stripe
//     success return) or a cancelled banner when `cancelled` is true
//
// ─── Safety story ───
//   * Whole-camp bookings still use the existing CampBookingForm — this
//     component is only rendered by page.tsx for flexible camps
//   * Server-side validation (route /api/stripe/flexible-camp-checkout)
//     is the source of truth for capacity + pricing
//   * `FLEXIBLE_CAMPS_ENABLED` and the Phase 1 publish lock together
//     keep this UI unreachable in production until QA + pilot land

import { useMemo, useState } from 'react'

type CampDay = {
  id: string
  date: string        // ISO YYYY-MM-DD
  price: number | null // per-day override; NULL falls back to flexPricePerDay
  is_available: boolean
  sort_order: number | null
}

type Props = {
  campId: string
  organisationId: string
  slug: string
  campName: string
  flexPricePerDay: number | null
  flexMinDays: number | null
  days: CampDay[]
  primaryColor: string
  // Booking-config fields on the camp — determines which parent/child
  // form fields to render.
  collectMedicalInfo: boolean
  requireConsent: boolean
  siblingDiscountEnabled: boolean
  siblingDiscountPercent: number | null
  // Return-URL state passed by the parent page.tsx after Stripe redirect.
  bookingId?: string | null   // present when ?booked=1&booking=<id>
  cancelled?: boolean         // present when ?cancelled=1
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

export default function CampFlexibleDayPicker({
  campId,
  organisationId,
  slug,
  campName,
  flexPricePerDay,
  flexMinDays,
  days,
  primaryColor,
  collectMedicalInfo,
  requireConsent,
  siblingDiscountEnabled,
  siblingDiscountPercent,
  bookingId,
  cancelled,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Days the server reported as full during a checkout attempt. Tracked
  // client-side to disable them + remove from selection without silently
  // dropping. Reset only on page reload.
  const [locallyFullDayIds, setLocallyFullDayIds] = useState<Set<string>>(new Set())

  // Parent/child form state — mirrors CampBookingForm field-for-field
  // (except spots-left, which is per-day for flexible bookings).
  const [parentName, setParentName] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [childName, setChildName] = useState('')
  const [childDob, setChildDob] = useState('')
  const [medicalInfo, setMedicalInfo] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)
  const [siblingDiscount, setSiblingDiscount] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState(!!bookingId)

  const pricePerDay = flexPricePerDay ?? 0
  const priceFor = (day: CampDay): number =>
    day.price != null ? Number(day.price) : pricePerDay

  // UK calendar date ("YYYY-MM-DD" via Europe/London) so a day is only "past"
  // when its date is strictly before today's UK date — a day that IS today
  // stays bookable. Mirrors the server guard in flexible-camp-checkout so the
  // picker never offers a day the checkout would reject. camp_days.date is a
  // plain date string, so a lexical compare is a correct date-only comparison.
  const ukToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
  const isPastDay = (day: CampDay): boolean => String(day.date) < ukToday

  const isEffectivelyUnavailable = (day: CampDay): boolean =>
    !day.is_available || locallyFullDayIds.has(day.id) || isPastDay(day)

  const toggle = (day: CampDay) => {
    if (isEffectivelyUnavailable(day)) return
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
  // CLIENT-SIDE, DISPLAY ONLY. Server recomputes on the checkout route
  // and is the source of truth for the actual charge.
  const grossTotal = orderedDays.reduce(
    (sum, d) => (selected.has(d.id) ? sum + priceFor(d) : sum),
    0,
  )
  let displayTotal = grossTotal
  if (siblingDiscount && siblingDiscountEnabled && siblingDiscountPercent) {
    displayTotal = grossTotal * (1 - Number(siblingDiscountPercent) / 100)
  }
  displayTotal = Math.round(displayTotal * 100) / 100

  const minDaysUnmet =
    flexMinDays != null && flexMinDays > 0 && selectedCount < flexMinDays
  const daysStillNeeded =
    minDaysUnmet && flexMinDays ? flexMinDays - selectedCount : 0

  const hasAvailable = orderedDays.some((d) => !isEffectivelyUnavailable(d))

  const requiredFieldsComplete =
    parentName.trim() !== '' &&
    parentEmail.trim() !== '' &&
    childName.trim() !== '' &&
    (!requireConsent || consentGiven)

  const canContinue =
    !loading &&
    selectedCount > 0 &&
    !minDaysUnmet &&
    requiredFieldsComplete

  // ─── Confirmation state (return from Stripe with ?booked=1) ─────
  if (booked) {
    return (
      <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center space-y-4">
        <div className="text-4xl">&#9989;</div>
        <h3 className="text-xl font-bold text-white">Booking Confirmed!</h3>
        <p className="text-white/70 text-sm">
          {childName ? `${childName} is` : 'Your child is'} booked in for{' '}
          <strong className="text-white">{campName}</strong>. A confirmation email
          with the days you booked will arrive shortly.
        </p>
        {bookingId && (
          <p className="text-xs text-white/40 font-mono">Reference: {bookingId.slice(0, 8)}</p>
        )}
      </div>
    )
  }

  // ─── Submit handler ─────────────────────────────────────────────
  // POSTs ONLY the selected day ids and parent/child data. No totals,
  // no per-day prices, no discount amount — the server is the sole
  // source of truth for pricing.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canContinue) return

    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/stripe/flexible-camp-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campId,
          organisationId,
          parentName,
          parentEmail,
          parentPhone,
          childName,
          childDob,
          medicalInfo,
          consentGiven,
          siblingDiscount,
          slug,
          selectedCampDayIds: Array.from(selected),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Server-side capacity race: some selected days became full
        // between page load and submit. Mark them locally full +
        // deselect so the parent can review + retry.
        if (Array.isArray(data.fullDayIds) && data.fullDayIds.length > 0) {
          const fullSet = new Set<string>(data.fullDayIds as string[])
          setLocallyFullDayIds((prev) => {
            const next = new Set(prev)
            for (const id of fullSet) next.add(id)
            return next
          })
          setSelected((prev) => {
            const next = new Set(prev)
            for (const id of fullSet) next.delete(id)
            return next
          })
        }
        // Same treatment for individually-marked unavailableDayIds.
        if (Array.isArray(data.unavailableDayIds) && data.unavailableDayIds.length > 0) {
          const unavailableSet = new Set<string>(data.unavailableDayIds as string[])
          setLocallyFullDayIds((prev) => {
            const next = new Set(prev)
            for (const id of unavailableSet) next.add(id)
            return next
          })
          setSelected((prev) => {
            const next = new Set(prev)
            for (const id of unavailableSet) next.delete(id)
            return next
          })
        }
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      if (data.free) {
        // Free camp — no Stripe. Redirect to the same success URL the
        // paid path uses so the confirmation UI + email flow are
        // identical from the parent's perspective.
        window.location.href = `/book/${slug}/camps/${campId}?booked=1&booking=${data.bookingId}`
        return
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      // Unexpected shape — fail visibly.
      setError('Unexpected response from the server. Please try again.')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 placeholder:text-white/30'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      {cancelled && !bookingId && (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/80"
          role="status"
        >
          Payment was cancelled — your booking was not created. Please try again below.
        </div>
      )}

      {flexMinDays != null && flexMinDays > 0 && (
        <div
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/70"
          role="note"
        >
          Minimum booking:{' '}
          <span className="font-semibold text-white">
            {flexMinDays} day{flexMinDays === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {!hasAvailable ? (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-4 text-center text-sm text-white/60">
          There are no available days on this camp yet. Please check back soon.
        </div>
      ) : (
        <ul className="space-y-2" role="list">
          {orderedDays.map((day) => {
            const { weekday, date } = formatDayLabel(day.date)
            const price = priceFor(day)
            const checked = selected.has(day.id)
            const disabled = isEffectivelyUnavailable(day)
            const wasLocallyBumped = locallyFullDayIds.has(day.id)

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
                        {wasLocallyBumped ? 'Just filled' : 'Not available'}
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
            {formatGBP(displayTotal)}
          </div>
        </div>
      </div>

      {minDaysUnmet && (
        <p className="text-xs text-amber-300/80" role="alert">
          Please select {daysStillNeeded} more day{daysStillNeeded === 1 ? '' : 's'} to
          meet the minimum booking.
        </p>
      )}

      {/* ─── Parent + child details ─── */}
      <div className="space-y-3 pt-2">
        <input
          type="text"
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          required
          className={inputCls}
        />
        <input
          type="email"
          value={parentEmail}
          onChange={(e) => setParentEmail(e.target.value)}
          placeholder="Your email"
          autoComplete="email"
          required
          className={inputCls}
        />
        <input
          type="tel"
          value={parentPhone}
          onChange={(e) => setParentPhone(e.target.value)}
          placeholder="Phone (optional)"
          autoComplete="tel"
          inputMode="tel"
          className={inputCls}
        />
        <input
          type="text"
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
          placeholder="Child's full name"
          required
          className={inputCls}
        />
        <input
          type="date"
          value={childDob}
          onChange={(e) => setChildDob(e.target.value)}
          placeholder="Child's date of birth (optional)"
          className={inputCls}
        />
        {collectMedicalInfo && (
          <textarea
            value={medicalInfo}
            onChange={(e) => setMedicalInfo(e.target.value)}
            placeholder="Any medical or allergy information we should know"
            rows={3}
            className={inputCls}
          />
        )}
        {siblingDiscountEnabled && siblingDiscountPercent ? (
          <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={siblingDiscount}
              onChange={(e) => setSiblingDiscount(e.target.checked)}
              className="rounded border-white/20"
            />
            <span>
              I have another child already booked on this camp (sibling discount:{' '}
              {siblingDiscountPercent}% off)
            </span>
          </label>
        ) : null}
        {requireConsent && (
          <label className="flex items-start gap-2 text-xs text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-0.5 rounded border-white/20"
              required
            />
            <span>
              I agree to the academy&apos;s terms &amp; conditions and consent to my child
              taking part in the camp.
            </span>
          </label>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-300" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canContinue}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: canContinue ? primaryColor : '#333',
          color: canContinue ? '#0a0a0a' : undefined,
        }}
      >
        {loading ? 'Redirecting to payment…' : displayTotal > 0 ? `Continue to Payment · ${formatGBP(displayTotal)}` : 'Continue'}
      </button>

      <p className="text-[10px] text-white/30 text-center leading-relaxed">
        You&apos;ll be redirected to Stripe to complete payment securely. The academy
        confirms the final price.
      </p>
    </form>
  )
}
