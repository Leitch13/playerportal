'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Achievement {
  id: string
  name: string
  description: string | null
  badge_emoji: string
  badge_color: string
  achievement_type: string
  criteria: string | null
}

const EMOJI_OPTIONS = [
  '⭐', '🏆', '🥇', '🥈', '🥉', '🎯', '🔥', '💪', '⚽', '🎖️',
  '👑', '💎', '🚀', '🌟', '🏅', '✨', '🎓', '🛡️', '🦁', '👏',
]

const ACHIEVEMENT_TYPES = [
  { value: 'badge', label: 'Badge' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'milestone', label: 'Milestone' },
]

const BADGE_COLORS = [
  { value: 'bg-primary/10 text-primary', label: 'Blue' },
  { value: 'bg-accent/10 text-accent', label: 'Green' },
  { value: 'bg-warning/10 text-warning', label: 'Gold' },
  { value: 'bg-danger/10 text-danger', label: 'Red' },
  { value: 'bg-purple-100 text-purple-700', label: 'Purple' },
]

export default function AchievementManager({
  achievements,
  orgId,
}: {
  achievements: Achievement[]
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [badgeEmoji, setBadgeEmoji] = useState('⭐')
  const [badgeColor, setBadgeColor] = useState(BADGE_COLORS[0].value)
  const [achievementType, setAchievementType] = useState('badge')
  const [criteria, setCriteria] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  function resetForm() {
    setName('')
    setDescription('')
    setBadgeEmoji('⭐')
    setBadgeColor(BADGE_COLORS[0].value)
    setAchievementType('badge')
    setCriteria('')
    setEditingId(null)
  }

  function handleEdit(a: Achievement) {
    setEditingId(a.id)
    setName(a.name)
    setDescription(a.description || '')
    setBadgeEmoji(a.badge_emoji)
    setBadgeColor(a.badge_color)
    setAchievementType(a.achievement_type)
    setCriteria(a.criteria || '')
    setOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this achievement? This cannot be undone.')) return
    const supabase = createClient()
    const { error } = await supabase.from('achievements').delete().eq('id', id)
    if (error) {
      alert(error.message)
    } else {
      router.refresh()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const payload = {
      organisation_id: orgId,
      name,
      description: description || null,
      badge_emoji: badgeEmoji,
      badge_color: badgeColor,
      achievement_type: achievementType,
      criteria: criteria || null,
    }

    const { error } = editingId
      ? await supabase.from('achievements').update(payload).eq('id', editingId)
      : await supabase.from('achievements').insert(payload)

    if (error) {
      alert(error.message)
    } else {
      setSuccess(editingId ? 'Achievement updated!' : 'Achievement created!')
      resetForm()
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { resetForm(); setOpen(true) }}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          + Create Achievement
        </button>

        {achievements.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {achievements.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-border p-4 flex items-start gap-3">
                <span className={`text-3xl flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full ${a.badge_color}`}>
                  {a.badge_emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{a.name}</h3>
                  {a.description && <p className="text-xs text-text-light mt-0.5 line-clamp-2">{a.description}</p>}
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-surface-dark text-text-light capitalize">
                    {a.achievement_type}
                  </span>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleEdit(a)}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-xs text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{editingId ? 'Edit Achievement' : 'Create Achievement'}</h2>
        <button onClick={() => { resetForm(); setOpen(false) }} className="text-text-light hover:text-text text-sm">Close</button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Player of the Month"
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type *</label>
          <select
            value={achievementType}
            onChange={(e) => setAchievementType(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {ACHIEVEMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this achievement for?"
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Badge Emoji *</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setBadgeEmoji(emoji)}
                className={`w-10 h-10 text-xl rounded-lg border-2 transition-colors flex items-center justify-center ${
                  badgeEmoji === emoji ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Badge Color</label>
          <div className="flex flex-wrap gap-2">
            {BADGE_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setBadgeColor(c.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${c.value} ${
                  badgeColor === c.value ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Criteria (optional)</label>
          <input
            type="text"
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            placeholder="e.g. Attend 10 sessions in a row"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {success && <p className="text-sm text-accent font-medium md:col-span-2">{success}</p>}

        <div className="md:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : editingId ? 'Update Achievement' : 'Create Achievement'}
          </button>
          <button
            type="button"
            onClick={() => { resetForm(); setOpen(false) }}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
