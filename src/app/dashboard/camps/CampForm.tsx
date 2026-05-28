'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FileUpload from '@/components/FileUpload'

type ScheduleDay = {
  day: string
  date: string
  activities: string[]
}

type CampData = {
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
  schedule: ScheduleDay[]
  is_published: boolean
  early_bird_price: number | null
  early_bird_deadline: string | null
  sibling_discount_enabled: boolean
  sibling_discount_percent: number | null
  collect_medical_info: boolean
  require_consent: boolean
}

type Props = {
  orgId: string
  orgSlug?: string
  trainingGroups: { id: string; name: string }[]
  existingCamps?: CampData[]
}

const DEFAULT_ACTIVITIES = [
  '09:00 - Warm Up & Skills',
  '10:30 - Small-Sided Games',
  '12:00 - Lunch',
  '13:00 - Tournaments',
  '14:30 - Awards & Cool Down',
]

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function generateScheduleDays(startDate: string, endDate: string): ScheduleDay[] {
  if (!startDate || !endDate) return []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const days: ScheduleDay[] = []
  const current = new Date(start)
  while (current <= end) {
    days.push({
      day: DAYS_OF_WEEK[current.getDay()],
      date: current.toISOString().split('T')[0],
      activities: [],
    })
    current.setDate(current.getDate() + 1)
  }
  return days
}

