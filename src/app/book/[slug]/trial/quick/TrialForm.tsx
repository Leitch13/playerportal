'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface TrialFormProps {
  orgId: string
  groups: {
    id: string
    name: string
    day: string | null
    time: string | null
    location: string | null
    ageGroup: string | null
  }[]
  primaryColor: string
  slug: string
  academyName: string
  preselectedGroupId?: string | null
}

export default function TrialForm({ orgId, groups, primaryColor, slug, academyName, preselectedGroupId }: TrialFormProps) {
  const [parentName, setParentName] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [childName, setChildName] = useState('')
  const [groupId, setGroupId] = useState(preselectedGroupId || '')
  const [sessionDate, setSessionDate] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [childAge, setChildAge] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const selectedGroup = groups.find((g) => g.id === groupId)

  // Build the next 6 valid session dates from the selected class's day_of_week.
  // Parent picks from a dropdown of actual class dates instead of a free-form picker —
  // impossible to pick a date the class doesn't run.
  const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const validDates: { iso: string; label: string }[] = []
  if (selectedGroup?.day) {
    const targetIdx = DAYS_OF_WEEK.indexOf(selectedGroup.day.toLowerCase())
    if (targetIdx >= 0) {
      const today = new Date()
      const todayIdx = today.getDay()
      let daysAhead = (targetIdx - todayIdx + 7) % 7
      if (daysAhead === 0) daysAhead = 7 // skip today, give them next week
      for (let i = 0; i < 6; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysAhead + i * 7)
        validDates.push({
          iso: d.toISOString().split('T')[0],
          label: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + (selectedGroup.time ? ` · ${selectedGroup.time}` : ''),
        })
      }
    }
  }

  function buildCalendarTitle() {
    return `Free Trial - ${academyName}${selectedGroup ? ` (${selectedGroup.name})` : ''}`
  }

  function getNextClassDate(): Date {
    // Prefer the parent's chosen session date if they picked one from the dropdown.
    if (sessionDate) {
      const [y, m, d] = sessionDate.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
    if (!selectedGroup?.day) return new Date(Date.now() + 7 * 86400000)
    const dayMap: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    }
    const targetDay = dayMap[selectedGroup.day]
    if (targetDay === undefined) return new Date(Date.now() + 7 * 86400000)
    const now = new Date()
    const today = now.getDay()
    let daysUntil = targetDay - today
    if (daysUntil <= 0) daysUntil += 7
    const next = new Date(now)
    next.setDate(now.getDate() + daysUntil)
    return next
  }

  function getCalendarTimes(): { start: Date; end: Date } {
    const date = getNextClassDate()
    if (selectedGroup?.time) {
      const match = selectedGroup.time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i)
      if (match) {
        let hours = parseInt(match[1])
        const minutes = parseInt(match[2] || '0')
        const period = match[3]?.toLowerCase()
        if (period === 'pm' && hours < 12) hours += 12
        if (period === 'am' && hours === 12) hours = 0
        date.setHours(hours, minutes, 0, 0)
      } else {
        date.setHours(10, 0, 0, 0)
      }
    } else {
      date.setHours(10, 0, 0, 0)
    }
    const end = new Date(date.getTime() + 60 * 60 * 1000)
    return { start: date, end }
  }

  function toGoogleCalendarUrl() {
    const { start, end } = getCalendarTimes()
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const title = encodeURIComponent(buildCalendarTitle())
    const location = encodeURIComponent(selectedGroup?.location || '')
    const details = encodeURIComponent(`Free trial session for ${childName} at ${academyName}. No payment needed!`)
    return `https://calendar.google.com/calendar/event?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&location=${location}&details=${details}`
  }

  function toIcsDownload() {
    const { start, end } = getCalendarTimes()
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${buildCalendarTitle()}`,
      `LOCATION:${selectedGroup?.location || ''}`,
      `DESCRIPTION:Free trial session for ${childName} at ${academyName}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    return URL.createObjectURL(blob)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parentName || !parentEmail || !childName) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: insertError } = await supabase.from('trial_bookings').insert({
      organisation_id: orgId,
      training_group_id: groupId || null,
      parent_name: parentName,
      parent_email: parentEmail,
      parent_phone: phone || null,
      child_name: childName,
      child_age: childAge ? parseInt(childAge) : null,
      preferred_date: sessionDate || null,
      notes: notes || null,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Send confirmation email (fire and forget)
    fetch('/api/email/trial-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentName,
        parentEmail,
        childName,
        academyName,
        className: selectedGroup?.name,
      }),
    }).catch(() => {})

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
        phone: phone || null,
        child_name: childName,
        child_age: childAge ? parseInt(childAge) : null,
        interested_in: selectedGroup?.name || null,
        source: 'website',
        status: 'trial_booked',
        notes: notes || null,
      }),
    }).catch(() => {})

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="bg-white/[0.04] backdrop-blur rounded-2xl border border-white/[0.08] p-8 text-center">
        <div className="text-5xl mb-4">&#127881;</div>
        <h2 className="text-2xl font-extrabold mb-2">You&apos;re booked!</h2>
        <p className="text-white/60 mb-6">
          We&apos;ll be in touch at{' '}
          <strong className="text-white/80">{parentEmail}</strong> to confirm{' '}
          {childName}&apos;s trial session.
        </p>

        {/* Calendar Links */}
        <div className="mb-6">
          <p className="text-xs text-white/40 mb-3 uppercase tracking-wider font-medium">Add to Calendar</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <a
              href={toGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.5 3h-3V1.5h-1.5V3h-6V1.5H7.5V3h-3C3.675 3 3 3.675 3 4.5v15c0 .825.675 1.5 1.5 1.5h15c.825 0 1.5-.675 1.5-1.5v-15c0-.825-.675-1.5-1.5-1.5zm0 16.5h-15V8.25h15v11.25z" />
              </svg>
              Google Calendar
            </a>
            <a
              href={toIcsDownload()}
              download="trial-session.ics"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Apple Calendar
            </a>
          </div>
        </div>

        <Link
          href={`/book/${slug}`}
          className="inline-block px-6 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02]"
          style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
        >
          View All Classes &rarr;
        </Link>
      </div>
    )
  }

  const inputClass =
    'w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-3.5 py-3 sm:px-4 sm:py-3.5 text-white placeholder-white/30 text-base focus:outline-none focus:ring-2 transition-all'

  return (
    <form onSubmit={handleSubmit} className="bg-white/[0.04] backdrop-blur rounded-2xl border border-white/[0.08] p-4 sm:p-8 space-y-3 sm:space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Required fields */}
      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5">Your Name *</label>
        <input
          className={inputClass}
          style={{ ['--tw-ring-color' as string]: primaryColor }}
          placeholder="Jane Smith"
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5">Your Email *</label>
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

      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5">Child&apos;s First Name *</label>
        <input
          className={inputClass}
          style={{ ['--tw-ring-color' as string]: primaryColor }}
          placeholder="Tommy"
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
          required
        />
      </div>

      {preselectedGroupId && groups.length === 1 ? (
        // Class is locked in (parent came from a specific class page) — show as static card.
        // On mobile, merge the class card + date picker into a single visual block so there's
        // only ONE bordered chunk for "what + when" instead of two separate sections.
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:p-4 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/40 mb-1">Booking trial for</div>
            <div className="font-semibold text-white text-sm leading-tight">{groups[0].name}</div>
            <div className="text-xs text-white/50 mt-0.5">
              {groups[0].day}{groups[0].time ? ` · ${groups[0].time}` : ''}{groups[0].location ? ` · ${groups[0].location}` : ''}
            </div>
          </div>
          {validDates.length > 0 && (
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-white/40 block mb-1.5">
                Pick your date
              </label>
              <select
                className={inputClass}
                style={{ ['--tw-ring-color' as string]: primaryColor }}
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
              >
                <option value="">Select a date…</option>
                {validDates.map((d) => (
                  <option key={d.iso} value={d.iso}>{d.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="text-xs font-medium text-white/50 block mb-1.5">Select a Class</label>
          <select
            className={inputClass}
            style={{ ['--tw-ring-color' as string]: primaryColor }}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Any available class</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.day ? ` - ${g.day}` : ''}
                {g.time ? ` ${g.time}` : ''}
                {g.ageGroup ? ` (${g.ageGroup})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Expandable optional fields */}
      {!showMore && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="w-full text-center text-sm text-white/40 hover:text-white/60 transition-colors py-1"
        >
          + Add more details (optional)
        </button>
      )}

      {showMore && (
        <div className="space-y-4 pt-2 border-t border-white/[0.06]">
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
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1.5">Phone Number</label>
            <input
              type="tel"
              className={inputClass}
              style={{ ['--tw-ring-color' as string]: primaryColor }}
              placeholder="07xxx xxx xxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1.5">Notes / Message</label>
            <textarea
              className={inputClass}
              style={{ ['--tw-ring-color' as string]: primaryColor }}
              rows={2}
              placeholder="e.g. experience level, medical info..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Big CTA Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 rounded-2xl font-bold text-lg transition-all hover:scale-[1.01] hover:shadow-lg active:scale-[0.99] disabled:opacity-50"
        style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Booking...
          </span>
        ) : (
          'Book Free Trial'
        )}
      </button>

      <p className="text-center text-xs text-white/30">
        No password. No payment. No commitment.
      </p>
    </form>
  )
}
