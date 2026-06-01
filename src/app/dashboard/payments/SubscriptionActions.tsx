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

  async function changePlan(newPlanId: string) {
    setLoading(true)
    const supabase = createClient()

    await supabase
      .from('subscriptions')
      .update({
        plan_id: newPlanId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)

    router.refresh()
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Plan switcher */}
      <select
        value={currentPlanId}
        onChange={(e) => changePlan(e.target.value)}
        disabled={loading || currentStatus === 'canceled'}
        className="px-2 py-1 border border-[#1e1e1e] rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

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
