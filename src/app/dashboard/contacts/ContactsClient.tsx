'use client'

import { useMemo, useState } from 'react'

export type Contact = {
  name: string
  parentName: string | null
  parentEmail: string | null
  source: 'member' | 'camp' | 'trial'
  enrolled: boolean
  playerId?: string
  // camp/trial provenance (for the past/upcoming split)
  campLabel?: string | null   // e.g. "JAF Charity Camp"
  campDate?: string | null    // e.g. "13 Jul 2026"
  timing?: 'past' | 'upcoming' | null
}

type Tab = 'all' | 'enrolled' | 'camp' | 'trial'
type CampFilter = 'all' | 'past' | 'upcoming'

const SOURCE_PILL: Record<Contact['source'], { label: string; cls: string }> = {
  member: { label: 'Member', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  camp: { label: 'Camp', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  trial: { label: 'Trial', cls: 'bg-white/10 text-white/60 border-white/20' },
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

export default function ContactsClient({ contacts }: { contacts: Contact[]; orgSlug: string }) {
  const [tab, setTab] = useState<Tab>('all')
  const [campFilter, setCampFilter] = useState<CampFilter>('all')
  const [q, setQ] = useState('')

  const counts = useMemo(() => ({
    all: contacts.length,
    enrolled: contacts.filter(c => c.enrolled).length,
    camp: contacts.filter(c => c.source === 'camp').length,
    trial: contacts.filter(c => c.source === 'trial').length,
    campPast: contacts.filter(c => c.source === 'camp' && c.timing === 'past').length,
    campUpcoming: contacts.filter(c => c.source === 'camp' && c.timing === 'upcoming').length,
  }), [contacts])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return contacts.filter(c => {
      if (tab === 'enrolled' && !c.enrolled) return false
      if (tab === 'camp' && c.source !== 'camp') return false
      if (tab === 'trial' && c.source !== 'trial') return false
      if (tab === 'camp' && campFilter !== 'all' && c.timing !== campFilter) return false
      if (needle && !(`${c.name} ${c.parentName || ''} ${c.parentEmail || ''} ${c.campLabel || ''}`.toLowerCase().includes(needle))) return false
      return true
    })
  }, [contacts, tab, campFilter, q])

  const TABS: { key: Tab; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: counts.all },
    { key: 'enrolled', label: 'Enrolled', n: counts.enrolled },
    { key: 'camp', label: 'Camp only', n: counts.camp },
    { key: 'trial', label: 'Trial only', n: counts.trial },
  ]

  return (
    <div className="bg-[#080e18] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-sm text-white/60 mt-0.5">
            Everyone who&apos;s ever booked — members, camps and trials — in one place. Camp &amp; trial kids can be added straight into a class.
          </p>
        </div>

        {/* tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                tab === t.key
                  ? 'bg-[#4ecde6] text-black border-[#4ecde6]'
                  : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs font-mono ${tab === t.key ? 'text-black/60' : 'text-white/40'}`}>{t.n}</span>
            </button>
          ))}
        </div>

        {/* camp past/upcoming sub-filter — only on the Camp tab */}
        {tab === 'camp' && (
          <div className="flex flex-wrap items-center gap-2 -mt-2">
            <span className="text-xs text-white/40">Show:</span>
            {([
              { key: 'all', label: 'All camps', n: counts.camp },
              { key: 'past', label: 'Past — re-engage', n: counts.campPast },
              { key: 'upcoming', label: 'Upcoming — live', n: counts.campUpcoming },
            ] as { key: CampFilter; label: string; n: number }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setCampFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  campFilter === f.key
                    ? 'bg-amber-400/20 text-amber-200 border-amber-400/40'
                    : 'bg-white/[0.03] text-white/60 border-white/10 hover:bg-white/[0.06]'
                }`}
              >
                {f.label} <span className="font-mono opacity-70">{f.n}</span>
              </button>
            ))}
          </div>
        )}

        {/* search */}
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search a child name or parent email…"
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#4ecde6]/50"
        />

        {/* list */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10 text-center text-white/40 text-sm">No contacts match.</div>
          ) : (
            rows.map((c, i) => {
              const pill = SOURCE_PILL[c.source]
              const canAdd = c.source !== 'member'
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.06] grid place-items-center text-xs font-bold text-white/70 flex-shrink-0">
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{c.name}</div>
                    <div className="text-xs text-white/50 truncate">
                      {c.parentName || 'Unknown parent'}{c.parentEmail ? ` · ${c.parentEmail}` : ''}
                    </div>
                    {c.source === 'camp' && c.campLabel && (
                      <div className="text-[11px] truncate mt-0.5">
                        <span className={c.timing === 'upcoming' ? 'text-emerald-400 font-semibold' : 'text-amber-400/80 font-semibold'}>
                          {c.timing === 'upcoming' ? 'Upcoming' : 'Past'}
                        </span>
                        <span className="text-white/35"> · {c.campLabel}{c.campDate ? ` · ${c.campDate}` : ''}</span>
                      </div>
                    )}
                  </div>
                  {c.enrolled && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex-shrink-0">ENROLLED</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${pill.cls}`}>{pill.label}</span>
                  {canAdd && (
                    <button
                      onClick={() => alert(`"Add to class" for ${c.name} — wiring the promote flow next.`)}
                      className="flex-shrink-0 text-xs font-semibold border border-[#4ecde6]/60 text-[#4ecde6] rounded-lg px-2.5 py-1.5 hover:bg-[#4ecde6]/10 transition-colors"
                    >
                      Add to class
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
        <p className="text-xs text-white/30">{rows.length} shown</p>
      </div>
    </div>
  )
}
