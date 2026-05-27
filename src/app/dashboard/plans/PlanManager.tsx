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
  class_type: string | null
  training_group_id: string | null
}

const CLASS_TYPES = [
  { value: 'group', label: 'Group Training', color: 'bg-blue-500/15 text-blue-400' },
  { value: 'small_group', label: 'Small Group', color: 'bg-purple-500/15 text-purple-400' },
  { value: '1-2-1', label: '1-2-1 Sessions', color: 'bg-amber-500/15 text-amber-400' },
  { value: '2-1', label: '2-1 Sessions', color: 'bg-orange-500/15 text-orange-400' },
  { value: 'gk', label: 'Goalkeeper', color: 'bg-green-500/15 text-green-400' },
  { value: 'soccer_tots', label: 'Soccer Tots', color: 'bg-pink-500/15 text-pink-400' },
  { value: 'academy', label: 'Academy', color: 'bg-indigo-500/15 text-indigo-400' },
  { value: 'accelerator', label: 'Accelerator', color: 'bg-cyan-500/15 text-cyan-400' },
  { value: 'elite', label: 'Elite', color: 'bg-red-500/15 text-red-400' },
  { value: 'girls', label: 'Girls', color: 'bg-rose-500/15 text-rose-400' },
  { value: 'adults', label: 'Adults', color: 'bg-slate-500/15 text-slate-400' },
  { value: 'camp', label: 'Football Camp', color: 'bg-lime-500/15 text-lime-400' },
  { value: 'intensity', label: 'Intensity Training', color: 'bg-red-500/15 text-red-400' },
]

const inputCls = 'w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/30 focus:border-[#4ecde6]/50 transition-all'

