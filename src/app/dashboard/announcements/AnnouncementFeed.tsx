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
      <div className="bg-white rounded-2xl border border-border p-12 text-center">
        <p className="text-4xl mb-3">📭</p>
        <p className="font-semibold">No announcements</p>
        <p className="text-sm text-text-light mt-1">Check back later for news from your academy</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {announcements.map(a => (
        <div
          key={a.id}
          className={`bg-white rounded-2xl border p-5 transition-all ${
            a.priority === 'urgent' ? 'border-l-4 border-l-red-500 border-border' :
            a.priority === 'important' ? 'border-l-4 border-l-orange-500 border-border' :
            'border-border'
          } ${!a.isRead ? 'ring-2 ring-accent/20' : ''}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {!a.isRead && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                <h3 className={`font-bold ${!a.isRead ? '' : 'text-text-light'}`}>{a.title}</h3>
                {a.priority !== 'normal' && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                    a.priority === 'urgent' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                  }`}>
                    {a.priority}
                  </span>
                )}
              </div>
              <p className="text-sm text-text-light whitespace-pre-wrap leading-relaxed">{a.body}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-text-light">
                {a.groupName && (
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{a.groupName}</span>
                )}
                <span>{timeAgo(a.sentAt || a.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
