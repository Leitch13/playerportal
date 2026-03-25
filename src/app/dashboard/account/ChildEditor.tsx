'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ChildData {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  medical_info: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  school: string | null
  kit_size: string | null
}

const KIT_SIZES = ['XS', 'S', 'M', 'L', 'XL']

export default function ChildEditor({ child }: { child: ChildData }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [medicalInfo, setMedicalInfo] = useState(child.medical_info || '')
  const [emergencyName, setEmergencyName] = useState(
    child.emergency_contact_name || ''
  )
  const [emergencyPhone, setEmergencyPhone] = useState(
    child.emergency_contact_phone || ''
  )
  const [school, setSchool] = useState(child.school || '')
  const [kitSize, setKitSize] = useState(child.kit_size || '')
  const [dob, setDob] = useState(child.date_of_birth || '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccess('')

    const supabase = createClient()
    const { error } = await supabase
      .from('players')
      .update({
        date_of_birth: dob || null,
        medical_info: medicalInfo || null,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
        school: school || null,
        kit_size: kitSize || null,
      })
      .eq('id', child.id)

    if (error) {
      alert(error.message)
    } else {
      setSuccess('Updated!')
      setOpen(false)
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-accent hover:underline font-medium"
        >
          Edit Details
        </button>
        {success && (
          <span className="text-xs text-accent">{success}</span>
        )}
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 pt-3 border-t border-border space-y-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">
            Date of Birth
          </label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Kit Size</label>
          <select
            value={kitSize}
            onChange={(e) => setKitSize(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="">Select...</option>
            {KIT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">School</label>
          <input
            type="text"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">
            Medical / Allergies
          </label>
          <input
            type="text"
            value={medicalInfo}
            onChange={(e) => setMedicalInfo(e.target.value)}
            placeholder="Any medical conditions or allergies"
            className="w-full px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">
            Emergency Contact Name
          </label>
          <input
            type="text"
            value={emergencyName}
            onChange={(e) => setEmergencyName(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">
            Emergency Contact Phone
          </label>
          <input
            type="tel"
            value={emergencyPhone}
            onChange={(e) => setEmergencyPhone(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-light disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-surface-dark transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
