'use client'

/**
 * Sprint 8b v1 — Move Player modal.
 *
 * Shared client component used by both entry points:
 *   • Class Roster (ClassRosterRow kebab) — `sourceEnrolmentId` known
 *   • Player Profile Actions menu — caller picks which enrolment to move
 *
 * The modal:
 *   1. lists every other class in the org with capacity hints
 *   2. lets the admin pick "today" or a future date (≤ 90 days)
 *   3. lets the admin add an internal-only reason (audit row)
 *   4. confirms the move and shows a "what will happen" panel
 *
 * Submits to /api/enrolments/move and refreshes the page on success.
 * Capacity / past-due / plan-tier validation is fully server-side; this
 * client just shows hints + the server's friendly errors.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export interface MovePlayerModalProps {
  open: boolean
  onClose: () => void
  sourceEnrolmentId: string
  sourceGroupId: string
  sourceGroupName: string
  playerId: string
  playerFirstName: string
  playerLastName: string
  organisationId: string
  /** Optional callback to let the host page reload its own data
   *  instead of calling router.refresh(). */
  onSuccess?: () => void
}

interface CandidateClass {
  id: string
  name: string
  day_of_week: string | null
  time_slot: string | null
  class_type: string | null
  max_capacity: number | null
  current_seat_count: number
}

