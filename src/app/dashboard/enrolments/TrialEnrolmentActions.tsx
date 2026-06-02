'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Action cluster for a Trial enrolment row.
 *
 *   • Convert to paid — links the academy to the booking flow with the trial
 *                       player's class pre-selected. (No new billing code:
 *                       the parent must complete checkout themselves; this
 *                       is purely a navigation shortcut for the admin.)
 *   • End trial       — DB-only flip to status='cancelled' via
 *                       POST /api/admin/enrolments/{id}/end-trial. No Stripe
 *                       call — trials have no recurring Stripe subscription.
 */
export default function TrialEnrolmentActions({
  enrolmentId,
}: {
  enrolmentId: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function endTrial() {
    if (!window.confirm('End this trial? The enrolment will be marked cancelled. No Stripe charge or refund happens — trials are not tied to a Stripe subscription.')) return

    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/admin/enrolments/${enrolmentId}/end-trial`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setErr(json?.error || `HTTP ${res.status}`)
        return
      }
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Phase 1: Convert to paid → admin opens the standard booking flow.
          We don't pre-fill a plan here because the parent's plan choice is
          part of their journey. Phase 2 may add a deep-link with plan + class
          pre-set once we have a "convert this specific trial" code path. */}
      <a
        href="/dashboard/groups"
        className="text-[12px] font-semibold text-sky-300 px-2 py-1 rounded border border-sky-500/30 hover:bg-sky-500/15 transition-colors"
        title="Open the academy's groups page to send a paid signup link"
      >
        Convert to paid
      </a>
      <button
        type="button"
        onClick={endTrial}
        disabled={busy}
        className="text-[12px] font-semibold text-rose-300 px-2 py-1 rounded border border-rose-500/30 hover:bg-rose-500/15 transition-colors disabled:opacity-50"
      >
        {busy ? 'Ending…' : 'End trial'}
      </button>
      {err && <span className="text-[11px] text-rose-300 w-full">{err}</span>}
    </div>
  )
}
