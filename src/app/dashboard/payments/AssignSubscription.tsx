'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SubscriptionPlan } from '@/lib/types'

interface PlayerWithParent {
  id: string
  first_name: string
  last_name: string
  parent_id: string
  parent_name: string
}

export default function AssignSubscription({
  plans,
  players,
  orgId,
}: {
  plans: SubscriptionPlan[]
  players: PlayerWithParent[]
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [playerId, setPlayerId] = useState('')
  const [planId, setPlanId] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!playerId || !planId) return
    setLoading(true)

    const player = players.find((p) => p.id === playerId)
    const plan = plans.find((p) => p.id === planId)
    if (!player || !plan) return

    const supabase = createClient()

    // Create a local subscription record with status "incomplete"
    // The parent will see this and can activate it via Stripe
    const { error } = await supabase.from('subscriptions').insert({
      organisation_id: orgId,
      parent_id: player.parent_id,
      player_id: playerId,
      plan_id: planId,
      status: 'incomplete',
    })

    if (error) {
      alert(error.message)
    } else {
      // Auto-create first monthly payment
      const { error: payError } = await supabase.from('payments').insert({
        organisation_id: orgId,
        parent_id: player.parent_id,
        player_id: playerId,
        amount: Number(plan.amount),
        amount_paid: 0,
        description: `${plan.name} — ${player.first_name} ${player.last_name}`,
        status: 'unpaid',
        due_date: new Date().toISOString().split('T')[0],
      })

      if (payError) console.error('Failed to create payment:', payError.message)

      setSuccess(`${plan.name} assigned to ${player.first_name}`)
      setPlayerId('')
      setPlanId('')
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }

    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/90 transition-colors"
      >
        + Assign Subscription
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Assign Subscription to Player</h3>
        <button onClick={() => setOpen(false)} className="text-text-light hover:text-text text-sm">Close</button>
      </div>
      <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium mb-1">Player *</label>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select player...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name} ({p.parent_name})
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium mb-1">Plan *</label>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select plan...</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — £{Number(p.amount).toFixed(0)}/mo
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Assigning...' : 'Assign'}
        </button>
      </form>
      {success && <p className="text-xs text-accent font-medium mt-2">{success}</p>}
    </div>
  )
}
