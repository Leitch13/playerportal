'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Announcement {
  id: string
  title: string
  body: string
  audience: string
  groupName: string | null
  priority: string
  status: string
  sentAt: string | null
  createdAt: string
  authorName: string
  isRead: boolean
  readCount: number
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(diff / 86400000)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function AnnouncementFeed({ announcements, userId }: { announcements: Announcement[]; userId: string }) {
  // Mark unread as read on mount
  useEffect(() => {
    const unread = announcements.filter(a => !a.isRead)
    if (unread.length === 0) return

    const supabase = createClient()
    const records = unread.map(a => ({
      announcement_id: a.id,
      profile_id: userId,
    }))

    supabase.from('announcement_reads').upsert(records, { onConflict: 'announcement_id,profile_id' }).then(() => {})
  }, [announcements, userId])

  if (announcements.length === 0) {
    return (
      <div className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/[0.08] p-12 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#4ecde6]/15 border border-[#4ecde6]/30 flex items-center justify-center text-2xl mb-3" aria-hidden>📭</div>
        <p className="font-semibold text-white">No announcements yet</p>
        <p className="text-sm text-white/50 mt-1">Check back later for news from your academy.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {announcements.map(a => {
        const urgent = a.priority === 'urgent'
        const important = a.priority === 'important'
        return (
        <div
          key={a.id}
          className={`relative overflow-hidden bg-white/[0.05] backdrop-blur-xl rounded-2xl border p-5 transition-all hover:bg-white/[0.07] ${
            urgent ? 'border-l-4 border-l-red-500 border-white/[0.08]' :
            important ? 'border-l-4 border-l-orange-500 border-white/[0.08]' :
            'border-white/[0.08]'
          } ${!a.isRead ? 'ring-1 ring-[#4ecde6]/30' : ''}`}
        >
          {!a.isRead && (
            <span className="absolute top-0 right-0 w-24 h-24 bg-[#4ecde6]/10 blur-2xl rounded-full pointer-events-none" aria-hidden />
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {!a.isRead && <span className="w-2 h-2 rounded-full bg-[#4ecde6] shrink-0 shadow-[0_0_8px_rgba(78,205,230,0.8)]" />}
                <h3 className={`font-bold ${!a.isRead ? 'text-white' : 'text-white/70'}`}>{a.title}</h3>
                {a.priority !== 'normal' && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                    urgent ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                  }`}>
                    {a.priority}
                  </span>
                )}
              </div>
              <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{a.body}</p>
              <div className="flex items-center gap-2.5 mt-3 text-xs text-white/45">
                {a.groupName && (
                  <span className="px-2 py-0.5 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] border border-[#4ecde6]/25 font-medium">{a.groupName}</span>
                )}
                <span>{timeAgo(a.sentAt || a.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
        )
      })}
    </div>
  )
}
