'use client'

import { useState, useEffect, useRef } from 'react'

interface Academy {
  id: string
  name: string
  slug: string
  logo_url: string | null
  location: string | null
}

interface AcademySearchProps {
  onSelect: (academy: Academy) => void
  inputClassName?: string
}

export default function AcademySearch({ onSelect, inputClassName }: AcademySearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Academy[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/academies/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data)
        setIsOpen(data.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const defaultInputCls = inputClassName || "w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true) }}
          placeholder="Search for your academy..."
          className={`${defaultInputCls} pl-10`}
        />
        {loading && (
          <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] shadow-2xl overflow-hidden">
          {results.map((academy) => (
            <button
              key={academy.id}
              type="button"
              onClick={() => {
                onSelect(academy)
                setQuery('')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#222] transition-colors text-left"
            >
              {academy.logo_url ? (
                <img src={academy.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-[#2a2a2a]" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white/40">{academy.name.charAt(0)}</span>
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{academy.name}</div>
                {academy.location && <div className="text-xs text-white/40 truncate">{academy.location}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      {query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] shadow-2xl px-4 py-3">
          <p className="text-sm text-white/40">No academies found</p>
        </div>
      )}

      <p className="text-xs text-white/25 mt-2">
        Can&apos;t find your academy? Ask them for their booking link.
      </p>
    </div>
  )
}
