'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SubscriptionPlan } from '@/lib/types'

export default function SubscriptionPlanManager({
  plans,
  orgId,
}: {
  plans: SubscriptionPlan[]
  orgId: string
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [sessionsPerWeek, setSessionsPerWeek] = useState('1')
  const [loading, setLoading] = useState(false)

  function startEdit(plan: SubscriptionPlan) {
    setEditing(plan.id)
    setName(plan.name)
    setDescription(plan.description || '')
    setAmount(String(plan.amount))
    setSessionsPerWeek(String(plan.sessions_per_week))
    setShowForm(true)
  }

  function resetForm() {
    setEditing(null)
    setName('')
    setDescription('')
    setAmount('')
    setSessionsPerWeek('1')
    setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const payload = {
      organisation_id: orgId,
      name,
      description: description || null,
      amount: parseFloat(amount),
      sessions_per_week: parseInt(sessionsPerWeek),
      interval: 'month',
      updated_at: new Date().toISOString(),
    }

    if (editing) {
      // Note: changing amount won't update the Stripe price — a new price will be created on next subscribe
      const { error } = await supabase
        .from('subscription_plans')
        .update({ ...payload, stripe_price_id: null })
        .eq('id', editing)

      if (error) alert(error.message)
    } else {
      const { error } = await supabase
        .from('subscription_plans')
        .insert(payload)

      if (error) alert(error.message)
    }

    resetForm()
    setLoading(false)
    router.refresh()
  }

  async function toggleActive(planId: string, currentlyActive: boolean) {
    const supabase = createClient()
    await supabase
      .from('subscription_plans')
      .update({ active: !currentlyActive, updated_at: new Date().toISOString() })
      .eq('id', planId)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Subscription Plans</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            + Add Plan
          </button>
        )}
      </div>

      {/* Existing plans */}
      {plans.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-4 ${
                plan.active ? 'border-border bg-white' : 'border-border/50 bg-surface/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-sm">{plan.name}</div>
                  {plan.description && (
                    <div className="text-xs text-text-light mt-0.5">{plan.description}</div>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  plan.active ? 'bg-cyan-100 text-cyan-800' : 'bg-gray-100 text-gray-500'
                }`}>
                  {plan.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-bold">&pound;{Number(plan.amount).toFixed(0)}</span>
                <span className="text-sm text-text-light">/{plan.interval}</span>
              </div>
              <div className="text-xs text-text-light mb-3">
                {plan.sessions_per_week} session{plan.sessions_per_week !== 1 ? 's' : ''}/week
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(plan)}
                  className="text-xs px-2.5 py-1 border border-border rounded-lg hover:bg-surface-dark transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(plan.id, plan.active)}
                  className="text-xs px-2.5 py-1 border border-border rounded-lg hover:bg-surface-dark transition-colors"
                >
                  {plan.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">{editing ? 'Edit Plan' : 'New Plan'}</h3>
            <button onClick={resetForm} className="text-text-light hover:text-text text-sm">Cancel</button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Plan Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 1 Session / Week"
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. One training session per week"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Monthly Price (&pound;) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="40.00"
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Sessions/Week</label>
              <select
                value={sessionsPerWeek}
                onChange={(e) => setSessionsPerWeek(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} session{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving...' : editing ? 'Update Plan' : 'Create Plan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
