'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Form for booking a paid one-off trial session.
 * Collects parent + child details, posts to /api/trial-bookings/paid,
 * then redirects to Stripe Checkout for the trial fee.
 */
export default function PaidTrialForm({
  slug,
  groupId,
  groupName,
  trialPrice,
  primaryColor,
  dayOfWeek,
  timeSlot,
}: {
  slug: string
  groupId: string
  groupName: string
  trialPrice: number
  primaryColor: string
  dayOfWeek?: string | null
  timeSlot?: string | null
}) {
  // Build the next 6 valid session dates from the class's day_of_week.
  // Parent picks from a dropdown of actual class dates instead of a free-form
  // date picker — much clearer + impossible to pick a date the class doesn't run.
  const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const validDates: { iso: string; label: string }[] = []
  if (dayOfWeek) {
    const targetIdx = DAYS_OF_WEEK.indexOf(dayOfWeek.toLowerCase())
    if (targetIdx >= 0) {
      const today = new Date()
      const todayIdx = today.getDay()
      let daysAhead = (targetIdx - todayIdx + 7) % 7
      if (daysAhead === 0) daysAhead = 7 // skip today, give them next week
      for (let i = 0; i < 6; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysAhead + i * 7)
        validDates.push({
          iso: d.toISOString().split('T')[0],
          label: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + (timeSlot ? ` · ${timeSlot}` : ''),
        })
      }
    }
  }
  const [parentName, setParentName] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childDob, setChildDob] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [readTerms, setReadTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!agreed) {
      setError('Please confirm the payment agreement.')
      return
    }
    if (!readTerms) {
      setError(`Please tick to confirm you've read ${groupName ? "the academy's" : 'the'} Terms & Conditions.`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/trial-bookings/paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          childFirstName,
          childLastName,
          childDob,
          parentName,
          parentEmail,
          parentPhone,
          sessionDate,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to start trial checkout')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-base bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10'
  const sectionHeading = 'text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/40'
  const fieldLabel = 'block text-xs sm:text-sm text-white/60 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5">
      {/* Your details */}
      <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
        <h3 className={sectionHeading}>Your details</h3>
        <div>
          <label className={fieldLabel}>Your full name *</label>
          <input type="text" required value={parentName} onChange={(e) => setParentName(e.target.value)} className={inputCls} placeholder="Jane Smith" />
        </div>
        <div>
          <label className={fieldLabel}>Email *</label>
          <input type="email" required value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
        </div>
        <div>
          <label className={fieldLabel}>Phone (optional)</label>
          <input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className={inputCls} placeholder="+44 7700 900000" />
        </div>
      </div>

      {/* Child + date — merged on mobile because they're tightly related */}
      <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
        <h3 className={sectionHeading}>Child &amp; date</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={fieldLabel}>First name *</label>
            <input type="text" required value={childFirstName} onChange={(e) => setChildFirstName(e.target.value)} className={inputCls} placeholder="Jimmy" />
          </div>
          <div>
            <label className={fieldLabel}>Last name *</label>
            <input type="text" required value={childLastName} onChange={(e) => setChildLastName(e.target.value)} className={inputCls} placeholder="Smith" />
          </div>
        </div>
        <div>
          <label className={fieldLabel}>Date of birth (optional)</label>
          <input type="date" value={childDob} onChange={(e) => setChildDob(e.target.value)} className={inputCls} />
        </div>
        <div>
          {validDates.length > 0 ? (
            <>
              <label className={fieldLabel}>
                Pick your trial date — available {dayOfWeek}s
              </label>
              <select
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Select a date…</option>
                {validDates.map((d) => (
                  <option key={d.iso} value={d.iso}>{d.label}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className={fieldLabel}>When would you like your trial?</label>
              <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className={inputCls} />
            </>
          )}
        </div>
      </div>

      <label className="flex items-start gap-2.5 text-xs sm:text-sm text-white/70 cursor-pointer leading-snug px-1">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-white shrink-0" />
        <span>
          I agree to a one-off charge of <strong>£{trialPrice.toFixed(2)}</strong> for one trial session of {groupName}.
          No subscription will be created.
        </span>
      </label>

      <label className="flex items-start gap-2.5 text-xs sm:text-sm text-white/70 cursor-pointer leading-snug px-1">
        <input type="checkbox" checked={readTerms} onChange={(e) => setReadTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-white shrink-0" />
        <span>
          I&apos;ve read and agree to{' '}
          <Link href={`/book/${slug}/terms`} target="_blank" className="underline hover:text-white" style={{ color: primaryColor }}>
            the Terms &amp; Conditions
          </Link>
          .
        </span>
      </label>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !agreed || !readTerms}
        className="w-full py-3.5 sm:py-4 rounded-2xl font-extrabold text-base sm:text-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: loading ? '#444' : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
          color: '#0a0a0a',
          boxShadow: !loading ? `0 10px 30px ${primaryColor}40` : 'none',
        }}
      >
        {loading ? 'Redirecting to payment…' : `Pay £${trialPrice.toFixed(2)} & Book Trial`}
      </button>

      <p className="text-[11px] sm:text-xs text-white/40 text-center px-2">
        Secure payment via Stripe. Your card details never touch our servers.
      </p>
    </form>
  )
}
