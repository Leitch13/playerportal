'use client'

/**
 * Trial follow-up action cluster — Phase 2.4 Step 5.
 *
 * Renders three DB-only actions (Convert / Extend / Mark lost) against
 * either backing system. The endpoint URLs are pre-resolved by the parent
 * based on `source`:
 *
 *   source='booking'   → /api/admin/trials/{id}/{action}
 *   source='enrolment' → /api/admin/enrolments/{id}/{action}
 *
 *   • Convert      — flips the DB flag, then optionally opens the existing
 *                    paid signup flow in a new tab (`signupHref` prop).
 *                    NO subscription is created here; the parent must
 *                    complete checkout themselves.
 *   • Extend       — booking: prompts for a new date (YYYY-MM-DD)
 *                  — enrolment: prompts for +N days (default 14)
 *   • Mark lost    — sets status='cancelled' on the row.
 *
 * UX matches existing TrialEnrolmentActions / PendingEnrolmentActions:
 *   window.confirm() before mutation, inline error surface, router.refresh()
 *   on success.
 *
 * NO Stripe, NO email, NO cron, NO subscription writes. Confirmed in
 * each endpoint's docstring.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  source: 'booking' | 'enrolment'
  id: string
  /** When set, "Convert" opens this URL in a new tab after the DB flip. */
  signupHref?: string | null
  /** Layout — 'inline' for tables, 'block' if the parent gives us room. */
  layout?: 'inline' | 'block'
}

type Busy = null | 'convert' | 'extend' | 'lost'

export default function TrialFollowUpActions({ source, id, signupHref, layout = 'inline' }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<Busy>(null)
  const [err, setErr] = useState<string | null>(null)

  // ─── shared post helper ────────────────────────────────────────────────
  async function call(action: 'convert' | 'extend' | 'lost', body?: unknown): Promise<boolean> {
    setBusy(action)
    setErr(null)
    const pathByAction = {
      convert: source === 'booking' ? 'mark-converted' : 'mark-converted',
      extend:  source === 'booking' ? 'extend'         : 'extend-trial',
      lost:    source === 'booking' ? 'mark-lost'      : 'mark-lost',
    } as const
    const base = source === 'booking' ? '/api/admin/trials' : '/api/admin/enrolments'
    try {
      const res = await fetch(`${base}/${id}/${pathByAction[action]}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      const json = await res.json().catch(() => ({} as { ok?: boolean; error?: string }))
      if (!res.ok || !json.ok) {
        setErr((json as { error?: string }).error || `HTTP ${res.status}`)
        return false
      }
      return true
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setBusy(null)
    }
  }

  // ─── Convert ──────────────────────────────────────────────────────────
  async function onConvert() {
    const ok = window.confirm(
      'Mark this trial as converted? This sets a DB flag only — no subscription is created and no Stripe charge happens. The parent must complete the paid signup flow separately.',
    )
    if (!ok) return
    const success = await call('convert')
    if (!success) return
    // Optimistic: refresh server data so the row leaves the follow-up cohort.
    router.refresh()
    // Deep-link the admin to the existing paid signup flow if we have one.
    if (signupHref) {
      try { window.open(signupHref, '_blank', 'noopener,noreferrer') } catch { /* noop */ }
    }
  }

  // ─── Extend ───────────────────────────────────────────────────────────
  async function onExtend() {
    if (source === 'booking') {
      const today = new Date().toISOString().slice(0, 10)
      const input = window.prompt(
        'Enter a new trial date (YYYY-MM-DD):',
        today,
      )
      if (!input) return
      const trimmed = input.trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        setErr('Date must be YYYY-MM-DD')
        return
      }
      const ok = window.confirm(`Reschedule this trial to ${trimmed}? No emails or notifications are sent — you can message the parent separately.`)
      if (!ok) return
      const success = await call('extend', { newDate: trimmed })
      if (success) router.refresh()
    } else {
      const raw = window.prompt('Extend this trial by how many days?', '14')
      if (!raw) return
      const days = Math.floor(Number(raw))
      if (!Number.isFinite(days) || days < 1 || days > 60) {
        setErr('Days must be between 1 and 60')
        return
      }
      const ok = window.confirm(`Extend this trial by ${days} day${days === 1 ? '' : 's'}? No emails are sent — message the parent separately if needed.`)
      if (!ok) return
      const success = await call('extend', { days })
      if (success) router.refresh()
    }
  }

  // ─── Lost ─────────────────────────────────────────────────────────────
  async function onLost() {
    const ok = window.confirm(
      source === 'booking'
        ? 'Mark this trial booking as lost? The status will be set to "cancelled". No Stripe charge or refund happens.'
        : 'Mark this trial enrolment as lost? The enrolment will be cancelled. No Stripe charge or refund happens — trials are not tied to a Stripe subscription.',
    )
    if (!ok) return
    const success = await call('lost')
    if (success) router.refresh()
  }

  const wrapCls = layout === 'block'
    ? 'flex items-center gap-2 flex-wrap'
    : 'inline-flex items-center gap-1.5 flex-wrap'

  return (
    <div className={wrapCls}>
      <button
        type="button"
        onClick={onConvert}
        disabled={busy !== null}
        className="text-[11px] font-semibold text-emerald-300 px-2 py-1 rounded border border-emerald-500/30 hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
        title="Mark this trial as converted (DB flag only — no charge)"
      >
        {busy === 'convert' ? 'Converting…' : '✓ Convert'}
      </button>
      <button
        type="button"
        onClick={onExtend}
        disabled={busy !== null}
        className="text-[11px] font-semibold text-sky-300 px-2 py-1 rounded border border-sky-500/30 hover:bg-sky-500/15 transition-colors disabled:opacity-50"
        title={source === 'booking' ? 'Reschedule to a new trial date' : 'Extend the trial expiry by +14 days (default)'}
      >
        {busy === 'extend' ? 'Extending…' : '+ Extend'}
      </button>
      <button
        type="button"
        onClick={onLost}
        disabled={busy !== null}
        className="text-[11px] font-semibold text-rose-300 px-2 py-1 rounded border border-rose-500/30 hover:bg-rose-500/15 transition-colors disabled:opacity-50"
        title="Mark as lost (status='cancelled')"
      >
        {busy === 'lost' ? 'Marking…' : '✕ Lost'}
      </button>
      {err && (
        <span className="text-[11px] text-rose-300 w-full" role="alert">{err}</span>
      )}
    </div>
  )
}
