'use client'

import { useState } from 'react'
import Link from 'next/link'

type Camp = {
  id: string
  organisation_id: string
  name: string
  start_date: string
  end_date: string
  daily_start_time: string | null
  daily_end_time: string | null
  location: string | null
  price: number | null
  early_bird_price: number | null
  early_bird_deadline: string | null
  sibling_discount_enabled: boolean
  sibling_discount_percent: number | null
  collect_medical_info: boolean
  require_consent: boolean
  max_capacity: number | null
}

type Props = {
  camp: Camp
  slug: string
  spotsLeft: number | null
  primaryColor: string
  bookingId?: string | null
  loggedInParent?: { name: string; email: string } | null
  existingChildren?: { id: string; firstName: string; lastName: string; dob: string | null }[]
  signInUrl?: string
}

function getCalendarLinks(camp: Camp) {
  const start = camp.start_date.replace(/-/g, '')
  const end = camp.end_date.replace(/-/g, '')
  const startTime = (camp.daily_start_time || '09:00').replace(':', '') + '00'
  const endTime = (camp.daily_end_time || '15:00').replace(':', '') + '00'
  const title = encodeURIComponent(camp.name)
  const loc = encodeURIComponent(camp.location || '')

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}T${startTime}/${end}T${endTime}&location=${loc}`

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${start}T${startTime}`,
    `DTEND:${end}T${endTime}`,
    `SUMMARY:${camp.name}`,
    `LOCATION:${camp.location || ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')

  const icsBlob = new Blob([icsContent], { type: 'text/calendar' })
  const icsUrl = URL.createObjectURL(icsBlob)

  return { googleUrl, icsUrl }
}

export default function CampBookingForm({ camp, slug, spotsLeft, primaryColor, bookingId, loggedInParent, existingChildren = [], signInUrl }: Props) {
  const [parentName, setParentName] = useState(loggedInParent?.name || '')
  const [parentEmail, setParentEmail] = useState(loggedInParent?.email || '')
  const [parentPhone, setParentPhone] = useState('')
  // '' = add a new child; otherwise the id of an existing child.
  const [selectedChildId, setSelectedChildId] = useState('')
  const [childName, setChildName] = useState('')
  const [childDob, setChildDob] = useState('')
  const [medicalInfo, setMedicalInfo] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)
  const [siblingDiscount, setSiblingDiscount] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // When an existing child is picked, fill name + DOB from their record.
  function handleSelectChild(id: string) {
    setSelectedChildId(id)
    const kid = existingChildren.find((k) => k.id === id)
    if (kid) {
      setChildName(`${kid.firstName} ${kid.lastName}`.trim())
      setChildDob(kid.dob || '')
    } else {
      setChildName('')
      setChildDob('')
    }
  }
  const [booked, setBooked] = useState(!!bookingId)

  const today = new Date().toISOString().split('T')[0]
  const isEarlyBird = camp.early_bird_price && camp.early_bird_deadline && today <= camp.early_bird_deadline
  let currentPrice = isEarlyBird ? Number(camp.early_bird_price) : Number(camp.price || 0)

  if (siblingDiscount && camp.sibling_discount_enabled && camp.sibling_discount_percent) {
    currentPrice = currentPrice * (1 - Number(camp.sibling_discount_percent) / 100)
  }
  currentPrice = Math.round(currentPrice * 100) / 100

  const isFull = spotsLeft !== null && spotsLeft <= 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isFull) return

    if (camp.require_consent && !consentGiven) {
      setError('You must accept the terms and consent to proceed.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/stripe/camp-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campId: camp.id,
          organisationId: camp.organisation_id,
          parentName,
          parentEmail,
          parentPhone,
          childName,
          childDob,
          medicalInfo,
          consentGiven,
          siblingDiscount,
          slug,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      if (data.free) {
        setBooked(true)
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Success state
  if (booked) {
    const { googleUrl, icsUrl } = getCalendarLinks(camp)
    return (
      <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center space-y-4">
        <div className="text-4xl">&#9989;</div>
        <h3 className="text-xl font-bold text-white">Booking Confirmed!</h3>
        <p className="text-white/70 text-sm">
          {childName ? `${childName} is` : 'Your child is'} booked in for <strong className="text-white">{camp.name}</strong>.
          A confirmation email will be sent shortly.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-full text-sm font-medium border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors"
          >
            Add to Google Calendar
          </a>
          <a
            href={icsUrl}
            download={`${camp.name}.ics`}
            className="px-5 py-2.5 rounded-full text-sm font-medium border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors"
          >
            Download .ics File
          </a>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 placeholder:text-white/30'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Pricing banner */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            {isEarlyBird ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">
                    &pound;{Number(camp.early_bird_price).toFixed(0)}
                  </span>
                  <span className="text-sm text-white/40 line-through">
                    &pound;{Number(camp.price).toFixed(0)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">
                    Early Bird
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-1">
                  Early bird price ends {new Date(camp.early_bird_deadline + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </>
            ) : (
              <span className="text-2xl font-bold text-white">
                {currentPrice > 0 ? <>&#163;{currentPrice.toFixed(0)}</> : 'Free'}
              </span>
            )}
          </div>
          {spotsLeft !== null && (
            <div className={`text-sm font-semibold ${spotsLeft <= 5 ? 'text-red-400' : 'text-white/60'}`}>
              {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
            </div>
          )}
        </div>

        {siblingDiscount && camp.sibling_discount_enabled && (
          <div className="mt-2 text-xs text-green-400">
            Sibling discount applied: {camp.sibling_discount_percent}% off &mdash; &pound;{currentPrice.toFixed(2)}
          </div>
        )}
      </div>

      {isFull && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
          <p className="text-red-400 font-semibold text-sm">This camp is full.</p>
        </div>
      )}

      {/* Returning parent? Offer sign-in to reuse their details + child. */}
      {!loggedInParent && signInUrl && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white/60">
          Already registered with this academy?{' '}
          <a href={signInUrl} className="font-semibold underline hover:text-white" style={{ color: primaryColor }}>
            Sign in
          </a>{' '}
          to book with your child&apos;s saved details.
        </div>
      )}
      {loggedInParent && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white/60">
          Signed in as <span className="text-white font-medium">{loggedInParent.name || loggedInParent.email}</span>.
        </div>
      )}

      {/* Parent details */}
      <fieldset disabled={isFull} className="space-y-4">
        <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Parent / Guardian</h4>
        <input
          type="text"
          placeholder="Full name *"
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          required
          className={inputCls}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="email"
            placeholder="Email address *"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            required
            className={inputCls}
          />
          <input
            type="tel"
            placeholder="Phone number"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            className={inputCls}
          />
        </div>
      </fieldset>

      {/* Child details */}
      <fieldset disabled={isFull} className="space-y-4">
        <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Child Details</h4>

        {/* Signed-in parents with saved children can pick one instead of retyping */}
        {existingChildren.length > 0 && (
          <div>
            <label className="block text-[11px] text-white/40 mb-1">Select a child</label>
            <select
              value={selectedChildId}
              onChange={(e) => handleSelectChild(e.target.value)}
              className={`${inputCls} appearance-none`}
            >
              <option value="">＋ Add a new child</option>
              {existingChildren.map((k) => (
                <option key={k.id} value={k.id}>{`${k.firstName} ${k.lastName}`.trim()}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Child's name *"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            required
            readOnly={!!selectedChildId}
            className={`${inputCls}${selectedChildId ? ' opacity-70' : ''}`}
          />
          <div>
            <label className="block text-[11px] text-white/40 mb-1">Date of birth</label>
            <input
              type="date"
              value={childDob}
              onChange={(e) => setChildDob(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              readOnly={!!selectedChildId}
              className={`${inputCls} [color-scheme:dark]${selectedChildId ? ' opacity-70' : ''}`}
            />
          </div>
        </div>

        {camp.collect_medical_info && (
          <div>
            <label className="block text-xs text-white/40 mb-1">Medical / Allergy Information</label>
            <textarea
              placeholder="Please list any allergies, medical conditions, or medications..."
              value={medicalInfo}
              onChange={(e) => setMedicalInfo(e.target.value)}
              rows={3}
              className={inputCls}
            />
          </div>
        )}
      </fieldset>

      {/* Sibling discount */}
      {camp.sibling_discount_enabled && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={siblingDiscount}
            onChange={(e) => setSiblingDiscount(e.target.checked)}
            className="rounded border-white/20 bg-[#1a1a1a]"
          />
          <span className="text-sm text-white/70">
            I have another child already booked on this camp (sibling discount: {camp.sibling_discount_percent}% off)
          </span>
        </label>
      )}

      {/* Consent */}
      {camp.require_consent && (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="rounded border-white/20 bg-[#1a1a1a] mt-0.5"
          />
          <span className="text-sm text-white/70">
            I consent to my child participating in this camp. I confirm the medical information provided
            is accurate, and I&apos;ve read and agree to{' '}
            <Link href={`/book/${slug}/terms`} target="_blank" className="underline hover:text-white" style={{ color: primaryColor }}>
              the Terms &amp; Conditions
            </Link>
            . *
          </span>
        </label>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || isFull || !parentName || !parentEmail || !childName}
        className="w-full py-4 rounded-xl text-base font-bold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
        style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
      >
        {loading ? 'Processing...' : isFull ? 'Camp Full' : `Book Camp${currentPrice > 0 ? ` \u2014 \u00A3${currentPrice.toFixed(0)}` : ''}`}
      </button>
    </form>
  )
}
