'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SubscriptionPlan } from '@/lib/types'

/**
 * Admin-side per-subscription quick actions on the Payments page.
 *
 * IMPORTANT: every status change here also propagates to Stripe via
 * /api/stripe/cancel (which schedules cancel-at-period-end and writes the
 * cancellations audit row). Previously this component only updated the DB
 * row, which let Stripe keep charging the customer even though the admin
 * thought they'd cancelled. The `confirm()` prompt is intentional — Cancel
 * is destructive enough that a misclick on a small button shouldn't drop
 * a paying customer.
 */
export default function SubscriptionActions({
  subscriptionId,
  currentStatus,
  currentPlanId,
  plans,
}: {
  subscriptionId: string
  currentStatus: string
  currentPlanId: string
  plans: SubscriptionPlan[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function cancelInStripe() {
    const ok = window.confirm(
      'Cancel this subscription? This schedules cancellation in Stripe so the customer keeps access until the end of their current billing period, then it stops charging. Continue?'
    )
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId, reason: 'admin_cancelled' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert('Could not cancel: ' + (data.error || res.statusText))
      }
    } catch (err) {
      alert('Network error cancelling: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      router.refresh()
      setLoading(false)
    }
  }

  // Pause / Resume go through Stripe (pause_collection), then our row: see
  // /api/admin/subscriptions/[id]/pause and src/lib/membership-pause.ts. Until
  // 29 Sep 2026 Pause only wrote 'paused' here: Stripe kept charging and the
  // next Stripe update flipped it back to active.
  async function pauseOrResume(action: 'pause' | 'resume') {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(`Could not ${action}: ` + (data.error || res.statusText))
      }
    } catch (err) {
      alert(`Network error trying to ${action}: ` + (err instanceof Error ? err.message : String(err)))
    } finally {
      router.refresh()
      setLoading(false)
    }
  }

  // "Activate" / "Mark Active" only clear a local flag; they never touched Stripe and still don't.
  async function setLocalStatus(newStatus: 'active') {
    setLoading(true)
    const supabase = createClient()
    await supabase
      .from('subscriptions')
      .update({
        status: newStatus,
        canceled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
    router.refresh()
    setLoading(false)
  }

  // Plan change (John's written yes, 30 Sep 2026). Until 2 Sep this wrote plan_id straight to the
  // database and never told Stripe: 4 families were charged the wrong amount for months. Now the
  // drop-down asks /api/admin/subscriptions/[id]/plan for a preview (the family's next bill), and
  // only on Confirm does it change Stripe (from the next bill, nothing charged today) and then our
  // row. Billing guard rule 9 keeps this from ever writing plan_id from the browser again.
  const [pick, setPick] = useState(currentPlanId)
  const [preview, setPreview] = useState<{ from: string; to: string; nextAmount: string; nextDate: string; paused: boolean } | null>(null)
  const [planMsg, setPlanMsg] = useState<string | null>(null)
  async function askPlan(planId: string, confirm: boolean) {
    setLoading(true); setPlanMsg(null)
    try {
      const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId, confirm }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setPlanMsg(data.error || 'Could not change the plan'); setPick(currentPlanId); setPreview(null); return }
      if (!confirm) { setPreview(data.preview); return }
      setPreview(null)
      setPlanMsg(`Changed. Next payment ${data.changed.nextAmount} on ${data.changed.nextDate}. The family has been emailed.`)
      router.refresh()
    } finally { setLoading(false) }
  }
  const canChangePlan = ['active', 'trialing', 'paused'].includes(currentStatus)

  const [changing, setChanging] = useState(false)
  const quiet = 'rounded-[9px] border border-[#293b58] px-2.5 py-1.5 text-xs font-medium text-[#93a2ba] transition-colors hover:border-[#4ecde6] hover:text-[#eef2f9] disabled:opacity-50'
  const stop = 'rounded-[9px] border border-[#293b58] px-2.5 py-1.5 text-xs font-medium text-[#93a2ba] transition-colors hover:border-[#e0736d] hover:text-[#e0736d] disabled:opacity-50'

  return (
    <div className="flex flex-col gap-2 lg:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {canChangePlan && !changing && (
          <button type="button" disabled={loading} onClick={() => setChanging(true)} className={quiet} data-testid="plan-change-open">
            Change plan
          </button>
        )}
        {(currentStatus === 'active' || currentStatus === 'trialing') && (
          <>
            <button onClick={() => pauseOrResume('pause')} disabled={loading} className={quiet}>Pause</button>
            <button onClick={cancelInStripe} disabled={loading} className={stop}>Cancel</button>
          </>
        )}
        {currentStatus === 'paused' && (
          <>
            <button onClick={() => pauseOrResume('resume')} disabled={loading} className={quiet}>Resume</button>
            <button onClick={cancelInStripe} disabled={loading} className={stop}>Cancel</button>
          </>
        )}
        {currentStatus === 'incomplete' && (
          <>
            <button onClick={() => setLocalStatus('active')} disabled={loading} className={quiet}>Activate</button>
            <button onClick={cancelInStripe} disabled={loading} className={stop}>Remove</button>
          </>
        )}
        {currentStatus === 'past_due' && (
          <button onClick={() => setLocalStatus('active')} disabled={loading} className={quiet}>Mark Active</button>
        )}
      </div>

      {/* Plan switcher: opens on "Change plan". Preview, then confirm. Nothing changes until Confirm. */}
      {canChangePlan && changing && (
        <div className="w-full rounded-[12px] border border-[#293b58] bg-[#080e18] p-3 text-left" data-testid="plan-change-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">Move to</p>
          <div role="radiogroup" aria-label="Plan" data-testid="plan-switcher" className="mt-2 max-h-60 space-y-1 overflow-y-auto pr-1">
            {[...plans].sort((x, y) => Number(x.amount) - Number(y.amount)).filter((p) => !preview || p.id === pick).map((p) => {
              const isNow = p.id === currentPlanId
              const chosen = !isNow && p.id === pick
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={loading || isNow}
                  onClick={() => { setPick(p.id); askPlan(p.id, false) }}
                  className={`flex w-full items-center justify-between gap-3 rounded-[9px] border px-3 py-2 text-left text-sm transition-colors ${
                    chosen
                      ? 'border-[#4ecde6] bg-[#4ecde6]/10 text-[#eef2f9]'
                      : isNow
                        ? 'border-transparent text-[#5b6c86]'
                        : 'border-transparent text-[#eef2f9] hover:border-[#293b58] hover:bg-[#0f1a2b] disabled:opacity-60'
                  }`}
                >
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className={`shrink-0 tabular-nums ${isNow ? '' : 'text-[#93a2ba]'}`}>{isNow && 'now · '}&pound;{Number(p.amount).toFixed(Number(p.amount) % 1 ? 2 : 0)}</span>
                </button>
              )
            })}
          </div>
          {preview ? (
            <div className="mt-3 border-t border-[#1d2c42] pt-3 text-xs text-[#93a2ba]" data-testid="plan-change-preview">
              <p className="text-[#eef2f9]">Move to {preview.to}. Nothing charged today.</p>
              <p className="mt-0.5">{preview.paused ? 'Membership is paused.' : `Next payment ${preview.nextAmount} on ${preview.nextDate}.`} The family gets an email.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={loading} onClick={() => askPlan(pick, true)} className="rounded-[9px] bg-[#4ecde6] px-3 py-1.5 text-xs font-semibold text-[#04141a] disabled:opacity-50">Confirm change</button>
                <button type="button" disabled={loading} onClick={() => { setPick(currentPlanId); setPreview(null) }} className={quiet}>Pick another</button>
                <button type="button" disabled={loading} onClick={() => { setPick(currentPlanId); setPreview(null); setChanging(false) }} className={quiet}>Keep current</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-[#5b6c86]">{loading ? 'Working out the next bill…' : 'Pick a plan to see the next bill first.'}</span>
              <button type="button" disabled={loading} onClick={() => { setPick(currentPlanId); setChanging(false) }} className={quiet}>Close</button>
            </div>
          )}
        </div>
      )}
      {planMsg && <span className="text-xs text-[#93a2ba]" role="status">{planMsg}</span>}
    </div>
  )
}
