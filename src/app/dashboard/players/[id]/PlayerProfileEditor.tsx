'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { POSITIONS, KIT_SIZES } from '@/lib/types'

interface PlayerData {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  age_group: string | null
  position: string | null
  medical_info: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  kit_size: string | null
  school: string | null
  notes: string | null
}

export default function PlayerProfileEditor({ player }: { player: PlayerData }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  const [position, setPosition] = useState(player.position || '')
  const [dob, setDob] = useState(player.date_of_birth || '')
  const [ageGroup, setAgeGroup] = useState(player.age_group || '')
  const [kitSize, setKitSize] = useState(player.kit_size || '')
  const [school, setSchool] = useState(player.school || '')
  const [medicalInfo, setMedicalInfo] = useState(player.medical_info || '')
  const [emergencyName, setEmergencyName] = useState(player.emergency_contact_name || '')
  const [emergencyPhone, setEmergencyPhone] = useState(player.emergency_contact_phone || '')
  const [notes, setNotes] = useState(player.notes || '')

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('players')
      .update({
        position: position || null,
        date_of_birth: dob || null,
        age_group: ageGroup || null,
        kit_size: kitSize || null,
        school: school || null,
        medical_info: medicalInfo || null,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', player.id)

    if (error) {
      alert(error.message)
    } else {
      setSuccess('Saved!')
      setEditing(false)
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  if (!editing) {
    return (
      <div className="space-y-2 text-sm">
        {player.date_of_birth && <p><span className="text-text-light">DOB:</span> {new Date(player.date_of_birth).toLocaleDateString()}</p>}
        {player.age_group && <p><span className="text-text-light">Age Group:</span> {player.age_group}</p>}
        {player.position && <p><span className="text-text-light">Position:</span> {player.position}</p>}
        {player.school && <p><span className="text-text-light">School:</span> {player.school}</p>}
        {player.kit_size && <p><span className="text-text-light">Kit Size:</span> {player.kit_size}</p>}
        {player.medical_info && <p><span className="text-text-light">Medical:</span> <span className="text-danger">{player.medical_info}</span></p>}
        {player.emergency_contact_name && <p><span className="text-text-light">Emergency:</span> {player.emergency_contact_name} {player.emergency_contact_phone && `— ${player.emergency_contact_phone}`}</p>}
        {player.notes && <p><span className="text-text-light">Notes:</span> {player.notes}</p>}
        <div className="pt-2 flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="text-sm text-primary hover:underline">Edit Profile</button>
          {success && <span className="text-sm text-accent">{success}</span>}
        </div>
      </div>
    )
  }

  const inputClass = 'w-full px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-text-light mb-0.5">DOB</label>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-text-light mb-0.5">Age Group</label>
          <input type="text" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} placeholder="e.g. U10" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-text-light mb-0.5">Position</label>
          <select value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass}>
            <option value="">Select...</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-light mb-0.5">Kit Size</label>
          <select value={kitSize} onChange={(e) => setKitSize(e.target.value)} className={inputClass}>
            <option value="">Select...</option>
            {KIT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-light mb-0.5">School</label>
          <input type="text" value={school} onChange={(e) => setSchool(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-text-light mb-0.5">Medical Info</label>
        <textarea value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} rows={2} placeholder="Allergies, conditions, etc." className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-text-light mb-0.5">Emergency Contact Name</label>
          <input type="text" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-text-light mb-0.5">Emergency Contact Phone</label>
          <input type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-text-light mb-0.5">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={() => setEditing(false)} className="px-4 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
