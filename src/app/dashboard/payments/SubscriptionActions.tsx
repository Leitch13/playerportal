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

  async function setLocalStatus(newStatus: 'paused' | 'active') {
    // Pause / Activate stay local-only — Stripe has no native "pause" concept
    // matching ours and "active" here just clears local-side flags. Cancel is
    // the only destructive transition that needs to call Stripe.
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

  // DISABLED 2026-09-02.
  //
  // This wrote plan_id straight to the database and never told Stripe. The
  // app then showed the family on the new plan — on every screen, in every
  // report — while Stripe carried on charging the old amount indefinitely.
  // Nothing errored and nothing anywhere recorded the disagreement.
  //
  // Four live subscriptions were found out of step this way. One family had
  // paid £34/month less than their academy believed for two months; another
  // £20/month more than their academy's records showed, for three.
  //
  // The dropdown stays visible and still shows which plan someone is on,
  // because that is useful and true. It just cannot be used to change one
  // until there is a route behind it that swaps the Stripe subscription item,
  // defers to the family's next renewal, and emails them what changed.
  //
  // Removing the control instead would have hidden the current plan from the
  // academy, which is a real loss for no gain.

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Plan switcher */}
      <select
        value={currentPlanId}
        disabled
        title="Plan changes are temporarily unavailable — changing a plan here would not update what the family is actually charged."
        aria-label="Current plan (changes temporarily unavailable)"
        data-testid="plan-switcher"
        className="px-2 py-1 border border-[#1d2c42] rounded text-xs opacity-60 cursor-not-allowed focus:outline-none"
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <span className="text-[10px] text-white/40" data-testid="plan-switcher-note">
        Plan changes temporarily unavailable
      </span>

      {/* Quick action buttons */}
      {currentStatus === 'active' && (
        <>
          <button
            onClick={() => setLocalStatus('paused')}
            disabled={loading}
            className="px-2 py-1 text-xs border border-yellow-300 text-yellow-700 rounded hover:bg-yellow-50 transition-colors"
          >
            Pause
          </button>
          <button
            onClick={cancelInStripe}
            disabled={loading}
            className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors"
          >
            Cancel
          </button>
        </>
      )}
      {currentStatus === 'paused' && (
        <>
          <button
            onClick={() => setLocalStatus('active')}
            disabled={loading}
            className="px-2 py-1 text-xs border border-cyan-300 text-cyan-700 rounded hover:bg-cyan-50 transition-colors"
          >
            Resume
          </button>
          <button
            onClick={cancelInStripe}
            disabled={loading}
            className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors"
          >
            Cancel
          </button>
        </>
      )}
      {currentStatus === 'incomplete' && (
        <>
          <button
            onClick={() => setLocalStatus('active')}
            disabled={loading}
            className="px-2 py-1 text-xs border border-cyan-300 text-cyan-700 rounded hover:bg-cyan-50 transition-colors"
          >
            Activate
          </button>
          <button
            onClick={cancelInStripe}
            disabled={loading}
            className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors"
          >
            Remove
          </button>
        </>
      )}
      {currentStatus === 'past_due' && (
        <button
          onClick={() => setLocalStatus('active')}
          disabled={loading}
          className="px-2 py-1 text-xs border border-cyan-300 text-cyan-700 rounded hover:bg-cyan-50 transition-colors"
        >
          Mark Active
        </button>
      )}
      {currentStatus === 'canceled' && (
        <span className="text-xs text-white/60 italic">Canceled</span>
      )}
    </div>
  )
}
