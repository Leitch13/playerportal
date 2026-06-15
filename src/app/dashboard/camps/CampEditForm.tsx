'use client'

// Camps Safe Edit — Phase 1A.
//
// A lean, dedicated edit modal — deliberately NOT a mode bolted onto the big
// create form (CampForm). Keeping it separate means the create flow stays
// byte-identical and this component can only ever write the safe allowlist.
//
// Safe fields are editable. Dangerous money/structure fields (price, dates,
// early-bird / sibling pricing, daily schedule) are rendered READ-ONLY with a
// "future update" note. Save goes through pickSafeCampFields() →
// camps.update(...).eq('id') — no Stripe, no booking rows touched.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FileUpload from '@/components/FileUpload'
import { pickSafeCampFields, capacityError } from '@/lib/camps-edit'

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
}

type Props = {
  camp: EditableCamp
  bookedCount: number
  trainingGroups: { id: string; name: string }[]
  onClose: () => void
}

const inputCls =
  'w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 placeholder:text-white/30'
const lockedCls =
  'w-full bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white/40 cursor-not-allowed select-none'

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CampEditForm({ camp, bookedCount, trainingGroups, onClose }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Safe, editable fields only.
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

  const capValue = parseInt(maxCapacity, 10)
  const capError = maxCapacity ? capacityError(capValue, bookedCount) : null

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
    setSaving(true)
    try {
      const supabase = createClient()
      // pickSafeCampFields hard-filters to the allowlist — price, dates,
      // schedule, early-bird and sibling pricing can never leak into the update.
      const payload = pickSafeCampFields({
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
                Your changes will be visible to them. Price and dates are locked to protect their bookings.
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

          {/* Locked: dates + price (Phase 2) */}
          <div className="rounded-lg border border-dashed border-[#2a2a2a] p-3 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40 flex items-center gap-1.5">
              <span aria-hidden>&#128274;</span> Locked &mdash; editable in a future update
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">Start Date</label>
                <div className={lockedCls}>{formatDate(camp.start_date)}</div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">End Date</label>
                <div className={lockedCls}>{formatDate(camp.end_date)}</div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Price</label>
                <div className={lockedCls}>{camp.price != null ? `£${Number(camp.price).toFixed(0)}` : '—'}</div>
              </div>
            </div>
            {(camp.early_bird_price != null || camp.sibling_discount_enabled) && (
              <p className="text-[11px] text-white/30">
                Early-bird and sibling pricing are also locked here — they affect paid value.
              </p>
            )}
          </div>

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
            disabled={saving || !name.trim() || !!capError}
            className="px-6 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
