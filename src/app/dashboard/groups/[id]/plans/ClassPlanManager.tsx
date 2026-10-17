'use client'

import { useState } from 'react'
import { PALETTE_ICON_PATHS } from '@/components/ui/PaletteIcon'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { canDeletePlan } from '@/lib/plan-delete-guard'

interface Plan {
  id: string
  name: string
  amount: number
  interval: string
  sessions_per_week: number | null
  description: string | null
  is_active: boolean
}

export default function ClassPlanManager({
  groupId,
  groupName,
  classType,
  orgId,
  existingPlans,
  inheritedPrices = [],
}: {
  groupId: string
  groupName: string
  classType: string
  orgId: string
  existingPlans: Plan[]
  /** No price of its own yet: what parents are offered for this class now (by class type or "any class"). */
  inheritedPrices?: { name: string; amount: number }[]
}) {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>(existingPlans)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)

  // New plan form
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newSessions, setNewSessions] = useState('1')
  const [newDescription, setNewDescription] = useState('')

  async function handleAddPlan() {
    if (!newName || !newAmount) return
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert({
        name: newName,
        amount: parseFloat(newAmount),
        interval: 'month',
        sessions_per_week: parseInt(newSessions) || 0,
        description: newDescription || null,
        organisation_id: orgId,
        training_group_id: groupId,
        class_type: classType,
        is_active: true,
        active: true,
      })
      .select()
      .single()

    if (error) {
      alert(error.message)
    } else if (data) {
      setPlans([...plans, data as Plan])
      setNewName('')
      setNewAmount('')
      setNewSessions('1')
      setNewDescription('')
      setShowAdd(false)
    }
    setLoading(false)
  }

  async function handleDeletePlan(planId: string) {
    const plan = plans.find((p) => p.id === planId)
    // The old dialog promised "Existing subscribers will not be affected".
    // They were: the plan row went and their subscriptions referenced nothing.
    const check = await canDeletePlan(planId, plan?.name)
    if (!check.ok) { alert(check.message); return }
    if (!confirm(`Delete "${plan?.name ?? 'this plan'}"? Nobody is on it, so nothing is affected.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('subscription_plans').delete().eq('id', planId)
    if (error) {
      alert(error.message)
    } else {
      setPlans(plans.filter(p => p.id !== planId))
    }
  }

  async function handleTogglePlan(planId: string, isActive: boolean) {
    const supabase = createClient()
    await supabase.from('subscription_plans').update({ is_active: !isActive, active: !isActive }).eq('id', planId)
    setPlans(plans.map(p => p.id === planId ? { ...p, is_active: !isActive } : p))
  }

  return (
    <div className="space-y-6">
      {/* Existing plans */}
      {plans.length > 0 ? (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-[#0f1a2b] border rounded-2xl p-5 transition-all duration-200 ${
                plan.is_active ? 'border-[#1d2c42] hover:border-[#293b58]' : 'border-[#1d2c42]/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{plan.name}</h3>
                    {!plan.is_active && (
                      <span className="text-[10px] px-2 py-0.5 bg-white/[0.06] text-white/40 rounded-full font-semibold">INACTIVE</span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="text-sm text-white/40 mt-0.5">{plan.description}</p>
                  )}
                  <p className="text-xs text-white/40 mt-1">
                    {plan.sessions_per_week === 0 ? 'Unlimited sessions' : `${plan.sessions_per_week} session${(plan.sessions_per_week || 0) > 1 ? 's' : ''} / week`}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-[#4ecde6]">&pound;{Number(plan.amount).toFixed(0)}</div>
                  <div className="text-xs text-white/40">per {plan.interval}</div>
                  <div className="text-[10px] text-green-400 mt-0.5">
                    or &pound;{Math.round(Number(plan.amount) * 3 * 0.9)} quarterly
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                <button
                  onClick={() => handleTogglePlan(plan.id, plan.is_active)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    plan.is_active
                      ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                      : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                  }`}
                >
                  {plan.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDeletePlan(plan.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#0f1a2b] border border-dashed border-[#1d2c42] rounded-2xl p-8 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04]"><svg className="h-6 w-6 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>{PALETTE_ICON_PATHS['card']}</svg></span>
          {inheritedPrices.length > 0 ? (
            <>
              <h3 className="font-bold text-lg text-white mb-1">No price of its own yet</h3>
              <p className="text-white/55 text-sm mb-4">
                Parents booking {groupName} are offered your general {inheritedPrices.length === 1 ? 'price' : 'prices'}: {inheritedPrices.map((p) => `${p.name} £${Number(p.amount).toFixed(2)}`).join(', ')}. Add a price here to give this class its own.
              </p>
            </>
          ) : (
            <>
              <h3 className="font-bold text-lg text-red-300 mb-1" data-testid="class-prices-none">No price set for {groupName}</h3>
              <p className="text-white/55 text-sm mb-4">Parents can&apos;t join or pay for this class until you add one.</p>
            </>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-bold hover:bg-[#6dd8ee] transition-colors"
          >
            + Add a price
          </button>
        </div>
      )}

      {/* Add plan form */}
      {showAdd ? (
        <div className="bg-[#0f1a2b] border border-[#4ecde6]/30 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-white">Add a price for {groupName}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1">Name parents see *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`e.g. ${groupName} monthly`}
                className="w-full px-3 py-2 bg-[#142236] border border-[#293b58] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1">Price (£/month) *</label>
              <input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="30"
                step="0.01"
                className="w-full px-3 py-2 bg-[#142236] border border-[#293b58] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1">Sessions / Week</label>
              <select
                value={newSessions}
                onChange={(e) => setNewSessions(e.target.value)}
                className="w-full px-3 py-2 bg-[#142236] border border-[#293b58] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/50"
              >
                <option value="1">1 session</option>
                <option value="2">2 sessions</option>
                <option value="3">3 sessions</option>
                <option value="4">4 sessions</option>
                <option value="5">5 sessions</option>
                <option value="0">Unlimited</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1">Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 bg-[#142236] border border-[#293b58] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddPlan}
              disabled={loading || !newName || !newAmount}
              className="px-5 py-2 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-bold hover:bg-[#6dd8ee] transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Plan'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-5 py-2 text-sm text-white/40 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : plans.length === 0 ? null : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-bold hover:bg-[#6dd8ee] transition-colors"
          >
            + Add a price
          </button>

        </div>
      )}

      {/* Preview info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
        <p className="text-sm text-blue-400">
          Prices you add here belong to {groupName} only, with your own names. Parents see them when they book this class.
        </p>
      </div>
    </div>
  )
}
