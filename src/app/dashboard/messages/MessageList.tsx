'use client'

import { useState } from 'react'
import type { ThreadData } from './MessagesApp'

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 2) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-purple-500/20 text-purple-400'
    case 'coach':
      return 'bg-[#4ecde6]/20 text-[#4ecde6]'
    default:
      return 'bg-white/10 text-white/60'
  }
}

export default function MessageList({
  threads,
  selectedThreadId,
  currentUserId,
  onSelectThread,
}: {
  threads: ThreadData[]
  selectedThreadId: string | null
  currentUserId: string
  onSelectThread: (threadId: string) => void
}) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? threads.filter(
        (t) =>
          t.otherUser.full_name.toLowerCase().includes(search.toLowerCase()) ||
          (t.subject || '').toLowerCase().includes(search.toLowerCase()) ||
          t.lastMessage.body.toLowerCase().includes(search.toLowerCase())
      )
    : threads

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 flex-shrink-0">
        <div className="relative">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/40 focus:ring-1 focus:ring-[#4ecde6]/20 transition-colors"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-12 h-12 bg-[#141414] rounded-xl flex items-center justify-center mb-3 border border-[#1e1e1e]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-30"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-white/30 text-sm text-center">
              {search ? 'No conversations found' : 'No messages yet'}
            </p>
          </div>
        ) : (
          filtered.map((thread) => {
            const isSelected = thread.threadId === selectedThreadId
            const initial = thread.otherUser.full_name.charAt(0).toUpperCase()
            const isFromMe = thread.lastMessage.sender_id === currentUserId

            return (
              <button
                key={thread.threadId}
                onClick={() => onSelectThread(thread.threadId)}
                className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-all border-b border-[#1e1e1e] hover:bg-[#1a1a1a] ${
                  isSelected ? 'bg-[#1a1a1a] border-l-2 border-l-[#4ecde6]' : ''
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${
                      thread.otherUser.role === 'coach'
                        ? 'bg-[#4ecde6]/15 text-[#4ecde6] border border-[#4ecde6]/20'
                        : thread.otherUser.role === 'admin'
                          ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                          : 'bg-white/10 text-white/70 border border-white/10'
                    }`}
                  >
                    {initial}
                  </div>
                  {thread.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#4ecde6] rounded-full text-[10px] text-[#0a0a0a] font-bold flex items-center justify-center">
                      {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-sm truncate ${
                          thread.unreadCount > 0 ? 'font-bold text-white' : 'font-medium text-white/80'
                        }`}
                      >
                        {thread.otherUser.full_name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${getRoleBadgeColor(
                          thread.otherUser.role
                        )}`}
                      >
                        {thread.otherUser.role}
                      </span>
                    </div>
                    <span className="text-[11px] text-white/30 flex-shrink-0">
                      {formatTime(thread.lastMessage.created_at)}
                    </span>
                  </div>
                  {thread.subject && (
                    <p
                      className={`text-xs truncate mt-0.5 ${
                        thread.unreadCount > 0 ? 'text-white/70 font-medium' : 'text-white/40'
                      }`}
                    >
                      {thread.subject}
                    </p>
                  )}
                  <p
                    className={`text-xs truncate mt-0.5 ${
                      thread.unreadCount > 0 ? 'text-white/60' : 'text-white/30'
                    }`}
                  >
                    {isFromMe ? 'You: ' : ''}
                    {thread.lastMessage.body}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
