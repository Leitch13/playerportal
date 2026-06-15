'use client'

// Camps Safe Edit — Phase 1A + Phase 2A (additive structural editing).
//
// A lean, dedicated edit modal — deliberately NOT a mode bolted onto the big
// create form (CampForm). Keeping it separate means the create flow stays
// byte-identical and this component can only ever write the allowlists.
//
// Phase 1A: safe fields editable; dangerous money/structure fields read-only.
// Phase 2A (gated by structuralEnabled): the end date + schedule unlock for
// ADDITIVE changes only — extend end date, add day(s), append activities.
// Start date + price stay locked always. The structural guard (additiveEditError)
// + pickAdditiveCampFields make the write provably non-reductive. Save is still a
// single camps.update(...).eq('id') — no Stripe, no booking rows touched.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FileUpload from '@/components/FileUpload'
import {
  pickSafeCampFields,
  capacityError,
  pickAdditiveCampFields,
  additiveEditError,
  generateScheduleDays,
  campDayCount,
  type ScheduleDay,
} from '@/lib/camps-edit'

type EditableCamp = {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  daily_start_time: string | null
  daily_end_time: string | null
  location: string | null
  age_group: string | null
  price: number | null
  max_capacity: number | null
  image_url: string | null
  what_to_bring: string | null
  is_published: boolean
  early_bird_price: number | null
  sibling_discount_enabled: boolean
  sibling_discount_percent: number | null
  training_group_id: string | null
  schedule: ScheduleDay[] | null
}

type Props = {
  camp: EditableCamp
  bookedCount: number
  trainingGroups: { id: string; name: string }[]
  onClose: () => void
  // Phase 2A — when false, dates + schedule stay locked (Phase 1A behaviour).
  structuralEnabled?: boolean
}

const inputCls =
  'w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 placeholder:text-white/30'
const lockedCls =
  'w-full bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white/40 cursor-not-allowed select-none'

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Today as 'YYYY-MM-DD' in UTC, matching the UTC-only guard in camps-edit.
function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function cloneSchedule(s: ScheduleDay[] | null | undefined): ScheduleDay[] {
  if (!Array.isArray(s)) return []
  return s.map((d) => ({ day: d.day, date: d.date, activities: [...(d.activities || [])] }))
}

