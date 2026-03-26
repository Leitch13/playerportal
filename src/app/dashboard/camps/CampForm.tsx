'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type ScheduleDay = {
  day: string
  date: string
  activities: string[]
}

type Props = {
  orgId: string
  trainingGroups: { id: string; name: string }[]
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

export default function CampForm({ orgId, trainingGroups }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
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

  const handleSave = async () => {
    if (!name.trim() || !startDate || !endDate) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('camps').insert({
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
        is_published: isPublished,
      })
      if (error) {
        alert('Error saving camp: ' + error.message)
      } else {
        setOpen(false)
        resetForm()
        router.refresh()
      }
    } finally {
      setSaving(false)
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-text">Create Camp</h2>
          <button
            onClick={() => { setOpen(false); resetForm() }}
            className="text-text-light hover:text-text text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">Camp Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Easter Football Camp"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Tell parents what the camp is about..."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>
          {duration > 0 && (
            <p className="text-xs text-text-light -mt-3">
              {duration} day{duration !== 1 ? 's' : ''}
            </p>
          )}

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Daily Start Time</label>
              <input
                type="time"
                value={dailyStartTime}
                onChange={(e) => setDailyStartTime(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Daily End Time</label>
              <input
                type="time"
                value={dailyEndTime}
                onChange={(e) => setDailyEndTime(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>

          {/* Location, Age Group */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. King George V Playing Fields"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Age Group</label>
              <input
                type="text"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                placeholder="e.g. Ages 5-12"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>

          {/* Price, Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Price (&pound;)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 120"
                min="0"
                step="0.01"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Max Capacity</label>
              <input
                type="number"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
                min="1"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>

          {/* Training Group */}
          {trainingGroups.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">Link to Class (optional)</label>
              <select
                value={trainingGroupId}
                onChange={(e) => setTrainingGroupId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="">None</option>
                {trainingGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">Image URL</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden h-32 bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            )}
          </div>

          {/* What to Bring */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">What to Bring</label>
            <textarea
              value={whatToBring}
              onChange={(e) => setWhatToBring(e.target.value)}
              rows={3}
              placeholder="e.g. Football boots, shin pads, water bottle, packed lunch..."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Published */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-text">Published (visible on booking page)</span>
          </label>

          {/* Schedule Builder */}
          <div className="border-t border-border pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text">Daily Schedule</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerateDays}
                  disabled={!startDate || !endDate}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-light hover:bg-surface disabled:opacity-40 transition-colors"
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
              <p className="text-xs text-text-light">
                Set start and end dates, then click &quot;Generate Days&quot; or &quot;Use Template&quot;.
              </p>
            )}

            <div className="space-y-4">
              {schedule.map((day, dayIdx) => (
                <div key={dayIdx} className="border border-border rounded-lg p-4">
                  <h4 className="text-sm font-medium text-text mb-3">
                    {day.day}{' '}
                    <span className="text-text-light font-normal">
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
                          className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
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

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={() => { setOpen(false); resetForm() }}
            className="px-4 py-2 text-sm font-medium text-text-light hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !startDate || !endDate}
            className="px-6 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving...' : 'Save Camp'}
          </button>
        </div>
      </div>
    </div>
  )
}
