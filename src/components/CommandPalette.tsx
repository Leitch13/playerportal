'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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


// Consistent stroked icon set for palette rows — replaces the emoji strings
// (mixed-style emoji read as unfinished; these match the app's line icons).
const PALETTE_ICON_PATHS: Record<string, React.ReactNode> = {
  home: <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5" />,
  players: <><circle cx="12" cy="12" r="9" /><path d="M12 3a18 18 0 010 18M3.5 9h17M3.5 15h17" strokeLinecap="round" /></>,
  parents: <><circle cx="9" cy="8" r="3.2" /><path strokeLinecap="round" d="M2.8 20a6.2 6.2 0 0112.4 0" /><path strokeLinecap="round" d="M16.6 8.4a2.8 2.8 0 010 5.2M18.4 20a5.8 5.8 0 00-2.2-4.1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path strokeLinecap="round" d="M8 3v4M16 3v4M3 10h18" /></>,
  events: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5l-2.1 2.1M8.6 15.4l-2.1 2.1m0-11l2.1 2.1m6.8 6.8l2.1 2.1" />,
  pencil: <path strokeLinecap="round" strokeLinejoin="round" d="M16.6 4.5l2.9 2.9L8 19H5v-3L16.6 4.5zM14.5 6.6l2.9 2.9" />,
  trophy: <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m-6-17h12v4a6 6 0 01-12 0V4zM6 5H3.5a0 0 0 000 0A4.5 4.5 0 008 9.5M18 5h2.5A4.5 4.5 0 0116 9.5" />,
  camera: <><path strokeLinecap="round" strokeLinejoin="round" d="M4 8h3l2-2.5h6L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /><circle cx="12" cy="13.5" r="3.4" /></>,
  list: <path strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  check: <path strokeLinecap="round" strokeLinejoin="round" d="M4 12.5l5 5L20 6.5" />,
  doc: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l5.4 5.4a1 1 0 01.3.7V19a2 2 0 01-2 2z" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  card: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path strokeLinecap="round" d="M3 10.5h18M7 15h4" /></>,
  tag: <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 12.5l8-8H20v8.5l-8 8a1.5 1.5 0 01-2.1 0l-6.4-6.4a1.5 1.5 0 010-2.1zM16 8h.01" />,
  gift: <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8m8-5v14M3 7.5h18V12H3V7.5zm9 0s-1.5-4-4.2-4a2.1 2.1 0 000 4.2M12 7.5s1.5-4 4.2-4a2.1 2.1 0 010 4.2" />,
  chart: <path strokeLinecap="round" d="M4 19V9M10 19V4M16 19v-7M21 19H3" />,
  chat: <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 01-8 8H4l2.3-2.9A8 8 0 1121 12z" />,
  child: <><circle cx="12" cy="7.5" r="3.5" /><path strokeLinecap="round" d="M5.5 21a6.5 6.5 0 0113 0" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2.5l1 2.6 2.7-.6 1 1.8 2.4 1.4-.6 2.7 2 1.6-1 2.5-2.6 1-.1 2.8-2.5.9-1.6 2.3h-2.9l-1.6-2.3-2.5-.9-.1-2.8-2.6-1-1-2.5 2-1.6-.6-2.7L6.3 6.3l1-1.8 2.7.6 1-2.6z" /></>,
}

function PaletteIcon({ name }: { name: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.05] text-[#8fa2bd]">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        {PALETTE_ICON_PATHS[name] || PALETTE_ICON_PATHS.doc}
      </svg>
    </span>
  )
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
