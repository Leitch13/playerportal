'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUpload from '@/components/FileUpload'
import PlayerAvatar from '@/components/PlayerAvatar'

export default function AddChildForm({
  orgId,
}: {
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('players').insert({
      organisation_id: orgId,
      parent_id: user.id,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dob || null,
      age_group: ageGroup || null,
      photo_url: photoUrl || null,
    })

    if (error) {
      setError(error.message)
    } else {
      setFirstName('')
      setLastName('')
      setDob('')
      setAgeGroup('')
      setPhotoUrl(null)
      setOpen(false)
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
        + Add Child
      </button>
    )
  }

  return (
    <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Add a Child</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Photo upload — spans both columns */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-white/70 mb-2">Photo (optional)</label>
          <div className="flex items-center gap-4 p-3 rounded-xl bg-[#0a0a0a] border border-[#1e1e1e]">
            <PlayerAvatar
              photoUrl={photoUrl}
              firstName={firstName || '?'}
              lastName={lastName || ''}
              size="lg"
            />
            <div className="flex-1">
              <FileUpload
                bucketName="coaching"
                folder="player-photos"
                accept="image/*"
                currentUrl={photoUrl || ''}
                onUpload={(url) => setPhotoUrl(url)}
              />
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="text-[11px] text-red-400 hover:text-red-300 mt-1"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">First Name *</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Last Name *</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Date of Birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Age Group</label>
          <input
            type="text"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            placeholder="e.g. U10"
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder:text-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        {error && (
          <p className="text-sm text-danger md:col-span-2">{error}</p>
        )}
        <div className="md:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {loading ? 'Adding...' : 'Add Child'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 border border-[#2a2a2a] text-white/70 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
