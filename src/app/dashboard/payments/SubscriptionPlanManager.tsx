'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/post-json'
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
  const [originalAmount, setOriginalAmount] = useState<number | null>(null)
  // Only asked when the price actually changes. Defaults to moving everyone,
  // because an academy changing a price almost always means the new price.
  const [applyToExisting, setApplyToExisting] = useState(true)
  const [notice, setNotice] = useState('')

  const parsedAmount = parseFloat(amount)
  const priceChanged =
    editing !== null &&
    originalAmount !== null &&
    Number.isFinite(parsedAmount) &&
    Math.abs(parsedAmount - originalAmount) > 0.001

  function startEdit(plan: SubscriptionPlan) {
    setEditing(plan.id)
    setName(plan.name)
    setDescription(plan.description || '')
    setAmount(String(plan.amount))
    setOriginalAmount(Number(plan.amount))
    setApplyToExisting(true)
    setNotice('')
    setSessionsPerWeek(String(plan.sessions_per_week))
    setShowForm(true)
  }

  function resetForm() {
    setEditing(null)
    setName('')
    setDescription('')
    setAmount('')
    setOriginalAmount(null)
    setApplyToExisting(true)
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
      // Editing goes through the server so the change reaches Stripe too.
      // Writing the new amount straight to the database — which is what this
      // did until 2026-09-02 — left every existing member paying the old price
      // with nothing anywhere to say so.
      const res = await postJson(`/api/plans/${editing}/price`, {
        name,
        description: description || null,
        amount: parseFloat(amount),
        sessionsPerWeek: parseInt(sessionsPerWeek),
        applyToExisting,
      })
      if (!res.ok) {
        alert(res.error || 'Could not update the plan.')
        setLoading(false)
        return
      }
      if (typeof res.data.message === 'string') setNotice(res.data.message)
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
      {notice && (
        <div className="rounded-xl border border-[#4ecde6]/30 bg-[#4ecde6]/[0.06] px-4 py-3 text-[13px] text-[#bdeff8]" data-testid="plan-price-notice">
          {notice}
        </div>
      )}
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
                plan.active ? 'border-[#1d2c42] bg-[#0f1a2b]' : 'border-[#1d2c42]/50 bg-[#080e18]/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-sm">{plan.name}</div>
                  {plan.description && (
                    <div className="text-xs text-white/60 mt-0.5">{plan.description}</div>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  plan.active ? 'bg-cyan-100 text-cyan-800' : 'bg-[#080e18] text-gray-500'
                }`}>
                  {plan.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-bold">&pound;{Number(plan.amount).toFixed(0)}</span>
                <span className="text-sm text-white/60">/{plan.interval}</span>
              </div>
              <div className="text-xs text-white/60 mb-3">
                {plan.sessions_per_week} session{plan.sessions_per_week !== 1 ? 's' : ''}/week
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(plan)}
                  className="text-xs px-2.5 py-1 border border-[#1d2c42] rounded-lg hover:bg-white/5 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(plan.id, plan.active)}
                  className="text-xs px-2.5 py-1 border border-[#1d2c42] rounded-lg hover:bg-white/5 transition-colors"
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
        <div className="bg-[#0f1a2b] rounded-xl border border-[#1d2c42] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">{editing ? 'Edit Plan' : 'New Plan'}</h3>
            <button onClick={resetForm} className="text-white/60 hover:text-white text-sm">Cancel</button>
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
                className="w-full px-3 py-2 border border-[#1d2c42] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. One training session per week"
                className="w-full px-3 py-2 border border-[#1d2c42] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                className="w-full px-3 py-2 border border-[#1d2c42] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Sessions/Week</label>
              <select
                value={sessionsPerWeek}
                onChange={(e) => setSessionsPerWeek(e.target.value)}
                className="w-full px-3 py-2 border border-[#1d2c42] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} session{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            {priceChanged && (
              <div className="sm:col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4">
                <p className="text-[13px] font-semibold text-amber-200 mb-1">
                  You&rsquo;re changing the price from &pound;{originalAmount!.toFixed(2)} to &pound;{parsedAmount.toFixed(2)}
                </p>
                <p className="text-[12px] text-white/55 mb-3">
                  Members already on this plan keep paying &pound;{originalAmount!.toFixed(2)} unless you move them.
                  Nothing is charged today either way &mdash; a new price starts at each member&rsquo;s next payment date.
                </p>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToExisting}
                    onChange={(e) => setApplyToExisting(e.target.checked)}
                    data-testid="apply-price-to-existing"
                    className="mt-0.5 w-4 h-4 rounded border-[#1d2c42] bg-[#080e18] accent-[#4ecde6]"
                  />
                  <span className="text-[13px] text-white/80">
                    Move existing members onto &pound;{parsedAmount.toFixed(2)} from their next payment
                    <span className="block text-[11.5px] text-white/45">
                      Untick to change the price for new members only.
                    </span>
                  </span>
                </label>
              </div>
            )}

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
