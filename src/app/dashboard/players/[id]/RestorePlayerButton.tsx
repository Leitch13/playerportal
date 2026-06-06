'use client'

/**
 * Sprint 7 — Restore Player Button
 *
 * Calls /api/players/[id]/restore which only flips archive flags back to
 * NULL. Does NOT re-enrol, does NOT reactivate Stripe — by design.
 * Admin must deliberately re-enrol after restore.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RestorePlayerButton({
  playerId,
  playerName,
}: {
  playerId: string
  playerName: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRestore() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/players/${playerId}/restore`, { method: 'POST' })
      const json = await res.json().catch(() => ({} as { ok?: boolean; error?: string }))
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`)
        setSubmitting(false)
        return
      }
      router.push('/dashboard/players')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
      setSubmitting(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
        title="Reactivate this player record. Does not re-enrol them into any class."
      >
        Restore Player
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/65 leading-snug">
        Restoring <span className="font-medium text-white">{playerName}</span> will make them visible in the active Players list.
        Cancelled enrolments are <strong>not</strong> reactivated and the Stripe subscription is <strong>not</strong> reopened — you&apos;ll need to re-enrol them manually or have the parent re-subscribe.
      </p>
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleRestore}
          disabled={submitting}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-500 text-[#0a0a0a] hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Restoring…' : 'Confirm Restore'}
        </button>
        <button
          type="button"
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
