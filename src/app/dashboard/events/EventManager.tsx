'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const EVENT_TYPES = [
  { value: 'holiday_camp', label: 'Holiday Camp' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'social', label: 'Social' },
  { value: 'other', label: 'Other' },
]

const AGE_GROUP_OPTIONS = [
  'U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12',
  'U13', 'U14', 'U15', 'U16', 'U18', 'Open',
]

export default function EventManager({
  coaches,
  orgId,
}: {
  coaches: { id: string; full_name: string }[]
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState('holiday_camp')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')
  const [price, setPrice] = useState('')
  const [ageGroups, setAgeGroups] = useState<string[]>([])
  const [coachId, setCoachId] = useState('')
  const [loading, setLoading] = useState(false)

  function toggleAgeGroup(ag: string) {
    setAgeGroups((prev) =>
      prev.includes(ag) ? prev.filter((a) => a !== ag) : [...prev, ag]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.from('events').insert({
      organisation_id: orgId,
      name,
      description: description || null,
      event_type: eventType,
      start_date: startDate,
      end_date: endDate || startDate,
      start_time: startTime || null,
      end_time: endTime || null,
      location: location || null,
      max_capacity: maxCapacity ? parseInt(maxCapacity) : null,
      price: price ? parseFloat(price) : null,
      age_groups: ageGroups.length > 0 ? ageGroups : null,
      coach_id: coachId || null,
      active: true,
    })

    if (error) {
      alert(error.message)
    } else {
      setOpen(false)
      setName('')
      setDescription('')
      setEventType('holiday_camp')
      setStartDate('')
      setEndDate('')
      setStartTime('')
      setEndTime('')
      setLocation('')
      setMaxCapacity('')
      setPrice('')
      setAgeGroups([])
      setCoachId('')
      router.refresh()
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
      >
        + Create Event
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <h2 className="text-lg font-semibold mb-4">New Event</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Event Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Easter Holiday Camp 2026"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Details about the event..."
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Event Type *</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Coach</label>
          <select
            value={coachId}
            onChange={(e) => setCoachId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select coach...</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Start Date *</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Start Time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Time</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Main Pitch"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Capacity</label>
          <input
            type="number"
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(e.target.value)}
            min="1"
            placeholder="e.g. 30"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Price</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min="0"
            step="0.01"
            placeholder="e.g. 25.00"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Age Groups</label>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUP_OPTIONS.map((ag) => (
              <button
                key={ag}
                type="button"
                onClick={() => toggleAgeGroup(ag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  ageGroups.includes(ag)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-text-light border-border hover:border-primary/50'
                }`}
              >
                {ag}
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
