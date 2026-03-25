'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Group {
  id: string
  name: string
}

export default function SessionNoteForm({
  groups,
  coachId,
  autoOpen,
  orgId,
}: {
  groups: Group[]
  coachId: string
  autoOpen: boolean
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)

  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  const [groupId, setGroupId] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [focusAreas, setFocusAreas] = useState('')
  const [playersOfNote, setPlayersOfNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.from('session_notes').insert({
      organisation_id: orgId,
      group_id: groupId,
      session_date: sessionDate,
      coach_id: coachId,
      title: title || null,
      notes,
      focus_areas: focusAreas || null,
      players_of_note: playersOfNote || null,
    })

    if (error) {
      alert(error.message)
    } else {
      setSuccess('Session note saved!')
      setTitle('')
      setNotes('')
      setFocusAreas('')
      setPlayersOfNote('')
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
      >
        + Add Session Note
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Add Session Note</h2>
        <button onClick={() => setOpen(false)} className="text-text-light hover:text-text text-sm">Close</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Group *</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select group...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Session Date *</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Passing & Movement"
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Session Notes *</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            required
            placeholder="What happened in the session? Key observations, exercises run, how the group performed..."
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Focus Areas</label>
            <input
              type="text"
              value={focusAreas}
              onChange={(e) => setFocusAreas(e.target.value)}
              placeholder="e.g. First touch, Communication"
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Players of Note</label>
            <input
              type="text"
              value={playersOfNote}
              onChange={(e) => setPlayersOfNote(e.target.value)}
              placeholder="e.g. Jake - great effort, Lily - needs more confidence"
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {success && <p className="text-sm text-accent font-medium">{success}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Save Note'}
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