export default function CampForm({ orgId, orgSlug, trainingGroups, existingCamps }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dailyStartTime, setDailyStartTime] = useState('09:00')
  const [dailyEndTime, setDailyEndTime] = useState('15:00')
  const [location, setLocation] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [price, setPrice] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('30')
  const [imageUrl, setImageUrl] = useState('')
  const [whatToBring, setWhatToBring] = useState('')
  const [trainingGroupId, setTrainingGroupId] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [schedule, setSchedule] = useState<ScheduleDay[]>([])

  // New fields
  const [earlyBirdPrice, setEarlyBirdPrice] = useState('')
  const [earlyBirdDeadline, setEarlyBirdDeadline] = useState('')
  const [siblingDiscountEnabled, setSiblingDiscountEnabled] = useState(false)
  const [siblingDiscountPercent, setSiblingDiscountPercent] = useState('10')
  const [collectMedicalInfo, setCollectMedicalInfo] = useState(false)
  const [requireConsent, setRequireConsent] = useState(false)

  const duration =
    startDate && endDate
      ? Math.round(
          (new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : 0

  const handleGenerateDays = () => {
    setSchedule(generateScheduleDays(startDate, endDate))
  }

  const handleUseTemplate = () => {
    const days = generateScheduleDays(startDate, endDate)
    setSchedule(days.map((d) => ({ ...d, activities: [...DEFAULT_ACTIVITIES] })))
  }

  const addActivity = (dayIdx: number) => {
    setSchedule((prev) =>
      prev.map((d, i) =>
        i === dayIdx ? { ...d, activities: [...d.activities, ''] } : d
      )
    )
  }

  const updateActivity = (dayIdx: number, actIdx: number, value: string) => {
    setSchedule((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? { ...d, activities: d.activities.map((a, j) => (j === actIdx ? value : a)) }
          : d
      )
    )
  }

  const removeActivity = (dayIdx: number, actIdx: number) => {
    setSchedule((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? { ...d, activities: d.activities.filter((_, j) => j !== actIdx) }
          : d
      )
    )
  }

  const handleDuplicateFrom = (camp: CampData) => {
    setName(camp.name + ' (Copy)')
    setDescription(camp.description || '')
    setDailyStartTime(camp.daily_start_time || '09:00')
    setDailyEndTime(camp.daily_end_time || '15:00')
    setLocation(camp.location || '')
    setAgeGroup(camp.age_group || '')
    setPrice(camp.price != null ? String(camp.price) : '')
    setMaxCapacity(camp.max_capacity ? String(camp.max_capacity) : '30')
    setImageUrl(camp.image_url || '')
    setWhatToBring(camp.what_to_bring || '')
    setEarlyBirdPrice(camp.early_bird_price != null ? String(camp.early_bird_price) : '')
    setEarlyBirdDeadline(camp.early_bird_deadline || '')
    setSiblingDiscountEnabled(camp.sibling_discount_enabled || false)
    setSiblingDiscountPercent(camp.sibling_discount_percent != null ? String(camp.sibling_discount_percent) : '10')
    setCollectMedicalInfo(camp.collect_medical_info || false)
    setRequireConsent(camp.require_consent || false)
    if (Array.isArray(camp.schedule) && camp.schedule.length > 0) {
      setSchedule(camp.schedule)
    }
  }

  const handleSave = async (publish?: boolean) => {
    if (!name.trim() || !startDate || !endDate) return
    setSaving(true)
    try {
      const supabase = createClient()
      const campData = {
        organisation_id: orgId,
        training_group_id: trainingGroupId || null,
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        daily_start_time: dailyStartTime,
        daily_end_time: dailyEndTime,
        location: location.trim() || null,
        age_group: ageGroup.trim() || null,
        price: price ? parseFloat(price) : null,
        max_capacity: maxCapacity ? parseInt(maxCapacity) : 30,
        image_url: imageUrl.trim() || null,
        what_to_bring: whatToBring.trim() || null,
        schedule: schedule.filter((d) => d.activities.length > 0),
        is_published: publish !== undefined ? publish : isPublished,
        early_bird_price: earlyBirdPrice ? parseFloat(earlyBirdPrice) : null,
        early_bird_deadline: earlyBirdDeadline || null,
        sibling_discount_enabled: siblingDiscountEnabled,
        sibling_discount_percent: siblingDiscountEnabled ? parseInt(siblingDiscountPercent) : null,
        collect_medical_info: collectMedicalInfo,
        require_consent: requireConsent,
      }

      const { data, error } = await supabase
        .from('camps')
        .insert(campData)
        .select('id')
        .single()

      if (error) {
        alert('Error saving camp: ' + error.message)
      } else if (data) {
        if (publish && orgSlug) {
          const link = `${window.location.origin}/book/${orgSlug}/camps/${data.id}`
          setShareLink(link)
        } else {
          setOpen(false)
          resetForm()
          router.refresh()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const handlePublishAndShare = () => handleSave(true)

  const handleCopyLink = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink)
      alert('Booking link copied to clipboard!')
      setOpen(false)
      resetForm()
      setShareLink('')
      router.refresh()
    }
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setStartDate('')
    setEndDate('')
    setDailyStartTime('09:00')
    setDailyEndTime('15:00')
    setLocation('')
    setAgeGroup('')
    setPrice('')
    setMaxCapacity('30')
    setImageUrl('')
    setWhatToBring('')
    setTrainingGroupId('')
    setIsPublished(true)
    setSchedule([])
    setEarlyBirdPrice('')
    setEarlyBirdDeadline('')
    setSiblingDiscountEnabled(false)
    setSiblingDiscountPercent('10')
    setCollectMedicalInfo(false)
    setRequireConsent(false)
    setShareLink('')
    setShowPreview(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Create Camp
      </button>
    )
  }

  // Share link success screen
  if (shareLink) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] w-full max-w-md p-8 text-center space-y-4">
          <div className="text-4xl">&#9989;</div>
          <h2 className="text-lg font-bold text-white">Camp Published!</h2>
          <p className="text-sm text-[#888]">Share this link with parents to start collecting bookings.</p>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-xs text-accent break-all">
            {shareLink}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCopyLink}
              className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90"
            >
              Copy Link
            </button>
            <button
              onClick={() => { setOpen(false); resetForm(); router.refresh() }}
              className="flex-1 px-4 py-2.5 border border-[#2a2a2a] text-[#888] rounded-lg text-sm font-medium hover:text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 placeholder:text-white/30'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] w-full max-w-4xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-[#1e1e1e]">
          <h2 className="text-lg font-semibold text-white">Create Camp</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#2a2a2a] text-[#888] hover:text-white hover:bg-[#1e1e1e] transition-colors"
            >
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
            <button
              onClick={() => { setOpen(false); resetForm() }}
              className="text-[#888] hover:text-white/90 text-xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        <div className={`flex ${showPreview ? 'divide-x divide-[#1e1e1e]' : ''}`}>
          {/* Form column */}
          <div className={`p-6 space-y-5 max-h-[70vh] overflow-y-auto ${showPreview ? 'w-1/2' : 'w-full'}`}>
            {/* Duplicate from last camp */}
            {existingCamps && existingCamps.length > 0 && (
              <div className="rounded-lg border border-dashed border-[#2a2a2a] p-3">
                <p className="text-xs text-[#888] mb-2">Duplicate from an existing camp:</p>
                <div className="flex flex-wrap gap-2">
                  {existingCamps.slice(0, 5).map((ec) => (
                    <button
                      key={ec.id}
                      type="button"
                      onClick={() => handleDuplicateFrom(ec)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-white/60 hover:text-white hover:border-accent/50 transition-colors truncate max-w-[200px]"
                    >
                      {ec.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">Camp Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Easter Football Camp"
                className={inputCls}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Tell parents what the camp is about..."
                className={inputCls}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">Start Date *</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">End Date *</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
              </div>
            </div>
            {duration > 0 && (
              <p className="text-xs text-[#888] -mt-3">{duration} day{duration !== 1 ? 's' : ''}</p>
            )}

            {/* Times */}
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

            {/* Location, Age Group */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">Location</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. King George V Playing Fields" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">Age Group</label>
                <input type="text" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} placeholder="e.g. Ages 5-12" className={inputCls} />
              </div>
            </div>

            {/* Pricing Section */}
            <div className="border-t border-[#1e1e1e] pt-5">
              <h3 className="text-sm font-semibold text-white mb-3">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Regular Price (&pound;)</label>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 120" min="0" step="0.01" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Max Capacity</label>
                  <input type="number" value={maxCapacity} onChange={(e) => setMaxCapacity(e.target.value)} min="1" className={inputCls} />
                </div>
              </div>

              {/* Early bird */}
              <div className="mt-4 space-y-3">
                <h4 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Early Bird Pricing</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Early Bird Price (&pound;)</label>
                    <input type="number" value={earlyBirdPrice} onChange={(e) => setEarlyBirdPrice(e.target.value)} placeholder="e.g. 99" min="0" step="0.01" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Deadline</label>
                    <input type="date" value={earlyBirdDeadline} onChange={(e) => setEarlyBirdDeadline(e.target.value)} className={inputCls} />
                  </div>
                </div>
                {earlyBirdPrice && price && (
                  <p className="text-xs text-green-400">
                    Parents save &pound;{(parseFloat(price) - parseFloat(earlyBirdPrice)).toFixed(0)} with early bird pricing
                  </p>
                )}
              </div>

              {/* Sibling discount */}
              <div className="mt-4 space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={siblingDiscountEnabled}
                    onChange={(e) => setSiblingDiscountEnabled(e.target.checked)}
                    className="rounded border-[#1e1e1e]"
                  />
                  <span className="text-white">Enable Sibling Discount</span>
                </label>
                {siblingDiscountEnabled && (
                  <div className="ml-6">
                    <label className="block text-xs text-[#888] mb-1">Discount Percentage</label>
                    <input
                      type="number"
                      value={siblingDiscountPercent}
                      onChange={(e) => setSiblingDiscountPercent(e.target.value)}
                      min="1"
                      max="100"
                      className="w-24 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                    <span className="text-xs text-[#888] ml-2">%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Data Collection */}
            <div className="border-t border-[#1e1e1e] pt-5">
              <h3 className="text-sm font-semibold text-white mb-3">Booking Options</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={collectMedicalInfo}
                    onChange={(e) => setCollectMedicalInfo(e.target.checked)}
                    className="rounded border-[#1e1e1e]"
                  />
                  <span className="text-white">Collect medical / allergy information</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireConsent}
                    onChange={(e) => setRequireConsent(e.target.checked)}
                    className="rounded border-[#1e1e1e]"
                  />
                  <span className="text-white">Require consent form / declaration</span>
                </label>
              </div>
            </div>

            {/* Training Group */}
            {trainingGroups.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-white mb-1">Link to Class (optional)</label>
                <select
                  value={trainingGroupId}
                  onChange={(e) => setTrainingGroupId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">None</option>
                  {trainingGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Cover Photo */}
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

            {/* What to Bring */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">What to Bring</label>
              <textarea
                value={whatToBring}
                onChange={(e) => setWhatToBring(e.target.value)}
                rows={3}
                placeholder="e.g. Football boots, shin pads, water bottle, packed lunch..."
                className={inputCls}
              />
            </div>

            {/* Published */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded border-[#1e1e1e]"
              />
              <span className="text-white">Published (visible on booking page)</span>
            </label>

            {/* Schedule Builder */}
            <div className="border-t border-[#1e1e1e] pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Daily Schedule</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateDays}
                    disabled={!startDate || !endDate}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#1e1e1e] text-[#888] hover:bg-[#1e1e1e] disabled:opacity-40 transition-colors"
                  >
                    Generate Days
                  </button>
                  <button
                    type="button"
                    onClick={handleUseTemplate}
                    disabled={!startDate || !endDate}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 transition-colors"
                  >
                    Use Template
                  </button>
                </div>
              </div>

              {schedule.length === 0 && (
                <p className="text-xs text-[#888]">
                  Set start and end dates, then click &quot;Generate Days&quot; or &quot;Use Template&quot;.
                </p>
              )}

              <div className="space-y-4">
                {schedule.map((day, dayIdx) => (
                  <div key={dayIdx} className="border border-[#1e1e1e] rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">
                      {day.day}{' '}
                      <span className="text-[#888] font-normal">
                        {new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </h4>
                    <div className="space-y-2">
                      {day.activities.map((activity, actIdx) => (
                        <div key={actIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={activity}
                            onChange={(e) => updateActivity(dayIdx, actIdx, e.target.value)}
                            placeholder="e.g. 09:00 - Warm Up & Skills"
                            className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 placeholder:text-white/30"
                          />
                          <button
                            type="button"
                            onClick={() => removeActivity(dayIdx, actIdx)}
                            className="text-red-400 hover:text-red-600 text-sm px-2"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addActivity(dayIdx)}
                      className="mt-2 text-xs text-accent hover:underline"
                    >
                      + Add Activity
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview column */}
          {showPreview && (
            <div className="w-1/2 p-6 max-h-[70vh] overflow-y-auto bg-[#0a0a0a]">
              <p className="text-xs text-[#888] uppercase tracking-wider mb-4">Preview (public booking page)</p>
              <div className="space-y-4">
                {/* Preview hero */}
                <div
                  className="rounded-xl p-6 text-white relative overflow-hidden"
                  style={
                    imageUrl
                      ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { background: 'linear-gradient(135deg, #065f46 0%, #4ecde6 100%)' }
                  }
                >
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold">{name || 'Camp Name'}</h3>
                    {startDate && endDate && (
                      <p className="text-sm text-white/70 mt-1">
                        {new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' - '}
                        {new Date(endDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Preview details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {location && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="text-white/40 uppercase">Location</div>
                      <div className="text-white font-medium mt-0.5">{location}</div>
                    </div>
                  )}
                  {ageGroup && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="text-white/40 uppercase">Age Group</div>
                      <div className="text-white font-medium mt-0.5">{ageGroup}</div>
                    </div>
                  )}
                  {price && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="text-white/40 uppercase">Price</div>
                      <div className="text-white font-medium mt-0.5">
                        {earlyBirdPrice ? (
                          <span>
                            <span className="text-accent">&pound;{earlyBirdPrice}</span>{' '}
                            <span className="line-through text-white/30">&pound;{price}</span>
                          </span>
                        ) : (
                          <>&pound;{price}</>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="text-white/40 uppercase">Capacity</div>
                    <div className="text-white font-medium mt-0.5">{maxCapacity} places</div>
                  </div>
                </div>

                {description && (
                  <div className="text-xs text-white/60 leading-relaxed">{description}</div>
                )}

                {/* Preview features */}
                <div className="space-y-1">
                  {siblingDiscountEnabled && (
                    <div className="text-xs text-green-400">&#10003; Sibling discount: {siblingDiscountPercent}% off</div>
                  )}
                  {collectMedicalInfo && (
                    <div className="text-xs text-blue-400">&#10003; Medical info collection</div>
                  )}
                  {requireConsent && (
                    <div className="text-xs text-amber-400">&#10003; Consent form required</div>
                  )}
                </div>

                {/* Preview CTA */}
                <div className="rounded-xl bg-accent/20 border border-accent/30 p-4 text-center">
                  <div className="text-lg font-bold text-white">
                    {price ? <>Book Camp &mdash; &pound;{earlyBirdPrice || price}</> : 'Book Camp'}
                  </div>
                  <p className="text-xs text-white/40 mt-1">Stripe Checkout</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-[#1e1e1e]">
          <button
            onClick={() => { setOpen(false); resetForm() }}
            className="px-4 py-2 text-sm font-medium text-[#888] hover:text-white/90 transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => handleSave()}
              disabled={saving || !name.trim() || !startDate || !endDate}
              className="px-6 py-2 border border-[#2a2a2a] text-white rounded-lg text-sm font-medium hover:bg-[#1e1e1e] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            {orgSlug && (
              <button
                onClick={handlePublishAndShare}
                disabled={saving || !name.trim() || !startDate || !endDate}
                className="px-6 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Publishing...' : 'Publish & Share'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
