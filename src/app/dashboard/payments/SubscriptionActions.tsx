'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SubscriptionPlan } from '@/lib/types'

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

  async function updateStatus(newStatus: string) {
    setLoading(true)
    const supabase = createClient()

    await supabase
      .from('subscriptions')
      .update({
        status: newStatus,
        canceled_at: newStatus === 'canceled' ? new Date().toISOString() : null,
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
        className="px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Quick action buttons */}
      {currentStatus === 'active' && (
        <>
          <button
            onClick={() => updateStatus('paused')}
            disabled={loading}
            className="px-2 py-1 text-xs border border-yellow-300 text-yellow-700 rounded hover:bg-yellow-50 transition-colors"
          >
            Pause
          </button>
          <button
            onClick={() => updateStatus('canceled')}
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
            onClick={() => updateStatus('active')}
            disabled={loading}
            className="px-2 py-1 text-xs border border-cyan-300 text-cyan-700 rounded hover:bg-cyan-50 transition-colors"
          >
            Resume
          </button>
          <button
            onClick={() => updateStatus('canceled')}
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
            onClick={() => updateStatus('active')}
            disabled={loading}
            className="px-2 py-1 text-xs border border-cyan-300 text-cyan-700 rounded hover:bg-cyan-50 transition-colors"
          >
            Activate
          </button>
          <button
            onClick={() => updateStatus('canceled')}
            disabled={loading}
            className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors"
          >
            Remove
          </button>
        </>
      )}
      {currentStatus === 'past_due' && (
        <button
          onClick={() => updateStatus('active')}
          disabled={loading}
          className="px-2 py-1 text-xs border border-cyan-300 text-cyan-700 rounded hover:bg-cyan-50 transition-colors"
        >
          Mark Active
        </button>
      )}
      {currentStatus === 'canceled' && (
        <span className="text-xs text-text-light italic">Canceled</span>
      )}
    </div>
  )
}
