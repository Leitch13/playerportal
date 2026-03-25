'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Parent {
  id: string
  full_name: string
  email: string
}

interface Group {
  id: string
  name: string
}

export default function QuickAddPlayer({
  parents,
  groups,
  autoOpen,
  orgId,
}: {
  parents: Parent[]
  groups: Group[]
  autoOpen: boolean
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')

  // Player fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [groupId, setGroupId] = useState('')

  // Existing parent
  const [parentId, setParentId] = useState('')

  // New parent fields
  const [parentName, setParentName] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentPhone, setParentPhone] = useState('')

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const supabase = createClient()
    let resolvedParentId = parentId

    // If creating new parent, insert profile first
    if (mode === 'new') {
      // Create auth user for parent (they can reset password later)
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: parentEmail,
        password: tempPassword,
        options: {
          data: {
            full_name: parentName,
            phone: parentPhone,
            role: 'parent',
          },
        },
      })

      if (authErr || !authData.user) {
        setError(authErr?.message || 'Failed to create parent account')
        setLoading(false)
        return
      }

      // Re-authenticate as the current admin/coach (signUp switches session)
      // Instead, we'll use the profiles table directly since the trigger creates it
      resolvedParentId = authData.user.id

      // Wait a moment for the trigger to create the profile
      await new Promise((r) => setTimeout(r, 500))
    }

    // Create the player
    const { error: playerErr } = await supabase.from('players').insert({
      organisation_id: orgId,
      parent_id: resolvedParentId,
      first_name: firstName,
      last_name: lastName,
      age_group: ageGroup || null,
    })

    if (playerErr) {
      setError(playerErr.message)
      setLoading(false)
      return
    }

    // Auto-enrol if group selected
    if (groupId) {
      // Get the player we just created
      const { data: newPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('parent_id', resolvedParentId)
        .eq('first_name', firstName)
        .eq('last_name', lastName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (newPlayer) {
        await supabase.from('enrolments').insert({
          organisation_id: orgId,
          player_id: newPlayer.id,
          group_id: groupId,
          status: 'active',
        })
      }
    }

    setSuccess(`${firstName} ${lastName} added!`)
    setFirstName('')
    setLastName('')
    setAgeGroup('')
    setGroupId('')
    setParentId('')
    setParentName('')
    setParentEmail('')
    setParentPhone('')
    router.refresh()
    setLoading(false)

    setTimeout(() => setSuccess(''), 3000)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
      >
        + Add Player
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Add Player</h2>
        <button onClick={() => setOpen(false)} className="text-text-light hover:text-text text-sm">Close</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Player details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">First Name *</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last Name *</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Age Group</label>
            <input type="text" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} placeholder="e.g. U10"
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
        </div>

        {/* Parent linking */}
        <div>
          <div className="flex items-center gap-4 mb-2">
            <label className="text-sm font-medium">Parent</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode('existing')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${mode === 'existing' ? 'bg-primary text-white' : 'bg-surface-dark text-text-light'}`}>
                Existing
              </button>
              <button type="button" onClick={() => setMode('new')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${mode === 'new' ? 'bg-primary text-white' : 'bg-surface-dark text-text-light'}`}>
                + New Parent
              </button>
            </div>
          </div>

          {mode === 'existing' ? (
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} required
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">Select parent...</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-text-light mb-1">Full Name *</label>
                <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)} required={mode === 'new'}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-text-light mb-1">Email *</label>
                <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required={mode === 'new'}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-text-light mb-1">Phone</label>
                <input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
          )}
        </div>

        {/* Optional auto-enrol */}
        <div>
          <label className="block text-sm font-medium mb-1">Enrol in Group (optional)</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="">No group yet</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-accent font-medium">{success}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={loading}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
            {loading ? 'Adding...' : 'Add Player'}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
