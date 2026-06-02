'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/**
 * Action cluster for a Pending enrolment row (Stage 3 future-start).
 *
 *   • View         — link to player profile
 *   • Activate now — runs the same per-row logic as the daily cron via
 *                    POST /api/admin/enrolments/{id}/activate-now
 *   • Cancel       — flips the scheduled subscription + pending enrolment
 *                    to 'cancelled' via POST /api/admin/enrolments/{id}/cancel-pending
 *                    (DB-only; the SetupIntent will expire on its own)
 *
 * All async actions confirm before firing. Errors surface inline.
 */
export default function PendingEnrolmentActions({
  enrolmentId,
  playerId,
}: {
  enrolmentId: string
  playerId: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<null | 'activate' | 'cancel'>(null)
  const [err, setErr] = useState<string | null>(null)

  async function call(kind: 'activate' | 'cancel') {
    const confirmText = kind === 'activate'
      ? "Activate this scheduled subscription NOW? This runs the same flow as the nightly cron and will charge the saved card a calendar-day prorated amount today."
      : "Cancel this pending enrolment? The card on file will NOT be charged."
    if (!window.confirm(confirmText)) return

    setBusy(kind)
    setErr(null)
    try {
      const path = kind === 'activate' ? 'activate-now' : 'cancel-pending'
      const res = await fetch(`/api/admin/enrolments/${enrolmentId}/${path}`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setErr(json?.error || `HTTP ${res.status}`)
        return
      }
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Link
        href={`/dashboard/players/${playerId}`}
        className="text-[12px] font-semibold text-white/70 hover:text-white px-2 py-1 rounded border border-white/[0.10] hover:border-white/[0.20] transition-colors"
      >
        View
      </Link>
      <button
        type="button"
        onClick={() => call('activate')}
        disabled={busy !== null}
        className="text-[12px] font-semibold text-emerald-300 px-2 py-1 rounded border border-emerald-500/30 hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
      >
        {busy === 'activate' ? 'Activating…' : 'Activate now'}
      </button>
      <button
        type="button"
        onClick={() => call('cancel')}
        disabled={busy !== null}
        className="text-[12px] font-semibold text-rose-300 px-2 py-1 rounded border border-rose-500/30 hover:bg-rose-500/15 transition-colors disabled:opacity-50"
      >
        {busy === 'cancel' ? 'Cancelling…' : 'Cancel'}
      </button>
      {err && <span className="text-[11px] text-rose-300 w-full">{err}</span>}
    </div>
  )
}
