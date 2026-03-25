'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ParentData {
  id: string
  full_name: string
  phone: string | null
  address: string | null
  secondary_contact_name: string | null
  secondary_contact_phone: string | null
  notes: string | null
}

export default function ParentProfileEditor({ parent }: { parent: ParentData }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [phone, setPhone] = useState(parent.phone || '')
  const [address, setAddress] = useState(parent.address || '')
  const [secondaryName, setSecondaryName] = useState(parent.secondary_contact_name || '')
  const [secondaryPhone, setSecondaryPhone] = useState(parent.secondary_contact_phone || '')
  const [notes, setNotes] = useState(parent.notes || '')

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('profiles')
      .update({
        phone: phone || null,
        address: address || null,
        secondary_contact_name: secondaryName || null,
        secondary_contact_phone: secondaryPhone || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parent.id)

    if (error) alert(error.message)
    else {
      setEditing(false)
      router.refresh()
    }
    setSaving(false)
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
        Edit Details
      </button>
    )
  }

  const inputClass = 'w-full px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary'

  return (
    <div className="border-t border-border pt-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-text-light mb-0.5">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-text-light mb-0.5">Address</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-text-light mb-0.5">Alt Contact Name</label>
          <input type="text" value={secondaryName} onChange={(e) => setSecondaryName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-text-light mb-0.5">Alt Contact Phone</label>
          <input type="tel" value={secondaryPhone} onChange={(e) => setSecondaryPhone(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-text-light mb-0.5">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={() => setEditing(false)} className="px-4 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-surface-dark">
          Cancel
        </button>
      </div>
    </div>
  )
}
