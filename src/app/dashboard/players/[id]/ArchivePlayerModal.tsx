'use client'

/**
 * Sprint 7 — Archive Player Modal
 *
 * Reversible, history-preserving alternative to the legacy
 * DeletePlayerButton (removed this sprint).
 *
 * Flow:
 *   1. Open button → modal opens
 *   2. Admin picks reason (required), optional notes
 *   3. If `hasActiveSubscription`, shows the Stripe-cancel toggle
 *      (default ON — cancel at period end, no proration)
 *   4. POST /api/players/[id]/archive
 *   5. On success → redirect to /dashboard/players?filter=archived so the
 *      admin can immediately see the row in archived view
 *
 * Does NOT touch Stripe, RLS, schema, or any other player. Pure UI.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Reason =
  | 'left_academy'
  | 'moved_away'
  | 'injury'
  | 'temporary_break'
  | 'duplicate_record'
  | 'other'

const REASON_LABELS: Array<{ key: Reason; label: string }> = [
  { key: 'left_academy',     label: 'Left academy' },
  { key: 'moved_away',       label: 'Moved away' },
  { key: 'injury',           label: 'Injury' },
  { key: 'temporary_break',  label: 'Temporary break' },
  { key: 'duplicate_record', label: 'Duplicate record' },
  { key: 'other',            label: 'Other' },
]

export default function ArchivePlayerModal({
  playerId,
  playerName,
  hasActiveSubscription,
}: {
  playerId: string
  playerName: string
  hasActiveSubscription: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<Reason | ''>('')
  const [notes, setNotes] = useState('')
  const [cancelSubs, setCancelSubs] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleArchive() {
    if (!reason) {
      setError('Please pick a reason.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/players/${playerId}/archive`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reason,
          notes: notes.trim() || null,
          cancelSubs,
        }),
      })
      const json = await res.json().catch(() => ({} as { ok?: boolean; error?: string }))
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`)
        setSubmitting(false)
        return
      }
      // Success — bounce to the archived view of the players list.
      router.push('/dashboard/players?filter=archived')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed')
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
        title="Hide this player from daily operations. History is preserved and the player can be restored at any time."
      >
        Archive Player
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-white/10 rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Archive {playerName}?</h2>
          <p className="text-sm text-white/60 mt-1">
            Reversible. All history is preserved. You can restore at any time from the Archived filter on the Players list.
          </p>
        </div>

        {/* Reason picker */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">Why are you archiving?</label>
          <div className="space-y-1.5">
            {REASON_LABELS.map(r => (
              <label
                key={r.key}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  reason === r.key
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                    : 'bg-white/[0.02] border-white/[0.08] text-white/70 hover:bg-white/[0.05]'
                }`}
              >
                <input
                  type="radio"
                  name="archive-reason"
                  value={r.key}
                  checked={reason === r.key}
                  onChange={() => setReason(r.key)}
                  className="w-3.5 h-3.5"
                />
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Optional notes */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Notes <span className="text-white/40">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. Family moved to Edinburgh; will rejoin if they come back to the area."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Will remain / will be removed split */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
            <div className="font-medium text-emerald-300 mb-1.5">Will remain</div>
            <ul className="space-y-1 text-emerald-200/80">
              <li>✓ Attendance history</li>
              <li>✓ Progress reports &amp; reviews</li>
              <li>✓ Awards &amp; badges</li>
              <li>✓ Payment &amp; billing history</li>
              <li>✓ Messages &amp; notes</li>
            </ul>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
            <div className="font-medium text-amber-300 mb-1.5">Will be removed from</div>
            <ul className="space-y-1 text-amber-200/80">
              <li>✓ Active Players list</li>
              <li>✓ Class rosters / Live Register</li>
              <li>✓ Class attendance taking</li>
              <li>✓ Move Player picker</li>
              <li>✓ Parent-facing My Children</li>
            </ul>
          </div>
        </div>

        {/* Stripe-subscription warning + toggle */}
        {hasActiveSubscription && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-3 space-y-2">
            <div className="text-sm font-medium text-rose-200">
              ⚠ Active subscription detected
            </div>
            <p className="text-[12px] text-rose-200/80 leading-snug">
              By default we&apos;ll cancel the Stripe subscription at the end of the current billing period.
              No proration, no refund. The family keeps the period they already paid for. Payment history stays intact.
            </p>
            <label className="flex items-center gap-2 text-[12px] text-rose-200/80 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={!cancelSubs}
                onChange={e => setCancelSubs(!e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Leave subscription active (advanced — only if the family will keep paying for another child)
            </label>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleArchive}
            disabled={submitting || !reason}
            className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 text-[#0a0a0a] text-sm font-semibold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Archiving…' : 'Archive Player'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null) }}
            disabled={submitting}
            className="px-4 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
