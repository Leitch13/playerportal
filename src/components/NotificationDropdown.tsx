'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Notification = {
  id: string
  profile_id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
  organisation_id: string | null
}

type GroupedNotifications = {
  label: string
  items: Notification[]
}

const typeIcons: Record<string, string> = {
  payment_due: '\uD83D\uDCB0',
  review: '\u2B50',
  message: '\uD83D\uDCAC',
  waitlist_offer: '\uD83D\uDCCB',
  general: '\uD83D\uDD14',
}

function getIcon(type: string): string {
  return typeIcons[type] || typeIcons.general
}

function relativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function groupNotifications(notifications: Notification[]): GroupedNotifications[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())

  const today: Notification[] = []
  const thisWeek: Notification[] = []
  const earlier: Notification[] = []

  for (const n of notifications) {
    const d = new Date(n.created_at)
    if (d >= startOfToday) {
      today.push(n)
    } else if (d >= startOfWeek) {
      thisWeek.push(n)
    } else {
      earlier.push(n)
    }
  }

  const groups: GroupedNotifications[] = []
  if (today.length) groups.push({ label: 'Today', items: today })
  if (thisWeek.length) groups.push({ label: 'This Week', items: thisWeek })
  if (earlier.length) groups.push({ label: 'Earlier', items: earlier })
  return groups
}

export default function NotificationDropdown({
  userId,
  initialCount,
}: {
  userId: string
  initialCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialCount)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter((n) => !n.read).length)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open, fetchNotifications])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function markAllRead() {
    const supabase = createClient()
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return

    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  async function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      const supabase = createClient()
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id)

      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    }

    setOpen(false)
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const grouped = groupNotifications(notifications)

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative text-lg hover:opacity-80 transition-opacity focus:outline-none"
        aria-label="Notifications"
      >
        <span>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <div
        className={`absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden transition-all duration-200 origin-top-right ${
          open
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto overscroll-contain">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <svg
                className="animate-spin h-5 w-5 mr-2"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading...
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
              No notifications yet
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.label}>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                  {group.label}
                </div>
                {group.items.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-l-[3px] ${
                      !notification.read
                        ? 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'border-l-transparent'
                    }`}
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {getIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm leading-tight ${
                            !notification.read
                              ? 'font-semibold text-gray-900 dark:text-white'
                              : 'font-medium text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {notification.title}
                        </p>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                          {relativeTime(notification.created_at)}
                        </span>
                      </div>
                      {notification.message && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {notification.message.length > 100
                            ? notification.message.slice(0, 100) + '...'
                            : notification.message}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
