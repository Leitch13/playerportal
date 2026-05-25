'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SearchResult = {
  id: string
  category: 'Quick Links' | 'Players' | 'Parents' | 'Groups'
  icon: string
  name: string
  subtitle: string
  href: string
}

const QUICK_LINKS = [
  { label: 'Players', href: '/dashboard/players', icon: '⚽' },
  { label: 'Payments', href: '/dashboard/payments', icon: '💳' },
  { label: 'Attendance', href: '/dashboard/attendance', icon: '✅' },
  { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
  { label: 'Leads', href: '/dashboard/leads', icon: '🎯' },
  { label: 'Messages', href: '/dashboard/messages', icon: '💬' },
  { label: 'Schedule', href: '/dashboard/schedule', icon: '🗓️' },
]

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

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

  // Focus input on open, reset on close
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search logic
  const doSearch = useCallback((q: string) => {
    const trimmed = q.trim().toLowerCase()

    // Quick link results (always filtered)
    const quickLinkResults: SearchResult[] = QUICK_LINKS
      .filter((p) => p.label.toLowerCase().includes(trimmed))
      .map((p) => ({
        id: `link-${p.href}`,
        category: 'Quick Links' as const,
        icon: p.icon,
        name: p.label,
        subtitle: p.href,
        href: p.href,
      }))

    if (!trimmed) {
      setResults(quickLinkResults)
      setActiveIndex(0)
      setLoading(false)
      return
    }

    setLoading(true)
    const supabase = createClient()

    const playerSearch = supabase
      .from('players')
      .select('id, first_name, last_name, age_group')
      .or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%`)
      .limit(5)
      .then(({ data }) =>
        (data || []).map((p) => ({
          id: `player-${p.id}`,
          category: 'Players' as const,
          icon: '⚽',
          name: `${p.first_name} ${p.last_name}`,
          subtitle: p.age_group || 'Player',
          href: `/dashboard/players/${p.id}`,
        }))
      )

    const parentSearch = supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'parent')
      .ilike('full_name', `%${trimmed}%`)
      .limit(5)
      .then(({ data }) =>
        (data || []).map((p) => ({
          id: `parent-${p.id}`,
          category: 'Parents' as const,
          icon: '👨\u200D👩\u200D👧',
          name: p.full_name || p.email || 'Unknown',
          subtitle: p.email || 'Parent',
          href: '/dashboard/parents',
        }))
      )

    const groupSearch = supabase
      .from('training_groups')
      .select('id, name, day_of_week')
      .ilike('name', `%${trimmed}%`)
      .limit(5)
      .then(({ data }) =>
        (data || []).map((g) => ({
          id: `group-${g.id}`,
          category: 'Groups' as const,
          icon: '📅',
          name: g.name,
          subtitle: g.day_of_week || 'Training Group',
          href: `/dashboard/groups/${g.id}`,
        }))
      )

    Promise.all([playerSearch, parentSearch, groupSearch]).then(([players, parents, groups]) => {
      setResults([...quickLinkResults, ...players, ...parents, ...groups])
      setActiveIndex(0)
      setLoading(false)
    })
  }, [])

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

  function selectResult(result: SearchResult) {
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
    const map = new Map<string, SearchResult[]>()
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
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 bg-[#141414] rounded-xl shadow-2xl border border-[#1e1e1e] overflow-hidden animate-[search-in_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e1e]">
          <svg
            className="w-5 h-5 text-[#4ecde6] shrink-0"
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
            placeholder="Search players, parents, groups, pages..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-[#1e1e1e] rounded border border-[#2a2a2a]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {loading && (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">Searching...</div>
          )}

          {!loading && results.length === 0 && query.trim() && (
            <p className="px-4 py-8 text-sm text-gray-500 text-center">No results found.</p>
          )}

          {!loading && results.length === 0 && !query.trim() && (
            <p className="px-4 py-8 text-sm text-gray-500 text-center">
              Start typing to search...
            </p>
          )}

          {!loading &&
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
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
                          ? 'bg-[#4ecde6]/10 text-[#4ecde6]'
                          : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <span className="text-lg shrink-0">{result.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{result.name}</div>
                        <div className="text-xs text-gray-500 truncate">{result.subtitle}</div>
                      </div>
                      {isActive && (
                        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-[#1e1e1e] rounded border border-[#2a2a2a]">
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
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#1e1e1e] text-[11px] text-gray-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[#1e1e1e] rounded border border-[#2a2a2a] text-[10px]">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[#1e1e1e] rounded border border-[#2a2a2a] text-[10px]">
                ↵
              </kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-[#1e1e1e] rounded border border-[#2a2a2a] text-[10px]">
              Esc
            </kbd>
            Close
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes search-in {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
