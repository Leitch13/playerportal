'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const AGE_GROUPS = ['U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U18', 'Adults', 'Mixed']

export default function GroupForm({
  coaches,
  orgId,
  editGroup,
  onClose,
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
  }
  onClose?: () => void
}) {
  const router = useRouter()
  const isEdit = !!editGroup
  const [open, setOpen] = useState(isEdit)
  const [name, setName] = useState(editGroup?.name || '')
  const [dayOfWeek, setDayOfWeek] = useState(editGroup?.day_of_week || '')
  const [startTime, setStartTime] = useState(editGroup?.time_slot || '')
  const [endTime, setEndTime] = useState(editGroup?.end_time || '')
  const [location, setLocation] = useState(editGroup?.location || '')
  const [coachId, setCoachId] = useState(editGroup?.coach_id || '')
  const [maxCapacity, setMaxCapacity] = useState(editGroup?.max_capacity?.toString() || '20')
  const [ageGroup, setAgeGroup] = useState(editGroup?.age_group || '')
  const [description, setDescription] = useState(editGroup?.description || '')
  const [pricePerSession, setPricePerSession] = useState(editGroup?.price_per_session?.toString() || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const timeSlot = startTime && endTime ? `${startTime}–${endTime}` : startTime || null

    const data = {
      organisation_id: orgId,
      name,
      day_of_week: dayOfWeek || null,
      time_slot: timeSlot,
      location: location || null,
      coach_id: coachId || null,
      max_capacity: maxCapacity ? parseInt(maxCapacity) : 20,
      age_group: ageGroup || null,
      description: description || null,
      price_per_session: pricePerSession ? parseFloat(pricePerSession) : null,
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
        setDayOfWeek('')
        setStartTime('')
        setEndTime('')
        setLocation('')
        setCoachId('')
        setMaxCapacity('20')
        setAgeGroup('')
        setDescription('')
        setPricePerSession('')
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

  return (
    <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold">{isEdit ? 'Edit Class' : 'Create New Class'}</h2>
        <button
          onClick={() => { setOpen(false); onClose?.() }}
          className="text-text-light hover:text-text text-xl leading-none"
        >
          &times;
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Row 1: Name & Age Group */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1.5">Class Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. U10 Development Squad"
              className="w-full px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Age Group</label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select...</option>
              {AGE_GROUPS.map((ag) => (
                <option key={ag} value={ag}>{ag}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Day, Start, End */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Day *</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select day...</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Row 3: Location, Coach, Capacity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Main Pitch"
              className="w-full px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Coach</label>
            <select
              value={coachId}
              onChange={(e) => setCoachId(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select coach...</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Max Capacity *</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="100"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
                required
                placeholder="20"
                className="w-full px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-light">players</span>
            </div>
          </div>
        </div>

        {/* Row 4: Price & Description */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Price Per Session (optional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light">&pound;</span>
              <input
                type="number"
                min="0"
                step="0.50"
                value={pricePerSession}
                onChange={(e) => setPricePerSession(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the class"
              className="w-full px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

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
            className="px-6 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-surface-dark transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