export default function PlanManager({ orgId, existingPlans }: { orgId: string; existingPlans: Plan[] }) {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>(existingPlans)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)

  // New plan form
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newSessions, setNewSessions] = useState('1')
  const [newDescription, setNewDescription] = useState('')
  const [newClassType, setNewClassType] = useState('group')

  // Group plans by class_type
  const grouped: Record<string, Plan[]> = {}
  const unlinked: Plan[] = []
  for (const p of plans) {
    if (p.class_type && !p.training_group_id) {
      if (!grouped[p.class_type]) grouped[p.class_type] = []
      grouped[p.class_type].push(p)
    } else if (p.training_group_id) {
      // class-specific plans - show separately
    } else {
      unlinked.push(p)
    }
  }

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
        training_group_id: null,
        class_type: newClassType,
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
      router.refresh()
    }
    setLoading(false)
  }

  async function handleDelete(planId: string) {
    if (!confirm('Delete this plan?')) return
    const supabase = createClient()
    await supabase.from('subscription_plans').delete().eq('id', planId)
    setPlans(plans.filter(p => p.id !== planId))
    router.refresh()
  }

  async function handleToggle(planId: string, isActive: boolean) {
    const supabase = createClient()
    await supabase.from('subscription_plans').update({ is_active: !isActive, active: !isActive }).eq('id', planId)
    setPlans(plans.map(p => p.id === planId ? { ...p, is_active: !isActive } : p))
  }

  async function handleDuplicate(plan: Plan) {
    const supabase = createClient()
    const { data } = await supabase
      .from('subscription_plans')
      .insert({
        name: plan.name + ' (copy)',
        amount: plan.amount,
        interval: plan.interval,
        sessions_per_week: plan.sessions_per_week,
        description: plan.description,
        organisation_id: orgId,
        training_group_id: null,
        class_type: plan.class_type,
        is_active: true,
        active: true,
      })
      .select()
      .single()
    if (data) { setPlans([...plans, data as Plan]); router.refresh() }
  }

  function getTypeBadge(type: string) {
    return CLASS_TYPES.find(t => t.value === type) || { label: type, color: 'bg-white/10 text-white' }
  }

  return (
    <div className="space-y-8">
      {/* Info banner */}
      <div className="bg-[#4ecde6]/5 border border-[#4ecde6]/10 rounded-2xl p-4">
        <p className="text-sm text-[#4ecde6]">
          <strong>How it works:</strong> Create plans by class type (e.g. &quot;1-2-1&quot;, &quot;Group&quot;).
          Every class of that type will automatically show these plans to parents.
          No need to set plans on each class individually.
        </p>
      </div>

      {/* Plans by class type */}
      {CLASS_TYPES.map(type => {
        const typePlans = grouped[type.value] || []
        if (typePlans.length === 0) return null
        return (
          <div key={type.value}>
            <div className="flex items-center gap-3 mb-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${type.color}`}>{type.label}</span>
              <span className="text-white/30 text-xs">{typePlans.length} plan{typePlans.length !== 1 ? 's' : ''}</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {typePlans.map(plan => (
                <div key={plan.id} className={`bg-[#141414] border rounded-2xl p-4 transition-all ${plan.is_active ? 'border-[#1e1e1e]' : 'border-[#1e1e1e] opacity-50'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-white text-sm">{plan.name}</h3>
                      {!plan.is_active && <span className="text-[9px] px-1.5 py-0.5 bg-white/10 text-white/40 rounded-full">INACTIVE</span>}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-[#4ecde6]">&pound;{Number(plan.amount).toFixed(0)}</div>
                      <div className="text-[10px] text-white/40">/month</div>
                    </div>
                  </div>
                  {plan.description && <p className="text-xs text-white/40 mb-2">{plan.description}</p>}
                  <p className="text-xs text-white/30 mb-3">
                    {plan.sessions_per_week === 0 ? 'Unlimited sessions' : `${plan.sessions_per_week} session${(plan.sessions_per_week || 0) > 1 ? 's' : ''}/week`}
                  </p>
                  <div className="flex items-center gap-2 pt-2 border-t border-[#1e1e1e]">
                    <button onClick={() => handleDuplicate(plan)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.06] text-white/50 hover:bg-white/[0.1] transition-colors">Duplicate</button>
                    <button onClick={() => handleToggle(plan.id, plan.is_active)} className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${plan.is_active ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}>
                      {plan.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => handleDelete(plan.id)} className="text-[10px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Empty state for types with no plans */}
      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">💰</p>
          <h3 className="font-bold text-lg mb-1">No plans yet</h3>
          <p className="text-white/40 text-sm mb-4">Create your first plan — it&apos;ll apply to all classes of that type</p>
        </div>
      )}

      {/* Add plan form */}
      {showAdd ? (
        <div className="bg-[#141414] border border-[#4ecde6]/20 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-white">New Plan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Class Type *</label>
              <select value={newClassType} onChange={(e) => setNewClassType(e.target.value)} className={inputCls + ' appearance-none'}>
                {CLASS_TYPES.map(t => (
                  <option key={t.value} value={t.value} className="bg-[#1a1a1a]">{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Plan Name *</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. 1 Session / Week" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Price (£/month) *</label>
              <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="30" step="0.01" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Sessions / Week</label>
              <select value={newSessions} onChange={(e) => setNewSessions(e.target.value)} className={inputCls + ' appearance-none'}>
                <option value="1" className="bg-[#1a1a1a]">1 session</option>
                <option value="2" className="bg-[#1a1a1a]">2 sessions</option>
                <option value="3" className="bg-[#1a1a1a]">3 sessions</option>
                <option value="4" className="bg-[#1a1a1a]">4 sessions</option>
                <option value="0" className="bg-[#1a1a1a]">Unlimited</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-white/60 mb-1.5">Description</label>
              <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Optional description" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAddPlan} disabled={loading || !newName || !newAmount} className="px-5 py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-bold hover:bg-[#6dd8ee] disabled:opacity-50 transition-colors">
              {loading ? 'Adding...' : 'Create Plan'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="px-5 py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-bold hover:bg-[#6dd8ee] transition-colors">
          + Create Plan
        </button>
      )}

      {/* Applies to info */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5">
        <h3 className="font-bold text-sm mb-3">How plans apply to classes</h3>
        <div className="space-y-2 text-xs text-white/50">
          <p>1. If a class has <strong className="text-white/70">class-specific plans</strong> (set from Classes → Plans), those show first</p>
          <p>2. If not, plans matching the <strong className="text-white/70">class type</strong> (created here) are shown</p>
          <p>3. If neither exist, <strong className="text-white/70">org-wide plans</strong> (no type set) are shown as fallback</p>
        </div>
      </div>
    </div>
  )
}
