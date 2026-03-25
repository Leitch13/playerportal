'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Group = { id: string; name: string }

export default function BulkMessageForm({
  parents,
  groups,
  orgId,
}: {
  parents: { id: string; full_name: string }[]
  groups: Group[]
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'all' | 'group' | 'overdue'>('all')
  const [groupId, setGroupId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSent(0)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    let recipientIds: string[] = []

    if (mode === 'all') {
      recipientIds = parents.map((p) => p.id)
    } else if (mode === 'group' && groupId) {
      // Get players in selected group, then their parent IDs
      const { data: enrolments } = await supabase
        .from('enrolments')
        .select('player:players(parent_id)')
        .eq('group_id', groupId)
        .eq('status', 'active')

      const parentIdSet = new Set<string>()
      for (const e of enrolments || []) {
        const player = e.player as unknown as { parent_id: string }
        if (player?.parent_id) parentIdSet.add(player.parent_id)
      }
      recipientIds = [...parentIdSet]
    } else if (mode === 'overdue') {
      const { data: overduePayments } = await supabase
        .from('payments')
        .select('parent_id')
        .eq('status', 'overdue')

      const parentIdSet = new Set<string>()
      for (const p of overduePayments || []) {
        if (p.parent_id) parentIdSet.add(p.parent_id)
      }
      recipientIds = [...parentIdSet]
    }

    if (recipientIds.length === 0) {
      alert('No recipients found for the selected criteria.')
      setLoading(false)
      return
    }

    // Insert messages in batches
    const messages = recipientIds.map((rid) => ({
      organisation_id: orgId,
      sender_id: user.id,
      recipient_id: rid,
      subject: subject || null,
      body,
    }))

    const { error } = await supabase.from('messages').insert(messages)

    if (error) {
      alert(error.message)
    } else {
      setSent(recipientIds.length)
      setSubject('')
      setBody('')
      setTimeout(() => {
        setOpen(false)
        setSent(0)
        router.refresh()
      }, 2000)
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-accent text-primary rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
      >
        Bulk Message
      </button>
    )
  }

  return (
    <div className="bg-white dark:bg-surface-dark rounded-xl border border-border p-6">
      <h2 className="text-lg font-semibold mb-4">Bulk Message</h2>

      {sent > 0 && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-3 text-sm font-medium text-cyan-800 mb-4">
          Sent to {sent} parent{sent !== 1 ? 's' : ''}!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Send to</label>
          <div className="flex flex-wrap gap-2">
            {(['all', 'group', 'overdue'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  mode === m
                    ? 'bg-primary text-white dark:bg-accent dark:text-primary'
                    : 'bg-surface-dark text-text-light hover:bg-border'
                }`}
              >
                {m === 'all' ? `All Parents (${parents.length})` :
                 m === 'group' ? 'Parents in Group' :
                 'Parents with Overdue'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'group' && (
          <div>
            <label className="block text-sm font-medium mb-1">Select Group</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Choose a group...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Important: Schedule Change"
            className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={5}
            placeholder="Write your message here..."
            className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {loading ? 'Sending...' : `Send to ${mode === 'all' ? 'All' : mode === 'group' ? 'Group' : 'Overdue'}`}
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
