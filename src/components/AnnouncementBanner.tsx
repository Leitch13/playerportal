'use client'

import { useState } from 'react'
import Link from 'next/link'

interface BannerAnnouncement {
  id: string
  title: string
  priority: 'important' | 'urgent'
}

export default function AnnouncementBanner({ announcements }: { announcements: BannerAnnouncement[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = announcements.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map(a => (
        <div
          key={a.id}
          className={`rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${
            a.priority === 'urgent'
              ? 'bg-red-500 text-white'
              : 'bg-orange-500 text-white'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">{a.priority === 'urgent' ? '🚨' : '⚠️'}</span>
            <p className="text-sm font-semibold truncate">{a.title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/dashboard/announcements"
              className="px-3 py-1 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/30 transition-colors"
            >
              View
            </Link>
            <button
              onClick={() => setDismissed(prev => new Set(prev).add(a.id))}
              className="text-white/70 hover:text-white transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
