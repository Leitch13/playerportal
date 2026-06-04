/**
 * Sprint 9 — Add Player to Camp (admin manual entry).
 *
 * Lives on /dashboard/camps/[campId]. Lets the admin search the academy's
 * roster, pick a player, optionally enter an amount paid (e.g. cash or
 * external transfer), and POST to the admin add-player route.
 *
 * Re-uses the standard kebab + modal pattern from the Sprint 8a roster.
 * No new component library, no new icons — same emoji + Tailwind shapes
 * used elsewhere.
 */
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

export interface RosterPlayer {
  id: string
  first_name: string
  last_name: string
  parentName: string | null
}

export default function AddPlayerToCamp({
  campId,
  campName,
  players,
}: {
  campId: string
  campName: string
  players: RosterPlayer[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return players.slice(0, 50)
    return players
      .filter(
        (p) =>
          (p.first_name + ' ' + p.last_name).toLowerCase().includes(q) ||
          (p.parentName || '').toLowerCase().includes(q),
      )
      .slice(0, 50)
  }, [search, players])

  async function submit() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/camps/${campId}/add-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selected,
          amountPaid: Number(amount) || 0,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setError((json as { error?: string }).error || `HTTP ${res.status}`)
        setSubmitting(false)
        return
      }
      // Success — reset, close, refresh.
      setOpen(false)
      setSelected('')
      setSearch('')
      setAmount('')
      setSubmitting(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="camp-add-player-button"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#4ecde6] text-black hover:bg-[#3dbdd6] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add player
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !submitting && setOpen(false)}
          data-testid="camp-add-player-modal"
        >
          <div
            className="bg-[#141414] border border-[#1e1e1e] rounded-2xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold text-white">Add a player to {campName}</h3>
              <p className="text-sm text-white/60 mt-1">
                Pick an existing player from your academy. No Stripe charge — this is a manual entry
                (e.g. cash, external transfer, comp).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                Search by player or parent name
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type a name…"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#0a0a0a] border border-[#1e1e1e] text-white placeholder-white/30 focus:border-[#4ecde6] focus:outline-none"
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-[#1e1e1e] divide-y divide-white/[0.05]">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-white/40 text-center">No players match.</div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    data-testid="camp-add-player-row"
                    className={`w-full px-4 py-2.5 text-left transition-colors ${
                      selected === p.id
                        ? 'bg-[#4ecde6]/10 border-l-2 border-[#4ecde6]'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{p.first_name} {p.last_name}</div>
                    {p.parentName && (
                      <div className="text-[11px] text-white/40">Parent: {p.parentName}</div>
                    )}
                  </button>
                ))
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                Amount paid (optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 text-sm rounded-lg bg-[#0a0a0a] border border-[#1e1e1e] text-white placeholder-white/30 focus:border-[#4ecde6] focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-white/40 mt-1">
                Leave 0 for comps. Otherwise enter what the parent paid you outside Stripe.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={submit}
                disabled={!selected || submitting}
                data-testid="camp-add-player-confirm"
                className="flex-1 px-4 py-2.5 text-sm font-bold rounded-xl bg-[#4ecde6] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3dbdd6] transition-colors"
              >
                {submitting ? 'Adding…' : 'Add to camp'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="px-4 py-2.5 text-sm font-bold rounded-xl bg-white/10 text-white hover:bg-white/15 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