export default function MovePlayerModal({
  open,
  onClose,
  sourceEnrolmentId,
  sourceGroupId,
  sourceGroupName,
  playerId,
  playerFirstName,
  playerLastName,
  organisationId,
  onSuccess,
}: MovePlayerModalProps) {
  const router = useRouter()
  const supabase = createClient()
  const [candidates, setCandidates] = useState<CandidateClass[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [mode, setMode] = useState<'today' | 'future'>('today')
  const [futureDate, setFutureDate] = useState<string>('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const playerName = `${playerFirstName} ${playerLastName}`.trim() || 'this player'

  // Today's date in ISO yyyy-mm-dd for the date input min.
  const todayIso = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString().split('T')[0]
  }, [])
  const maxFutureIso = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 90)
    return d.toISOString().split('T')[0]
  }, [])

  const loadCandidates = useCallback(async () => {
    setLoadingCandidates(true)
    try {
      // All other classes in this org. We filter the source out client-side.
      const { data: groups } = await supabase
        .from('training_groups')
        .select('id, name, day_of_week, time_slot, class_type, max_capacity')
        .eq('organisation_id', organisationId)
        .neq('id', sourceGroupId)
        .order('day_of_week', { ascending: true })
        .order('time_slot', { ascending: true })

      // Current seat counts per group via the existing anon-callable RPC.
      const { data: counts } = await supabase
        .rpc('get_group_seat_counts', { p_org_id: organisationId })
      const countMap = new Map<string, number>()
      for (const r of (counts || []) as Array<{ group_id: string; seat_count: number | string }>) {
        countMap.set(r.group_id, Number(r.seat_count) || 0)
      }

      const list: CandidateClass[] = (groups || []).map((g) => ({
        id: g.id as string,
        name: (g.name as string) || 'Unnamed class',
        day_of_week: (g.day_of_week as string | null) || null,
        time_slot: (g.time_slot as string | null) || null,
        class_type: (g.class_type as string | null) || null,
        max_capacity: (g.max_capacity as number | null) ?? null,
        current_seat_count: countMap.get(g.id as string) ?? 0,
      }))
      setCandidates(list)
    } catch (e) {
      console.error('MovePlayerModal: candidate load failed', e)
      setError('Could not load the list of classes. Try again.')
    } finally {
      setLoadingCandidates(false)
    }
  }, [supabase, organisationId, sourceGroupId])

  useEffect(() => {
    if (!open) {
      setSelectedGroupId(null)
      setMode('today')
      setFutureDate('')
      setReason('')
      setError(null)
      return
    }
    void loadCandidates()
  }, [open, loadCandidates])

  if (!open) return null

  const selected = candidates.find((c) => c.id === selectedGroupId) || null
  const seatsLeft = selected?.max_capacity != null
    ? selected.max_capacity - selected.current_seat_count
    : null
  const isFull = seatsLeft != null && seatsLeft <= 0

  const effectiveDate = mode === 'today' ? todayIso : futureDate

  async function submit() {
    if (!selectedGroupId) { setError('Pick a class to move to.'); return }
    if (mode === 'future' && !futureDate) { setError('Pick a future date.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/enrolments/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrolmentId: sourceEnrolmentId,
          destinationGroupId: selectedGroupId,
          effectiveDate: mode === 'today' ? null : futureDate,
          reason: reason.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.error === 'class_full') {
          setError('That class is full. Pick another, or wait for a seat to open.')
        } else {
          setError(data?.message || data?.error || 'Move failed. Please try again.')
        }
        setSubmitting(false)
        return
      }
      // Success — let host refresh, otherwise route refresh.
      onClose()
      if (onSuccess) onSuccess()
      else router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-player-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/75 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      data-testid="move-player-modal"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#0f0f0f] border border-white/10 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mb-1">Move class</p>
            <h2 id="move-player-title" className="text-white text-lg font-bold truncate">
              Move {playerName} out of {sourceGroupName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {/* Destination class picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/55 mb-2">Destination class</label>
            {loadingCandidates ? (
              <div className="text-white/40 text-sm py-3">Loading classes…</div>
            ) : candidates.length === 0 ? (
              <div className="text-white/50 text-sm py-3">This academy doesn&apos;t have any other classes to move to.</div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {candidates.map((c) => {
                  const capLeft = c.max_capacity != null ? c.max_capacity - c.current_seat_count : null
                  const fullChip = capLeft != null && capLeft <= 0
                  const isSel = selectedGroupId === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => !fullChip && setSelectedGroupId(c.id)}
                      disabled={fullChip}
                      className={
                        `w-full text-left px-3 py-2.5 rounded-lg border transition-colors flex items-center justify-between gap-3 ` +
                        (fullChip
                          ? 'border-white/[0.05] bg-white/[0.02] opacity-50 cursor-not-allowed'
                          : isSel
                            ? 'border-[#4ecde6]/60 bg-[#4ecde6]/[0.08]'
                            : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]')
                      }
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                        <div className="text-[11px] text-white/45 truncate">
                          {[c.day_of_week, c.time_slot].filter(Boolean).join(' · ') || '—'}
                          {c.class_type ? ` · ${c.class_type}` : ''}
                        </div>
                      </div>
                      <div className="shrink-0 text-[11px] text-right">
                        {fullChip ? (
                          <span className="text-red-300 font-bold uppercase tracking-wider">Full</span>
                        ) : capLeft != null ? (
                          <span className="text-white/55">{c.current_seat_count}/{c.max_capacity} seats</span>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* When */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/55 mb-2">When?</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <label className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${mode === 'today' ? 'border-[#4ecde6]/60 bg-[#4ecde6]/[0.08]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
                <input
                  type="radio"
                  name="move-when"
                  className="accent-[#4ecde6]"
                  checked={mode === 'today'}
                  onChange={() => setMode('today')}
                />
                <div>
                  <div className="text-sm font-semibold text-white">From today</div>
                  <div className="text-[11px] text-white/45">{playerName} is on the new register immediately.</div>
                </div>
              </label>
              <label className={`flex-1 flex items-start gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${mode === 'future' ? 'border-[#4ecde6]/60 bg-[#4ecde6]/[0.08]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
                <input
                  type="radio"
                  name="move-when"
                  className="accent-[#4ecde6] mt-1"
                  checked={mode === 'future'}
                  onChange={() => setMode('future')}
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">From a future date</div>
                  <input
                    type="date"
                    value={futureDate}
                    min={todayIso}
                    max={maxFutureIso}
                    onChange={(e) => { setMode('future'); setFutureDate(e.target.value) }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1.5 w-full px-2 py-1.5 rounded-md bg-[#0a0a0a] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#4ecde6]/60"
                  />
                </div>
              </label>
            </div>
          </div>

          {/* Internal reason */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/55 mb-2">Internal reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Coach availability change"
              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-white/[0.08] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/60"
              maxLength={200}
            />
            <p className="text-[11px] text-white/40 mt-1">Visible to academy staff only — not shown to the parent.</p>
          </div>

          {/* "What will happen" preview */}
          {selected && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 text-sm space-y-1.5">
              <p className="text-emerald-300 font-bold mb-1">What will happen</p>
              <p className="text-emerald-100/80 leading-snug">
                <span className="text-emerald-300/90 font-semibold">✓</span> {playerName}&apos;s attendance, progress reviews and billing history stay intact.
              </p>
              <p className="text-emerald-100/80 leading-snug">
                <span className="text-emerald-300/90 font-semibold">✓</span> The parent will be emailed a confirmation.
              </p>
              <p className="text-emerald-100/80 leading-snug">
                <span className="text-emerald-300/90 font-semibold">✓</span> {mode === 'today'
                  ? `${playerName} appears on the ${selected.name} register from today.`
                  : `${playerName} keeps attending ${sourceGroupName} until ${futureDate || '—'}, then moves to ${selected.name}.`}
              </p>
              {isFull && (
                <p className="text-amber-200 mt-2">
                  <span className="text-amber-300 font-semibold">!</span> That class is currently full; the move will be blocked. Pick another.
                </p>
              )}
            </div>
          )}

          {error && (
            <div data-testid="move-player-error" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white/70 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !selectedGroupId || (mode === 'future' && !futureDate) || isFull || candidates.length === 0}
            className="px-5 py-2.5 rounded-lg text-sm font-extrabold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#6dd8ee] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Moving…' : `Move ${playerFirstName} →`}
          </button>
        </div>
      </div>
    </div>
  )
}
