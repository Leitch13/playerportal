'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { PaletteIcon } from '@/components/ui/PaletteIcon'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'

type Result = {
  id: string
  category: 'Pages' | 'Players' | 'Parents' | 'Groups'
  icon: string
  name: string
  subtitle: string
  href: string
}

type NavPage = { label: string; href: string; icon: string }

const pagesByRole: Record<UserRole, NavPage[]> = {
  admin: [
    { label: 'Dashboard', href: '/dashboard', icon: 'home' },
    { label: 'Players', href: '/dashboard/players', icon: 'players' },
    { label: 'Parents', href: '/dashboard/parents', icon: 'parents' },
    { label: 'Sessions', href: '/dashboard/groups', icon: 'calendar' },
    { label: 'Calendar', href: '/dashboard/schedule', icon: 'calendar' },
    { label: 'Events', href: '/dashboard/events', icon: 'events' },
    { label: 'Reviews', href: '/dashboard/reviews', icon: 'pencil' },
    { label: 'Awards', href: '/dashboard/achievements', icon: 'trophy' },
    { label: 'Gallery', href: '/dashboard/gallery', icon: 'camera' },
    { label: 'Enrolments', href: '/dashboard/enrolments', icon: 'list' },
    { label: 'Attendance', href: '/dashboard/attendance', icon: 'check' },
    { label: 'Notes', href: '/dashboard/session-notes', icon: 'list' },
    { label: 'Waivers', href: '/dashboard/waivers', icon: 'pencil' },
    { label: 'Docs', href: '/dashboard/documents', icon: 'doc' },
    { label: 'Plans', href: '/dashboard/training-plans', icon: 'target' },
    { label: 'Payments', href: '/dashboard/payments', icon: 'card' },
    { label: 'Promos', href: '/dashboard/promo-codes', icon: 'tag' },
    { label: 'Referrals', href: '/dashboard/referrals', icon: 'gift' },
    { label: 'Reports', href: '/dashboard/reports', icon: 'chart' },
    { label: 'Messages', href: '/dashboard/messages', icon: 'chat' },
  ],
  coach: [
    { label: 'Dashboard', href: '/dashboard', icon: 'home' },
    { label: 'Players', href: '/dashboard/players', icon: 'players' },
    { label: 'Sessions', href: '/dashboard/groups', icon: 'calendar' },
    { label: 'Calendar', href: '/dashboard/schedule', icon: 'calendar' },
    { label: 'Events', href: '/dashboard/events', icon: 'events' },
    { label: 'Reviews', href: '/dashboard/reviews', icon: 'pencil' },
    { label: 'Awards', href: '/dashboard/achievements', icon: 'trophy' },
    { label: 'Gallery', href: '/dashboard/gallery', icon: 'camera' },
    { label: 'Attendance', href: '/dashboard/attendance', icon: 'check' },
    { label: 'Notes', href: '/dashboard/session-notes', icon: 'list' },
    { label: 'Docs', href: '/dashboard/documents', icon: 'doc' },
    { label: 'Plans', href: '/dashboard/training-plans', icon: 'target' },
    { label: 'Messages', href: '/dashboard/messages', icon: 'chat' },
    { label: 'Parents', href: '/dashboard/parents', icon: 'parents' },
  ],
  parent: [
    { label: 'Home', href: '/dashboard', icon: 'home' },
    { label: 'My Children', href: '/dashboard/children', icon: 'child' },
    { label: 'Schedule', href: '/dashboard/schedule', icon: 'calendar' },
    { label: 'Events', href: '/dashboard/events', icon: 'events' },
    { label: 'Progress', href: '/dashboard/feedback', icon: 'chart' },
    { label: 'Awards', href: '/dashboard/achievements', icon: 'trophy' },
    { label: 'Gallery', href: '/dashboard/gallery', icon: 'camera' },
    { label: 'Attendance', href: '/dashboard/attendance', icon: 'check' },
    { label: 'Waivers', href: '/dashboard/waivers', icon: 'pencil' },
    { label: 'Docs', href: '/dashboard/documents', icon: 'doc' },
    { label: 'Payments', href: '/dashboard/payments', icon: 'card' },
    { label: 'Refer', href: '/dashboard/referrals', icon: 'gift' },
    { label: 'Messages', href: '/dashboard/messages', icon: 'chat' },
    { label: 'Account', href: '/dashboard/account', icon: 'cog' },
  ],
}



