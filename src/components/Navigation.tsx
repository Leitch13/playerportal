'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/ThemeProvider'
import NotificationDropdown from '@/components/NotificationDropdown'
import CommandPalette from '@/components/CommandPalette'
import type { UserRole } from '@/lib/types'
import { useState } from 'react'

type NavItem = { href: string; label: string; icon: string }
type NavGroup = { title: string; items: NavItem[] }

const navGroups: Record<UserRole, NavGroup[]> = {
  parent: [
    { title: '', items: [
      { href: '/dashboard', label: 'Home', icon: '🏠' },
    ]},
    { title: 'My Family', items: [
      { href: '/dashboard/children', label: 'My Children', icon: '👦' },
      { href: '/dashboard/schedule', label: 'Schedule', icon: '📅' },
      { href: '/dashboard/feedback', label: 'Progress', icon: '📊' },
      { href: '/dashboard/achievements', label: 'Awards', icon: '🏆' },
      { href: '/dashboard/attendance', label: 'Attendance', icon: '✅' },
    ]},
    { title: 'Academy', items: [
      { href: '/dashboard/events', label: 'Events', icon: '🎪' },
      { href: '/dashboard/gallery', label: 'Gallery', icon: '📸' },
      { href: '/dashboard/announcements', label: 'News', icon: '📢' },
      { href: '/dashboard/documents', label: 'Documents', icon: '📄' },
      { href: '/dashboard/shop', label: 'Shop', icon: '👕' },
    ]},
    { title: 'Account', items: [
      { href: '/dashboard/payments', label: 'Payments', icon: '💳' },
      { href: '/dashboard/referrals', label: 'Refer a Friend', icon: '🎁' },
      { href: '/dashboard/messages', label: 'Messages', icon: '💬' },
      { href: '/dashboard/waivers', label: 'Waivers', icon: '📝' },
      { href: '/dashboard/account', label: 'Settings', icon: '⚙️' },
    ]},
  ],
  coach: [
    { title: '', items: [
      { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    ]},
    { title: 'Coaching', items: [
      { href: '/dashboard/players', label: 'Players', icon: '⚽' },
      { href: '/dashboard/groups', label: 'Classes', icon: '📅' },
      { href: '/dashboard/reviews', label: 'Reviews', icon: '📝' },
      { href: '/dashboard/session-notes', label: 'Session Notes', icon: '📋' },
      { href: '/dashboard/training-plans', label: 'Plans', icon: '🎯' },
    ]},
    { title: 'Schedule', items: [
      { href: '/dashboard/schedule', label: 'Calendar', icon: '🗓️' },
      { href: '/dashboard/events', label: 'Events', icon: '🎪' },
      { href: '/dashboard/attendance', label: 'Attendance', icon: '✅' },
    ]},
    { title: 'Community', items: [
      { href: '/dashboard/achievements', label: 'Awards', icon: '🏆' },
      { href: '/dashboard/gallery', label: 'Gallery', icon: '📸' },
      { href: '/dashboard/documents', label: 'Documents', icon: '📄' },
      { href: '/dashboard/parents', label: 'Parents', icon: '👨‍👩‍👧' },
      { href: '/dashboard/messages', label: 'Messages', icon: '💬' },
    ]},
  ],
  admin: [
    { title: '', items: [
      { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
      { href: '/dashboard/analytics', label: 'Analytics', icon: '📊' },
    ]},
    { title: 'People', items: [
      { href: '/dashboard/players', label: 'Players', icon: '⚽' },
      { href: '/dashboard/parents', label: 'Parents', icon: '👨‍👩‍👧' },
      { href: '/dashboard/trials', label: 'Trials', icon: '🎯' },
      { href: '/dashboard/waitlist', label: 'Waitlist', icon: '⏳' },
    ]},
    { title: 'Academy', items: [
      { href: '/dashboard/groups', label: 'Classes', icon: '📅' },
      { href: '/dashboard/schedule', label: 'Calendar', icon: '🗓️' },
      { href: '/dashboard/events', label: 'Events', icon: '🎪' },
      { href: '/dashboard/enrolments', label: 'Enrolments', icon: '📋' },
      { href: '/dashboard/attendance', label: 'Attendance', icon: '✅' },
    ]},
    { title: 'Engagement', items: [
      { href: '/dashboard/reviews', label: 'Reviews', icon: '📝' },
      { href: '/dashboard/announcements', label: 'Announcements', icon: '📢' },
      { href: '/dashboard/achievements', label: 'Awards', icon: '🏆' },
      { href: '/dashboard/gallery', label: 'Gallery', icon: '📸' },
      { href: '/dashboard/messages', label: 'Messages', icon: '💬' },
    ]},
    { title: 'Finance', items: [
      { href: '/dashboard/payments', label: 'Payments', icon: '💳' },
      { href: '/dashboard/referrals', label: 'Referrals', icon: '🎁' },
      { href: '/dashboard/promo-codes', label: 'Promo Codes', icon: '🏷️' },
      { href: '/dashboard/shop/manage', label: 'Shop', icon: '👕' },
    ]},
    { title: 'System', items: [
      { href: '/dashboard/exports', label: 'Export Data', icon: '📥' },
      { href: '/dashboard/reports', label: 'Reports', icon: '📊' },
      { href: '/dashboard/audit', label: 'Audit Log', icon: '📋' },
      { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
    ]},
  ],
}

const mobileTabItems: Record<UserRole, string[]> = {
  parent: ['/dashboard', '/dashboard/schedule', '/dashboard/payments', '/dashboard/messages', '/dashboard/account'],
  coach: ['/dashboard', '/dashboard/players', '/dashboard/groups', '/dashboard/messages', '/dashboard/schedule'],
  admin: ['/dashboard', '/dashboard/analytics', '/dashboard/groups', '/dashboard/payments', '/dashboard/settings'],
}

export default function Navigation({
  role,
  userName,
  userId,
  unreadCount,
  notificationCount,
}: {
  role: UserRole
  userName: string
  userId: string
  unreadCount?: number
  notificationCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme, resolved } = useTheme()
  const groups = navGroups[role] || []
  const allItems = groups.flatMap(g => g.items)
  const mobileTabs = mobileTabItems[role] || []
  const mobileItems = allItems.filter((i) => mobileTabs.includes(i.href))
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/signin')
  }

  function cycleTheme() {
    const order: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme)
    setTheme(order[(idx + 1) % 3])
  }

  const themeIcon = resolved === 'dark' ? '🌙' : '☀️'
  const firstName = userName.split(' ')[0]

  return (
    <>
      {/* ── Top Bar ── */}
      <nav className="sticky top-0 z-40 bg-primary border-b border-white/5">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              {/* Sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>

              <Link href="/dashboard" className="flex items-center gap-2">
                <span className="text-accent font-bold text-lg tracking-tight">Player Portal</span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <button
                onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title="Search (⌘K)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <kbd className="hidden sm:inline text-[10px] font-medium px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-white/40">
                  ⌘K
                </kbd>
              </button>

              {/* Theme */}
              <button
                onClick={cycleTheme}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title={`Theme: ${theme}`}
              >
                <span className="text-sm">{themeIcon}</span>
              </button>

              {/* Notifications */}
              <NotificationDropdown userId={userId} initialCount={notificationCount || 0} />

              {/* User */}
              <div className="hidden sm:flex items-center gap-2 ml-1 pl-2 border-l border-white/10">
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-accent">{firstName[0]?.toUpperCase()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white/80 leading-none">{firstName}</span>
                  <span className="text-[10px] text-accent/70 capitalize leading-tight">{role}</span>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                title="Sign out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Sidebar Overlay (mobile) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-64 bg-white dark:bg-primary-light border-r border-border dark:border-white/10 overflow-y-auto transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-3 space-y-1">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.title && (
                <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-light/60">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => {
                const active = pathname === item.href
                const isMessages = item.href === '/dashboard/messages'
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-accent/10 text-accent dark:bg-accent/15'
                        : 'text-text/70 hover:bg-surface-dark dark:text-white/60 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="text-base w-5 text-center">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {isMessages && (unreadCount || 0) > 0 && (
                      <span className="bg-danger text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Sidebar footer */}
        <div className="p-3 mt-2 border-t border-border dark:border-white/10 sm:hidden">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-xs font-bold text-accent">{firstName[0]?.toUpperCase()}</span>
              </div>
              <span className="text-sm font-medium text-text dark:text-white/80">{firstName}</span>
            </div>
            <button onClick={handleSignOut} className="text-xs text-red-500 font-medium">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ── */}
      <div className="mobile-bottom-nav lg:hidden bg-white dark:bg-primary-light border-t border-border dark:border-white/10">
        <div className="flex justify-around items-center h-14">
          {mobileItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 relative transition-colors ${
                  active ? 'text-accent' : 'text-text-light'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                {item.href === '/dashboard/messages' && (unreadCount || 0) > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-danger rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      <CommandPalette role={role} />
    </>
  )
}
