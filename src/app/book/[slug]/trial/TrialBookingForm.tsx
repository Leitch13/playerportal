'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { deriveTrialSource, SOURCE_LABELS, type CanonicalSource } from '@/lib/trial-source-derive'

interface TrialBookingFormProps {
  orgId: string
  groups: { id: string; name: string; day: string | null; time: string | null }[]
  primaryColor: string
  slug: string
  academyName: string
  // Sprint 5 — server-captured source signals
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  referer?: string | null
}

export default function TrialBookingForm({ orgId, groups, primaryColor, slug, academyName, utmSource, utmMedium, utmCampaign, referer }: TrialBookingFormProps) {
  const [parentName, setParentName] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge] = useState('')
  const [groupId, setGroupId] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  // Sprint 5 — "How did you hear about us?" dropdown + Other free text.
  const [sourceChoice, setSourceChoice] = useState<CanonicalSource | ''>('')
  const [sourceOther, setSourceOther] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parentName || !parentEmail || !childName) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()

    // Sprint 5 — source derivation via shared priority chain.
    const sourceDerived = deriveTrialSource({
      dropdownValue: sourceChoice || null,
      dropdownOtherText: sourceOther,
      utmSource,
      utmCampaign,
      referer,
      academyHostHints: ['theplayerportal.net', 'playitloveit.com', 'playerportal.app'],
    })

    const { error: insertError } = await supabase.from('trial_bookings').insert({
      organisation_id: orgId,
      training_group_id: groupId || null,
      parent_name: parentName,
      parent_email: parentEmail,
      parent_phone: parentPhone || null,
      child_name: childName,
      child_age: childAge ? parseInt(childAge) : null,
      preferred_date: preferredDate || null,
      notes: notes || null,
      // Sprint 5 — three additive columns.
      trial_source: sourceDerived.trial_source,
      source_detail: sourceDerived.source_detail,
      referrer_url: sourceDerived.referrer_url,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setSuccess(true)

      // Send confirmation email (fire and forget)
      const selectedGroup = groups.find((g) => g.id === groupId)
      fetch('/api/email/trial-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName,
          parentEmail,
          childName,
          academyName,
          className: selectedGroup?.name,
          date: preferredDate || undefined,
        }),
      }).catch(() => {}) // Don't block on email failure

      // Auto-create a lead in the pipeline (fire and forget)
      const [firstName, ...lastParts] = parentName.trim().split(/\s+/)
      fetch('/api/leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisation_id: orgId,
          first_name: firstName,
          last_name: lastParts.join(' ') || null,
          email: parentEmail,
          phone: parentPhone || null,
          child_name: childName,
          child_age: childAge ? parseInt(childAge) : null,
          interested_in: selectedGroup?.name || null,
          source: 'website',
          status: 'trial_booked',
          notes: notes || null,
        }),
      }).catch(() => {}) // Don't block on lead create failure
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-8 text-center">
        <div className="text-5xl mb-4">⚽</div>
        <h2 className="text-2xl font-bold text-white mb-2">You&apos;re booked in!</h2>
        <p className="text-white/60 mb-6">
          We&apos;ll be in touch at <strong className="text-white/80">{parentEmail}</strong> to confirm your child&apos;s trial session.
        </p>
        <Link
          href={`/book/${slug}`}
          className="inline-block px-6 py-2.5 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
        >
          Back to {slug}
        </Link>
      </div>
    )
  }

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 transition-all'

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 md:p-8 space-y-5">
      <h2 className="text-lg font-bold text-white">Book a Free Trial</h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-white/50 block mb-1.5">Your Name *</label>
          <input
            className={inputClass}
            style={{ ['--tw-ring-color' as string]: primaryColor }}
            placeholder="Jane Smith"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-white/50 block mb-1.5">Email *</label>
          <input
            type="email"
            className={inputClass}
            style={{ ['--tw-ring-color' as string]: primaryColor }}
            placeholder="jane@email.com"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5">Phone (optional)</label>
        <input
          type="tel"
          className={inputClass}
          style={{ ['--tw-ring-color' as string]: primaryColor }}
          placeholder="07xxx xxx xxx"
          value={parentPhone}
          onChange={(e) => setParentPhone(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-white/50 block mb-1.5">Child&apos;s Name *</label>
          <input
            className={inputClass}
            style={{ ['--tw-ring-color' as string]: primaryColor }}
            placeholder="Tommy Smith"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-white/50 block mb-1.5">Child&apos;s Age</label>
          <input
            type="number"
            min="3"
            max="18"
            className={inputClass}
            style={{ ['--tw-ring-color' as string]: primaryColor }}
            placeholder="8"
            value={childAge}
            onChange={(e) => setChildAge(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5">Which class?</label>
        <select
          className={inputClass}
          style={{ ['--tw-ring-color' as string]: primaryColor }}
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">Any class</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} {g.day ? `(${g.day}${g.time ? ` ${g.time}` : ''})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5">Preferred Date</label>
        <input
          type="date"
          className={inputClass}
          style={{ ['--tw-ring-color' as string]: primaryColor }}
          value={preferredDate}
          onChange={(e) => setPreferredDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5">Anything we should know?</label>
        <textarea
          className={inputClass}
          style={{ ['--tw-ring-color' as string]: primaryColor }}
          rows={3}
          placeholder="e.g. Medical conditions, experience level..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Sprint 5 — How did you hear? — optional, highest-trust signal */}
      <div data-testid="source-tracking-block">
        <label className="text-xs font-medium text-white/50 block mb-1.5">How did you hear about us?</label>
        <select
          data-testid="source-dropdown"
          className={inputClass}
          style={{ ['--tw-ring-color' as string]: primaryColor }}
          value={sourceChoice}
          onChange={(e) => setSourceChoice(e.target.value as CanonicalSource | '')}
        >
          <option value="">— Prefer not to say —</option>
          <option value="facebook">{SOURCE_LABELS.facebook}</option>
          <option value="instagram">{SOURCE_LABELS.instagram}</option>
          <option value="google">{SOURCE_LABELS.google}</option>
          <option value="whatsapp">{SOURCE_LABELS.whatsapp}</option>
          <option value="referral">{SOURCE_LABELS.referral}</option>
          <option value="school_visit">{SOURCE_LABELS.school_visit}</option>
          <option value="flyer">{SOURCE_LABELS.flyer}</option>
          <option value="website">{SOURCE_LABELS.website}</option>
          <option value="other">{SOURCE_LABELS.other}</option>
        </select>
      </div>

      {sourceChoice === 'other' && (
        <div>
          <label className="text-xs font-medium text-white/50 block mb-1.5">Please tell us where</label>
          <input
            type="text"
            data-testid="source-other-text"
            className={inputClass}
            style={{ ['--tw-ring-color' as string]: primaryColor }}
            placeholder="e.g. coach told me, local event…"
            value={sourceOther}
            onChange={(e) => setSourceOther(e.target.value)}
            maxLength={200}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
      >
        {loading ? 'Booking...' : 'Book Free Trial'}
      </button>

      <p className="text-center text-xs text-white/30">
        No payment required. We&apos;ll confirm by email.
      </p>
    </form>
  )
}