export default function CommandPalette({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const pages = useMemo(() => pagesByRole[role] || [], [role])

  // Open / close with Cmd+K / Ctrl+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Also listen for custom event from nav button
  useEffect(() => {
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener('open-command-palette', onOpen)
    return () => window.removeEventListener('open-command-palette', onOpen)
  }, [])

  // Focus input on open, reset on close
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search logic with debounce
  const doSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim().toLowerCase()

      // Static page results
      const pageResults: Result[] = pages
        .filter((p) => p.label.toLowerCase().includes(trimmed))
        .map((p) => ({
          id: `page-${p.href}`,
          category: 'Pages' as const,
          icon: p.icon,
          name: p.label,
          subtitle: 'Page',
          href: p.href,
        }))

      if (!trimmed) {
        setResults(pageResults.slice(0, 8))
        setActiveIndex(0)
        return
      }

      // Supabase queries
      const supabase = createClient()
      const promises: Promise<Result[]>[] = []

      // Players
      promises.push(
        Promise.resolve(
          supabase
            .from('players')
            .select('id, first_name, last_name, age_group')
            .or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%`)
            .limit(5)
            .then(({ data }) =>
              (data || []).map((p) => ({
                id: `player-${p.id}`,
                category: 'Players' as const,
                icon: 'players',
                name: `${p.first_name} ${p.last_name}`,
                subtitle: p.age_group || 'Player',
                href: `/dashboard/players/${p.id}`,
              }))
            )
        )
      )

      // Parents (admin/coach only)
      if (role !== 'parent') {
        promises.push(
          Promise.resolve(
            supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('role', 'parent')
              .ilike('full_name', `%${trimmed}%`)
              .limit(5)
              .then(({ data }) =>
                (data || []).map((p) => ({
                  id: `parent-${p.id}`,
                  category: 'Parents' as const,
                  icon: 'parents',
                  name: p.full_name || p.email,
                  subtitle: p.email || 'Parent',
                  href: '/dashboard/parents',
                }))
              )
          )
        )
      }

      // Groups (admin/coach only)
      if (role !== 'parent') {
        promises.push(
          Promise.resolve(
            supabase
              .from('training_groups')
              .select('id, name, day_of_week')
              .ilike('name', `%${trimmed}%`)
              .limit(5)
              .then(({ data }) =>
                (data || []).map((g) => ({
                  id: `group-${g.id}`,
                  category: 'Groups' as const,
                  icon: 'calendar',
                  name: g.name,
                  subtitle: g.day_of_week || 'Group',
                  href: '/dashboard/groups',
              }))
            )
          )
        )
      }

      Promise.all(promises).then((arrays) => {
        const dbResults = arrays.flat()
        setResults([...pageResults, ...dbResults])
        setActiveIndex(0)
      })
    },
    [pages, role]
  )

  // Debounced query effect
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, doSearch])

  // Keyboard navigation
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[activeIndex]) {
        selectResult(results[activeIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  function selectResult(result: Result) {
    setOpen(false)
    router.push(result.href)
  }

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const active = listRef.current.querySelector('[data-active="true"]')
    if (active) {
      active.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  // Group results by category
  const grouped = useMemo(() => {
    const map = new Map<string, Result[]>()
    for (const r of results) {
      const arr = map.get(r.category) || []
      arr.push(r)
      map.set(r.category, arr)
    }
    return map
  }, [results])

  if (!open) return null

  let flatIndex = -1

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] animate-fade-in"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#142236] rounded-xl shadow-2xl border border-[#1d2c42] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1d2c42]">
          <svg
            className="w-5 h-5 text-[#93a2ba] shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, players, parents, groups..."
            className="flex-1 bg-transparent text-sm text-[#eef2f9] outline-none placeholder:text-[#93a2ba]"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-[#93a2ba] bg-[#0f1a2b] dark:bg-primary/10 rounded border border-[#1d2c42]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {results.length === 0 && query.trim() && (
            <p className="px-4 py-8 text-sm text-[#93a2ba] text-center">
              No results found.
            </p>
          )}

          {results.length === 0 && !query.trim() && (
            <p className="px-4 py-8 text-sm text-[#93a2ba] text-center">
              Start typing to search...
            </p>
          )}

          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <div className="px-4 py-1.5 text-[11px] font-semibold text-[#93a2ba] uppercase tracking-wider">
                {category}
              </div>
              {items.map((result) => {
                flatIndex++
                const isActive = flatIndex === activeIndex
                const idx = flatIndex
                return (
                  <button
                    key={result.id}
                    data-active={isActive}
                    onClick={() => selectResult(result)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-accent/10 text-accent'
                        : 'text-[#eef2f9] hover:bg-accent/5'
                    }`}
                  >
                    <PaletteIcon name={result.icon} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{result.name}</div>
                      <div className="text-xs text-[#93a2ba] truncate">{result.subtitle}</div>
                    </div>
                    {isActive && (
                      <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[#93a2ba] bg-[#0f1a2b] dark:bg-primary/10 rounded border border-[#1d2c42]">
                        Enter
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#1d2c42] text-[11px] text-[#93a2ba]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[#0f1a2b] dark:bg-primary/10 rounded border border-[#1d2c42] text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[#0f1a2b] dark:bg-primary/10 rounded border border-[#1d2c42] text-[10px]">↵</kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-[#0f1a2b] dark:bg-primary/10 rounded border border-[#1d2c42] text-[10px]">Esc</kbd>
            Close
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out;
        }
      `}</style>
    </div>
  )
}
