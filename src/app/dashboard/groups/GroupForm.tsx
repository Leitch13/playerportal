'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUpload from '@/components/FileUpload'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const AGE_GROUPS = ['U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U18', 'Adults', 'Mixed']

const CLASS_TYPES = [
  { value: 'group', label: 'Group Session' },
  { value: 'small_group', label: 'Small Group (2-6 players)' },
  { value: '1-2-1', label: '1-2-1 (Individual)' },
  { value: '2-1', label: '2-1 (Pair Training)' },
  { value: 'gk', label: 'Goalkeeper Training' },
  { value: 'soccer_tots', label: 'Soccer Tots (Ages 3-5)' },
  { value: 'academy', label: 'Academy Programme' },
  { value: 'accelerator', label: 'Accelerator Programme' },
  { value: 'elite', label: 'Elite Development' },
  { value: 'camp', label: 'Football Camp' },
  { value: 'trial', label: 'Trial Session' },
  { value: 'girls', label: 'Girls Only' },
  { value: 'adults', label: 'Adult Session' },
  { value: 'intensity', label: 'Intensity Training' },
]

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 border-b border-[#1e1e1e] mb-4 group"
    >
      <h3 className="text-sm font-bold uppercase tracking-wider text-[#888] group-hover:text-white transition-colors">{title}</h3>
      <svg
        className={`w-4 h-4 text-[#888] transition-transform ${open ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

export default function GroupForm({
  coaches,
  orgId,
  editGroup,
  onClose,
  terms = [],
}: {
  coaches: { id: string; full_name: string }[]
  orgId: string
  editGroup?: {
    id: string
    name: string
    day_of_week: string | null
    time_slot: string | null
    end_time: string | null
    location: string | null
    coach_id: string | null
    max_capacity: number | null
    age_group: string | null
    description: string | null
    price_per_session: number | null
    trial_price?: number | null
    class_type?: string | null
    short_description?: string | null
    long_description?: string | null
    benefits?: string[] | null
    suitable_for?: string | null
    what_to_bring?: string | null
    image_url?: string | null
    is_featured?: boolean | null
    // Phase 1B — optional link to public.terms.
    term_id?: string | null
  }
  onClose?: () => void
  // Phase 1B — terms available for assignment in the dropdown.
  terms?: { id: string; name: string; start_date: string; end_date: string }[]
}) {
  const router = useRouter()
  const isEdit = !!editGroup
  const [open, setOpen] = useState(isEdit)

  // Basic Info
  const [name, setName] = useState(editGroup?.name || '')
  const [classType, setClassType] = useState(editGroup?.class_type || 'group')
  const [ageGroup, setAgeGroup] = useState(editGroup?.age_group || '')
  const [isFeatured, setIsFeatured] = useState(editGroup?.is_featured || false)

  // Description & Details
  const [shortDescription, setShortDescription] = useState(editGroup?.short_description || '')
  const [longDescription, setLongDescription] = useState(editGroup?.long_description || editGroup?.description || '')
  const [benefits, setBenefits] = useState<string[]>(editGroup?.benefits || [])
  const [newBenefit, setNewBenefit] = useState('')
  const [suitableFor, setSuitableFor] = useState(editGroup?.suitable_for || '')
  const [whatToBring, setWhatToBring] = useState(editGroup?.what_to_bring || '')
  const [imageUrl, setImageUrl] = useState(editGroup?.image_url || '')

  // Schedule
  const [dayOfWeek, setDayOfWeek] = useState(editGroup?.day_of_week || '')
  const [startTime, setStartTime] = useState(editGroup?.time_slot || '')
  const [endTime, setEndTime] = useState(editGroup?.end_time || '')
  const [location, setLocation] = useState(editGroup?.location || '')
  const [coachId, setCoachId] = useState(editGroup?.coach_id || '')
  // Phase 1B — term assignment.
  const [termId, setTermId] = useState(editGroup?.term_id || '')

  // Pricing & Capacity
  const [maxCapacity, setMaxCapacity] = useState(editGroup?.max_capacity?.toString() || '20')
  const [pricePerSession, setPricePerSession] = useState(editGroup?.price_per_session?.toString() || '')
  const [trialPrice, setTrialPrice] = useState(editGroup?.trial_price?.toString() || '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Collapsible sections
  const [sections, setSections] = useState({
    basic: true,
    details: isEdit,
    pricing: true,
    schedule: true,
  })

  function toggleSection(key: keyof typeof sections) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function addBenefit() {
    const trimmed = newBenefit.trim()
    if (trimmed && !benefits.includes(trimmed)) {
      setBenefits([...benefits, trimmed])
      setNewBenefit('')
    }
  }

  function removeBenefit(index: number) {
    setBenefits(benefits.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const timeSlot = startTime && endTime ? `${startTime}\u2013${endTime}` : startTime || null

    const data = {
      organisation_id: orgId,
      name,
      class_type: classType,
      day_of_week: dayOfWeek || null,
      time_slot: timeSlot,
      location: location || null,
      coach_id: coachId || null,
      max_capacity: maxCapacity ? parseInt(maxCapacity) : 20,
      age_group: ageGroup || null,
      description: shortDescription || longDescription || null,
      short_description: shortDescription || null,
      long_description: longDescription || null,
      benefits: benefits.length > 0 ? benefits : null,
      suitable_for: suitableFor || null,
      what_to_bring: whatToBring || null,
      image_url: imageUrl || null,
      is_featured: isFeatured,
      price_per_session: pricePerSession ? parseFloat(pricePerSession) : null,
      trial_price: trialPrice ? parseFloat(trialPrice) : null,
      // Phase 1B — link class to a term ("" → null for "No term").
      term_id: termId || null,
    }

    if (isEdit && editGroup) {
      const { error: updateError } = await supabase
        .from('training_groups')
        .update(data)
        .eq('id', editGroup.id)

      if (updateError) {
        setError(updateError.message)
      } else {
        onClose?.()
        router.refresh()
      }
    } else {
      const { error: insertError } = await supabase.from('training_groups').insert(data)

      if (insertError) {
        setError(insertError.message)
      } else {
        setOpen(false)
        setName('')
        setClassType('group')
        setDayOfWeek('')
        setStartTime('')
        setEndTime('')
        setLocation('')
        setCoachId('')
        setMaxCapacity('20')
        setAgeGroup('')
        setShortDescription('')
        setLongDescription('')
        setBenefits([])
        setSuitableFor('')
        setWhatToBring('')
        setImageUrl('')
        setIsFeatured(false)
        setPricePerSession('')
        setTermId('')
        router.refresh()
      }
    }
    setLoading(false)
  }

  if (!open && !isEdit) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all hover:shadow-md flex items-center gap-2"
      >
        <span className="text-lg">+</span> Create Class
      </button>
    )
  }

  const inputCls = 'w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-white/30'

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold">{isEdit ? 'Edit Class' : 'Create New Class'}</h2>
        <button
          onClick={() => { setOpen(false); onClose?.() }}
          className="text-[#888] hover:text-white text-xl leading-none"
        >
          &times;
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        {/* ── Basic Info ── */}
        <SectionHeader title="Basic Info" open={sections.basic} onToggle={() => toggleSection('basic')} />
        {sections.basic && (
          <div className="space-y-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70 mb-1.5">Class Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. U10 Development Squad"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Age Group</label>
                <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className={inputCls}>
                  <option value="">Select...</option>
                  {AGE_GROUPS.map((ag) => (
                    <option key={ag} value={ag}>{ag}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Class Type</label>
                <select value={classType} onChange={(e) => setClassType(e.target.value)} className={inputCls}>
                  {CLASS_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    className={`relative w-11 h-6 rounded-full transition-colors ${isFeatured ? 'bg-primary' : 'bg-[#2a2a2a]'}`}
                    onClick={() => setIsFeatured(!isFeatured)}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isFeatured ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm font-medium">Featured Class</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── Description & Details ── */}
        <SectionHeader title="Description & Details" open={sections.details} onToggle={() => toggleSection('details')} />
        {sections.details && (
          <div className="space-y-4 pb-4">
            {/* Short Description */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Short Description</label>
              <div className="relative">
                <textarea
                  value={shortDescription}
                  onChange={(e) => {
                    if (e.target.value.length <= 150) setShortDescription(e.target.value)
                  }}
                  placeholder="One-liner shown on class cards (max 150 chars)"
                  rows={2}
                  className={inputCls + ' resize-none'}
                />
                <span className={`absolute bottom-2 right-3 text-[10px] ${shortDescription.length >= 140 ? 'text-red-400' : 'text-[#888]'}`}>
                  {shortDescription.length}/150
                </span>
              </div>
            </div>

            {/* Full Description */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Full Description</label>
              <textarea
                value={longDescription}
                onChange={(e) => setLongDescription(e.target.value)}
                placeholder="Detailed description shown on the class detail page"
                rows={5}
                className={inputCls + ' resize-none'}
              />
            </div>

            {/* Key Benefits */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Key Benefits</label>
              <div className="space-y-2">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm bg-[#1a1a1a] px-3 py-2 rounded-lg">{b}</span>
                    <button
                      type="button"
                      onClick={() => removeBenefit(i)}
                      className="text-red-400 hover:text-red-600 text-sm px-2"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBenefit}
                    onChange={(e) => setNewBenefit(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBenefit() } }}
                    placeholder="Add a benefit..."
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={addBenefit}
                    className="px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-colors whitespace-nowrap"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* Suitable For */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Suitable For</label>
              <input
                type="text"
                value={suitableFor}
                onChange={(e) => setSuitableFor(e.target.value)}
                placeholder="e.g. Players aged 8-12 looking to improve technical skills"
                className={inputCls}
              />
            </div>

            {/* What to Bring */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">What to Bring</label>
              <input
                type="text"
                value={whatToBring}
                onChange={(e) => setWhatToBring(e.target.value)}
                placeholder="e.g. Football boots, water bottle, shin pads"
                className={inputCls}
              />
            </div>

            {/* Cover Image */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Cover Photo</label>
              <FileUpload
                bucketName="coaching"
                folder="class-covers"
                accept="image/*"
                currentUrl={imageUrl}
                onUpload={(url) => setImageUrl(url)}
                label="Upload a cover photo for this class"
              />
            </div>
          </div>
        )}

        {/* ── Pricing & Capacity ── */}
        <SectionHeader title="Pricing & Capacity" open={sections.pricing} onToggle={() => toggleSection('pricing')} />
        {sections.pricing && (
          <div className="space-y-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Price Per Session (optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]">&pound;</span>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    value={pricePerSession}
                    onChange={(e) => setPricePerSession(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-white/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Max Capacity *</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(e.target.value)}
                    required
                    placeholder="20"
                    className={inputCls}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#888]">players</span>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Trial Session Price (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]">&pound;</span>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    value={trialPrice}
                    onChange={(e) => setTrialPrice(e.target.value)}
                    placeholder="Leave blank for free trial"
                    className="w-full pl-7 pr-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-white/30"
                  />
                </div>
                <p className="mt-1.5 text-xs text-white/40">
                  Set a price to offer a paid one-off trial (good for 1-2-1s). Leave blank for free trials.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Schedule ── */}
        <SectionHeader title="Schedule" open={sections.schedule} onToggle={() => toggleSection('schedule')} />
        {sections.schedule && (
          <div className="space-y-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Day *</label>
                <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} required className={inputCls}>
                  <option value="">Select day...</option>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Start Time</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">End Time</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Main Pitch"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Coach</label>
                <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className={inputCls}>
                  <option value="">Select coach...</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Phase 1B — Term dropdown */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Term</label>
              <select
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className={inputCls}
              >
                <option value="">No term — runs all year</option>
                {terms.map((t) => {
                  const start = new Date(t.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  const end = new Date(t.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({start} – {end})
                    </option>
                  )
                })}
              </select>
              {termId && (() => {
                const selected = terms.find((t) => t.id === termId)
                if (!selected) return null
                const start = new Date(selected.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                const end = new Date(selected.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                return (
                  <p className="text-xs text-white/50 mt-1.5">Runs: {start} – {end}</p>
                )
              })()}
              <p className="text-[11px] text-white/40 mt-1">
                Optional. When set, parents see the term name and dates on the
                booking page, dashboard, and confirmation emails.
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Class'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onClose?.() }}
            className="px-6 py-2.5 border border-[#1e1e1e] rounded-xl text-sm font-medium hover:bg-[#1e1e1e] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
