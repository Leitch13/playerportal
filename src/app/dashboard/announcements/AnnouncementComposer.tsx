'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ComposerProps {
  orgId: string
  authorId: string
  groups: { id: string; name: string }[]
}

export default function AnnouncementComposer({ orgId, authorId, groups }: ComposerProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<'all' | 'group'>('all')
  const [groupId, setGroupId] = useState('')
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal')
  const [loading, setLoading] = useState(false)

  async function handleSend(isDraft: boolean) {
    if (!title || !body) return
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('announcements').insert({
      organisation_id: orgId,
      author_id: authorId,
      title,
      body,
      audience,
      target_group_id: audience === 'group' ? groupId || null : null,
      priority,
      status: isDraft ? 'draft' : 'sent',
      sent_at: isDraft ? null : new Date().toISOString(),
    })

    if (error) {
      alert(error.message)
    } else {
      if (!isDraft) {
        // Send emails to parents (fire and forget)
        fetch('/api/email/announcement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            body,
            priority,
            groupId: audience === 'group' ? groupId : null,
          }),
        }).catch(() => {})
      }

      setTitle('')
      setBody('')
      setAudience('all')
      setGroupId('')
      setPriority('normal')
      setOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-gradient-to-br from-[#4ecde6]/10 to-transparent rounded-2xl border border-[#4ecde6]/25 hover:border-[#4ecde6]/50 p-5 flex items-center justify-center gap-3 hover:from-[#4ecde6]/15 transition-all group"
      >
        <span className="w-9 h-9 rounded-xl bg-[#4ecde6]/15 border border-[#4ecde6]/30 flex items-center justify-center text-lg group-hover:scale-110 transition-transform" aria-hidden>📢</span>
        <span className="font-semibold text-sm text-[#4ecde6]">New announcement</span>
      </button>
    )
  }

  return (
    <div className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/[0.08] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-white">New announcement</h2>
        <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-sm transition-colors">Cancel</button>
      </div>

      <input
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:ring-2 focus:ring-accent/50 placeholder:text-white/30"
        placeholder="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      <textarea
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 min-h-[100px] placeholder:text-white/30"
        placeholder="Write your message to parents..."
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={4}
      />

      <div className="flex flex-wrap items-center gap-3">
        {/* Audience */}
        <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-lg p-1">
          <button
            onClick={() => setAudience('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${audience === 'all' ? 'bg-[#2a2a2a] text-white' : 'text-white/50'}`}
          >
            All Parents
          </button>
          <button
            onClick={() => setAudience('group')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${audience === 'group' ? 'bg-[#2a2a2a] text-white' : 'text-white/50'}`}
          >
            Specific Class
          </button>
        </div>

        {audience === 'group' && (
          <select
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
          >
            <option value="">Select class...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}

        {/* Priority */}
        <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-lg p-1">
          {(['normal', 'important', 'urgent'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                priority === p
                  ? p === 'urgent' ? 'bg-red-500 text-white shadow-sm' :
                    p === 'important' ? 'bg-orange-500 text-white shadow-sm' :
                    'bg-[#2a2a2a] text-white'
                  : 'text-white/50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={() => handleSend(false)}
          disabled={loading || !title || !body}
          className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#4ecde6] text-[#06222a] hover:bg-[#6fd9ec] disabled:opacity-40 transition-all"
        >
          {loading ? 'Sending...' : 'Send Now'}
        </button>
        <button
          onClick={() => handleSend(true)}
          disabled={loading || !title || !body}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white border border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#222] disabled:opacity-40 transition-all"
        >
          Save Draft
        </button>
      </div>
    </div>
  )
}