export default function CampEditForm({ camp, bookedCount, trainingGroups, onClose, structuralEnabled = false }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Safe, editable fields (Phase 1A).
  const [name, setName] = useState(camp.name || '')
  const [description, setDescription] = useState(camp.description || '')
  const [location, setLocation] = useState(camp.location || '')
  const [ageGroup, setAgeGroup] = useState(camp.age_group || '')
  const [dailyStartTime, setDailyStartTime] = useState(camp.daily_start_time || '')
  const [dailyEndTime, setDailyEndTime] = useState(camp.daily_end_time || '')
  const [trainingGroupId, setTrainingGroupId] = useState(camp.training_group_id || '')
  const [imageUrl, setImageUrl] = useState(camp.image_url || '')
  const [whatToBring, setWhatToBring] = useState(camp.what_to_bring || '')
  const [maxCapacity, setMaxCapacity] = useState(camp.max_capacity != null ? String(camp.max_capacity) : '30')
  const [isPublished, setIsPublished] = useState(camp.is_published)

  // Additive structural state (Phase 2A).
  const origSchedule = cloneSchedule(camp.schedule)
  // Per original date → how many original activities it had (those are locked).
  const origActivityCount = new Map<string, number>()
  for (const d of origSchedule) origActivityCount.set(d.date, (d.activities || []).length)
  const origDates = new Set(origSchedule.map((d) => d.date))

  const [endDate, setEndDate] = useState(camp.end_date)
  const [schedule, setSchedule] = useState<ScheduleDay[]>(cloneSchedule(camp.schedule))
  const [showImpact, setShowImpact] = useState(false)

  const capValue = parseInt(maxCapacity, 10)
  const capError = maxCapacity ? capacityError(capValue, bookedCount) : null

  // Structural change detection + guard.
  const structuralChanged =
    structuralEnabled &&
    (endDate !== camp.end_date || JSON.stringify(schedule) !== JSON.stringify(origSchedule))
  const additiveErr =
    structuralEnabled && structuralChanged
      ? additiveEditError(
          { start_date: camp.start_date, end_date: camp.end_date, schedule: origSchedule },
          { start_date: camp.start_date, end_date: endDate, schedule },
          todayISO(),
        )
      : null
  // Is the whole camp still un-started? (controls whether structural UI is live)
  const startedErr =
    structuralEnabled
      ? additiveEditError(
          { start_date: camp.start_date, end_date: camp.end_date, schedule: origSchedule },
          { start_date: camp.start_date, end_date: camp.end_date, schedule: origSchedule },
          todayISO(),
        )
      : null
  const campStarted = startedErr != null

  // Impact figures.
  const origDays = campDayCount(camp.start_date, camp.end_date)
  const nextDays = campDayCount(camp.start_date, endDate)
  const addedDays = Math.max(0, nextDays - origDays)
  const origActivityTotal = origSchedule.reduce((n, d) => n + (d.activities || []).length, 0)
  const nextActivityTotal = schedule.reduce((n, d) => n + (d.activities || []).length, 0)
  const addedActivities = Math.max(0, nextActivityTotal - origActivityTotal)
  const addedDates = schedule.filter((d) => !origDates.has(d.date)).map((d) => d.date)

  // ── Schedule editing (append-only) ──
  const handleGenerateNewDays = () => {
    // Append stub days for any date in (origEnd+1 .. endDate) not already present.
    const have = new Set(schedule.map((d) => d.date))
    const fresh = generateScheduleDays(camp.end_date, endDate).filter(
      (d) => d.date !== camp.end_date && !have.has(d.date),
    )
    if (fresh.length) setSchedule((prev) => [...prev, ...fresh])
  }
  const addActivity = (dayIdx: number) =>
    setSchedule((prev) => prev.map((d, i) => (i === dayIdx ? { ...d, activities: [...d.activities, ''] } : d)))
  const updateActivity = (dayIdx: number, actIdx: number, val: string) =>
    setSchedule((prev) =>
      prev.map((d, i) =>
        i === dayIdx ? { ...d, activities: d.activities.map((a, j) => (j === actIdx ? val : a)) } : d,
      ),
    )
  // Removal is permitted ONLY for activities added this session (index beyond the
  // original count for that date). Original activities can never be removed.
  const removeActivity = (dayIdx: number, actIdx: number) =>
    setSchedule((prev) =>
      prev.map((d, i) =>
        i === dayIdx ? { ...d, activities: d.activities.filter((_, j) => j !== actIdx) } : d,
      ),
    )

  const buildPayload = () => {
    // Safe allowlist (Phase 1A) — never includes dates/price/schedule.
    const safe = pickSafeCampFields({
      name: name.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      age_group: ageGroup.trim() || null,
      daily_start_time: dailyStartTime || null,
      daily_end_time: dailyEndTime || null,
      training_group_id: trainingGroupId || null,
      image_url: imageUrl.trim() || null,
      what_to_bring: whatToBring.trim() || null,
      max_capacity: capValue,
      is_published: isPublished,
    })
    // Additive allowlist (Phase 2A) — only end_date/schedule, only when a
    // structural change is staged and the guard passes.
    if (structuralEnabled && structuralChanged && !additiveErr) {
      const additive = pickAdditiveCampFields({
        end_date: endDate,
        schedule: schedule.map((d) => ({ ...d, activities: d.activities.filter((a) => a.trim() !== '') })),
      })
      return { ...safe, ...additive }
    }
    return safe
  }

  const doSave = async () => {
    setShowImpact(false)
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = buildPayload()
      const { error: updErr } = await supabase.from('camps').update(payload).eq('id', camp.id)
      if (updErr) {
        setError('Error saving changes: ' + updErr.message)
      } else {
        onClose()
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    setError('')
    if (!name.trim()) {
      setError('Camp name is required.')
      return
    }
    if (capError) {
      setError(capError)
      return
    }
    if (structuralEnabled && structuralChanged && additiveErr) {
      setError(additiveErr)
      return
    }
    // Show the impact summary before a structural change on a booked camp.
    if (structuralEnabled && structuralChanged && bookedCount > 0) {
      setShowImpact(true)
      return
    }
    await doSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[120] flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-[#1e1e1e]">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit Camp</h2>
            <p className="text-xs text-[#888] mt-0.5 truncate max-w-[24rem]">{camp.name}</p>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-white/90 text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Booked-families warning */}
          {bookedCount > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3">
              <p className="text-sm text-amber-300 font-medium">
                {bookedCount} {bookedCount === 1 ? 'family has' : 'families have'} booked this camp.
              </p>
              <p className="text-xs text-amber-200/70 mt-0.5">
                Your changes will be visible to them.{' '}
                {structuralEnabled
                  ? 'Dates can only be extended (never shortened); price stays locked.'
                  : 'Price and dates are locked to protect their bookings.'}
              </p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">Camp Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
          </div>

          {/* Locked / additive: dates + price */}
          <div className="rounded-lg border border-dashed border-[#2a2a2a] p-3 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40 flex items-center gap-1.5">
              <span aria-hidden>&#128274;</span>
              {structuralEnabled ? 'Start date & price stay locked' : 'Locked — editable in a future update'}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">Start Date</label>
                <div className={lockedCls}>{formatDate(camp.start_date)}</div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">End Date</label>
                {structuralEnabled && !campStarted ? (
                  <input
                    type="date"
                    value={endDate}
                    min={camp.end_date}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`${inputCls} ${additiveErr ? 'border-rose-500/60 focus:ring-rose-500/40' : ''}`}
                  />
                ) : (
                  <div className={lockedCls}>{formatDate(camp.end_date)}</div>
                )}
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Price</label>
                <div className={lockedCls}>{camp.price != null ? `£${Number(camp.price).toFixed(0)}` : '—'}</div>
              </div>
            </div>
            {structuralEnabled && campStarted && (
              <p className="text-[11px] text-white/30">This camp has started — dates &amp; schedule are locked.</p>
            )}
            {structuralEnabled && !campStarted && (
              <p className="text-[11px] text-white/40">
                You can only extend the end date — never bring it forward. No charge is made; existing bookings simply
                cover the longer camp.
              </p>
            )}
            {additiveErr && <p className="text-xs text-rose-400">{additiveErr}</p>}
          </div>

          {/* Additive schedule (Phase 2A) */}
          {structuralEnabled && !campStarted && (
            <div className="rounded-lg border border-[#1e1e1e] p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Daily Schedule</h3>
                {endDate > camp.end_date && (
                  <button
                    type="button"
                    onClick={handleGenerateNewDays}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                  >
                    Add entries for new days
                  </button>
                )}
              </div>
              <p className="text-[11px] text-white/40">
                Add-only: existing days and activities are locked. You can append new activities or add the new days.
              </p>
              {schedule.length === 0 && <p className="text-xs text-white/40">No schedule entries yet.</p>}
              <div className="space-y-3">
                {schedule.map((day, dayIdx) => {
                  const lockedCount = origActivityCount.get(day.date) ?? 0
                  const isNewDay = !origDates.has(day.date)
                  return (
                    <div key={`${day.date}-${dayIdx}`} className="border border-[#1e1e1e] rounded-lg p-3">
                      <h4 className="text-xs font-medium text-white mb-2">
                        {day.date ? formatDate(day.date) : day.day}
                        {isNewDay && <span className="ml-2 text-[10px] text-accent">new</span>}
                      </h4>
                      <div className="space-y-1.5">
                        {day.activities.map((activity, actIdx) => {
                          const locked = actIdx < lockedCount
                          return (
                            <div key={actIdx} className="flex items-center gap-2">
                              {locked ? (
                                <div className={`flex-1 ${lockedCls} !py-1.5 text-xs`}>{activity}</div>
                              ) : (
                                <input
                                  type="text"
                                  value={activity}
                                  onChange={(e) => updateActivity(dayIdx, actIdx, e.target.value)}
                                  placeholder="e.g. 09:00 - Warm Up & Skills"
                                  className={`flex-1 ${inputCls} !py-1.5 text-xs`}
                                />
                              )}
                              {!locked && (
                                <button
                                  type="button"
                                  onClick={() => removeActivity(dayIdx, actIdx)}
                                  className="text-rose-400 hover:text-rose-600 text-sm px-1.5"
                                  aria-label="Remove new activity"
                                >
                                  &times;
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => addActivity(dayIdx)}
                        className="mt-2 text-xs text-accent hover:underline"
                      >
                        + Add activity
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Times (safe) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Daily Start Time</label>
              <input type="time" value={dailyStartTime} onChange={(e) => setDailyStartTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Daily End Time</label>
              <input type="time" value={dailyEndTime} onChange={(e) => setDailyEndTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Location, Age Group (safe) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Location / Venue</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. King George V Playing Fields" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Age Group</label>
              <input type="text" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} placeholder="e.g. Ages 5-12" className={inputCls} />
            </div>
          </div>

          {/* Capacity (safe, guarded) */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">Max Capacity</label>
            <input
              type="number"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              min="1"
              className={`${inputCls} ${capError ? 'border-rose-500/60 focus:ring-rose-500/40' : ''}`}
            />
            {capError ? (
              <p className="text-xs text-rose-400 mt-1">{capError}</p>
            ) : (
              bookedCount > 0 && (
                <p className="text-xs text-white/40 mt-1">
                  {bookedCount} booked &middot; can increase freely, or reduce no lower than {bookedCount}.
                </p>
              )
            )}
          </div>

          {/* Training group / coach (safe) */}
          {trainingGroups.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-white mb-1">Linked Class / Coach</label>
              <select value={trainingGroupId} onChange={(e) => setTrainingGroupId(e.target.value)} className={inputCls}>
                <option value="">None</option>
                {trainingGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cover photo (safe) */}
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">Cover Photo</label>
            <FileUpload
              bucketName="coaching"
              folder="camp-covers"
              accept="image/*"
              currentUrl={imageUrl}
              onUpload={(url) => setImageUrl(url)}
              label="Upload a cover photo for this camp"
            />
          </div>

          {/* What to bring (safe) */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">What to Bring</label>
            <textarea value={whatToBring} onChange={(e) => setWhatToBring(e.target.value)} rows={3} placeholder="e.g. Football boots, shin pads, water bottle, packed lunch..." className={inputCls} />
          </div>

          {/* Published (safe) */}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="rounded border-[#1e1e1e]" />
            <span className="text-white">Published (visible on booking page)</span>
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#1e1e1e]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#888] hover:text-white/90 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !!capError || !!additiveErr}
            className="px-6 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Impact summary — shown before a structural change on a booked camp */}
      {showImpact && (
        <div className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">You&rsquo;re growing this camp</h3>
            <ul className="text-sm text-white/80 space-y-1.5">
              <li>• Affects <span className="font-semibold text-white">{bookedCount}</span> booked {bookedCount === 1 ? 'family' : 'families'}</li>
              <li>• Camp grows: <span className="font-semibold text-white">{origDays} → {nextDays}</span> day{nextDays !== 1 ? 's' : ''}</li>
              {addedDates.length > 0 && (
                <li>• New day{addedDates.length !== 1 ? 's' : ''}: {addedDates.map((d) => formatDate(d)).join(', ')}</li>
              )}
              {addedActivities > 0 && <li>• Added activities: <span className="font-semibold text-white">{addedActivities}</span></li>}
            </ul>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2">
              <p className="text-xs text-emerald-300">No additional charge will be made. No refunds are required.</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={() => setShowImpact(false)} className="px-4 py-2 text-sm font-medium text-[#888] hover:text-white/90">
                Cancel
              </button>
              <button onClick={doSave} disabled={saving} className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? 'Saving...' : 'Confirm & save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
