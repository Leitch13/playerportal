'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Plan {
  id: string
  name: string
  amount: number
  interval: string
  sessions_per_week: number | null
  description: string | null
  is_active: boolean
}

const PLAN_TEMPLATES: Record<string, { name: string; amount: number; sessions: number; desc: string }[]> = {
  '1-2-1': [
    { name: 'Single Session', amount: 40, sessions: 1, desc: 'One 1-2-1 session per week' },
    { name: 'Double Sessions', amount: 70, sessions: 2, desc: 'Two 1-2-1 sessions per week — save £10' },
  ],
  '2-1': [
    { name: 'Single Session', amount: 25, sessions: 1, desc: 'One pair training session per week' },
    { name: 'Double Sessions', amount: 45, sessions: 2, desc: 'Two pair sessions per week — save £5' },
  ],
  gk: [
    { name: 'GK Weekly', amount: 30, sessions: 1, desc: 'One goalkeeper session per week' },
    { name: 'GK Intensive', amount: 50, sessions: 2, desc: 'Two goalkeeper sessions per week' },
  ],
  soccer_tots: [
    { name: 'Soccer Tots Weekly', amount: 25, sessions: 1, desc: 'One fun session per week for ages 3-5' },
  ],
  academy: [
    { name: '1 Session / Week', amount: 30, sessions: 1, desc: 'One academy training session per week' },
    { name: '2 Sessions / Week', amount: 50, sessions: 2, desc: 'Two sessions — the most popular choice' },
    { name: 'Unlimited', amount: 70, sessions: 0, desc: 'Train as much as you want' },
  ],
  accelerator: [
    { name: 'Accelerator Standard', amount: 45, sessions: 2, desc: 'Two intensive sessions per week' },
    { name: 'Accelerator Elite', amount: 75, sessions: 0, desc: 'Unlimited sessions + priority booking' },
  ],
  elite: [
    { name: 'Elite Programme', amount: 60, sessions: 3, desc: 'Three elite sessions per week' },
    { name: 'Elite Unlimited', amount: 90, sessions: 0, desc: 'Full access to all elite sessions' },
  ],
  small_group: [
    { name: 'Small Group Weekly', amount: 25, sessions: 1, desc: 'One small group session per week (max 6 players)' },
    { name: 'Small Group x2', amount: 45, sessions: 2, desc: 'Two small group sessions per week' },
  ],
  group: [
    { name: '1 Session / Week', amount: 30, sessions: 1, desc: 'One group session per week' },
    { name: '2 Sessions / Week', amount: 50, sessions: 2, desc: 'Two sessions per week' },
    { name: 'Unlimited', amount: 70, sessions: 0, desc: 'Unlimited group sessions' },
  ],
  girls: [
    { name: 'Girls Weekly', amount: 25, sessions: 1, desc: 'One girls session per week' },
    { name: 'Girls x2', amount: 45, sessions: 2, desc: 'Two girls sessions per week' },
  ],
  adults: [
    { name: 'Adult Drop-in', amount: 10, sessions: 1, desc: 'Pay as you go — per session' },
    { name: 'Adult Monthly', amount: 35, sessions: 0, desc: 'Unlimited adult sessions per month' },
  ],
}

export default function ClassPlanManager({
  groupId,
  groupName,
  classType,
  orgId,
  existingPlans,
}: {
  groupId: string
  groupName: string
  classType: string
  orgId: string
  existingPlans: Plan[]
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
    if (!confirm('Delete this plan? Existing subscribers will not be affected.')) return
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

  function loadTemplate() {
    const templates = PLAN_TEMPLATES[classType] || PLAN_TEMPLATES.group
    templates.forEach(async (t) => {
      const supabase = createClient()
      const { data } = await supabase
        .from('subscription_plans')
        .insert({
          name: t.name,
          amount: t.amount,
          interval: 'month',
          sessions_per_week: t.sessions,
          description: t.desc,
          organisation_id: orgId,
          training_group_id: groupId,
          class_type: classType,
          is_active: true,
          active: true,
        })
        .select()
        .single()
      if (data) {
        setPlans(prev => [...prev, data as Plan])
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Existing plans */}
      {plans.length > 0 ? (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-[#141414] border rounded-2xl p-5 transition-all duration-200 ${
                plan.is_active ? 'border-[#1e1e1e] hover:border-[#2a2a2a]' : 'border-[#1e1e1e]/50 opacity-60'
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
        <div className="bg-[#141414] border border-dashed border-[#1e1e1e] rounded-2xl p-8 text-center">
          <div className="text-3xl mb-3">💰</div>
          <h3 className="font-bold text-lg text-white mb-1">No plans yet for {groupName}</h3>
          <p className="text-white/40 text-sm mb-4">
            Create pricing plans so parents can subscribe to this class.
          </p>
          <button
            onClick={loadTemplate}
            className="px-4 py-2 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-bold hover:bg-[#6dd8ee] transition-colors"
          >
            Load {classType === '1-2-1' ? '1-2-1' : classType === 'gk' ? 'Goalkeeper' : classType === 'soccer_tots' ? 'Soccer Tots' : classType.replace('_', ' ')} Template Plans
          </button>
        </div>
      )}

      {/* Add plan form */}
      {showAdd ? (
        <div className="bg-[#141414] border border-[#4ecde6]/30 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-white">Add New Plan</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1">Plan Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. 1 Session / Week"
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/50"
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
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1">Sessions / Week</label>
              <select
                value={newSessions}
                onChange={(e) => setNewSessions(e.target.value)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/50"
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
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/50"
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
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-bold hover:bg-[#6dd8ee] transition-colors"
          >
            + Add Plan
          </button>
          {plans.length === 0 && (
            <button
              onClick={loadTemplate}
              className="px-5 py-2.5 bg-white/[0.06] text-white hover:bg-white/[0.1] rounded-xl text-sm font-semibold transition-colors"
            >
              Load Template Plans
            </button>
          )}
        </div>
      )}

      {/* Preview info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
        <p className="text-sm text-blue-400">
          <strong>Tip:</strong> Plans you create here will show on the class booking page for parents.
          They can choose monthly or quarterly billing (10% off). If no class-specific plans exist, org-wide plans are shown instead.
        </p>
      </div>
    </div>
  )
}
