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

const inputCls = 'w-full px-3 py-2.5 bg-[#142236] border border-[#293b58] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/30 focus:border-[#4ecde6]/50 transition-all'

interface ClassRef { id: string; name: string; day_of_week: string | null; time_slot: string | null }

export default function PlanManager({
  orgId,
  existingPlans,
  classes = [],
}: {
  orgId: string
  existingPlans: Plan[]
  /** Classes any class-specific plan is attached to, so the list can name them. */
  classes?: ClassRef[]
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
  const [newClassType, setNewClassType] = useState('group')

  // Group plans by class_type.
  //
  // The branch for class-specific plans used to be an empty comment, so a plan
  // attached to a single class worked perfectly on the booking page and was
  // INVISIBLE here — not listed, not editable, not deletable. An academy could
  // create one and then have no way to find it again. They are now listed in
  // their own section with the class they belong to.
  const grouped: Record<string, Plan[]> = {}
  const unlinked: Plan[] = []
  const classSpecific: Plan[] = []
  for (const p of plans) {
    if (p.training_group_id) {
      classSpecific.push(p)
    } else if (p.class_type) {
      if (!grouped[p.class_type]) grouped[p.class_type] = []
      grouped[p.class_type].push(p)
    } else {
      unlinked.push(p)
    }
  }
  const classById = new Map(classes.map((c) => [c.id, c]))

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
    const plan = plans.find((p) => p.id === planId)
    const check = await canDeletePlan(planId, plan?.name)
    if (!check.ok) { alert(check.message); return }
    if (!confirm(`Delete "${plan?.name ?? 'this plan'}"? Nobody is on it, so nothing is affected.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('subscription_plans').delete().eq('id', planId)
    if (error) { alert(error.message); return }
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

  // The label an academy leaves on the default "1 session a week" is noise, and
  // wrong for plans like "2x per week" that were never changed from it. Only
  // say it when the academy set something else.
  const sessionsLabel = (n: number | null) =>
    n === 0 ? 'Unlimited sessions' : n && n > 1 ? `${n} sessions a week` : null
  const price = (n: number) => Number(n).toFixed(Number(n) % 1 ? 2 : 0)
  const quietBtn = 'rounded-[9px] border border-[#293b58] px-2.5 py-1.5 text-xs font-medium text-[#93a2ba] transition-colors hover:border-[#4ecde6] hover:text-[#eef2f9]'

  const planRow = (plan: Plan, where: React.ReactNode | null, editHref: string) => (
    <li key={plan.id} className={`flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5 ${plan.is_active ? '' : 'opacity-60'}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#eef2f9]">{plan.name}</p>
        {(where || sessionsLabel(plan.sessions_per_week) || plan.description) && (
          <p className="mt-0.5 truncate text-xs text-[#93a2ba]">
            {where}
            {!where && [sessionsLabel(plan.sessions_per_week), plan.description].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
        <p className="text-sm tabular-nums text-[#eef2f9] sm:w-28 sm:text-right">
          <span className="text-base font-semibold">&pound;{price(plan.amount)}</span>
          <span className="text-xs text-[#93a2ba]"> a month</span>
        </p>
        <span className={`inline-flex w-[92px] justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          plan.is_active ? 'border-[#67c79a]/40 text-[#67c79a]' : 'border-[#293b58] text-[#93a2ba]'
        }`}>
          {plan.is_active ? 'On sale' : 'Switched off'}
        </span>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <a href={editHref} className={quietBtn}>Edit</a>
          <button onClick={() => handleToggle(plan.id, plan.is_active)} className={`${quietBtn} w-[84px]`}>
            {plan.is_active ? 'Switch off' : 'Switch on'}
          </button>
          <details className="relative">
            <summary className={`${quietBtn} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label={`More for ${plan.name}`}>More</summary>
            <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-[11px] border border-[#293b58] bg-[#142236] py-1 shadow-xl">
              {!plan.training_group_id && (
                <button onClick={() => handleDuplicate(plan)} className="block w-full px-3 py-2 text-left text-xs text-[#eef2f9] hover:bg-white/[0.06]">Make a copy</button>
              )}
              <button onClick={() => handleDelete(plan.id)} className="block w-full px-3 py-2 text-left text-xs text-[#e0736d] hover:bg-white/[0.06]">Delete plan</button>
            </div>
          </details>
        </div>
      </div>
    </li>
  )

  const onSale = plans.filter((p) => p.is_active).length
  const sortPlans = (list: Plan[]) => [...list].sort((x, y) => Number(y.is_active) - Number(x.is_active) || Number(x.amount) - Number(y.amount))

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#93a2ba]">
          {plans.length === 0 ? 'No plans yet.' : `${onSale} on sale${plans.length - onSale > 0 ? ` · ${plans.length - onSale} switched off` : ''}. A plan shows on every class of its type.`}
        </p>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="rounded-[10px] bg-[#4ecde6] px-3.5 py-2 text-xs font-semibold text-[#04141a] transition-colors hover:bg-[#7fdcee]">
            + Add plan
          </button>
        )}
      </div>

      {/* Plans by class type: one quiet heading, one list */}
      {CLASS_TYPES.map(type => {
        const typePlans = grouped[type.value] || []
        if (typePlans.length === 0) return null
        return (
          <section key={type.value} data-testid="plans-type-list">
            <h2 className="mb-2 flex items-baseline gap-2 text-[15px] font-semibold text-[#eef2f9]">
              {type.label}
              <span className="text-xs font-normal tabular-nums text-[#5b6c86]">{typePlans.length} {typePlans.length === 1 ? 'plan' : 'plans'}</span>
            </h2>
            <ul className="divide-y divide-[#1d2c42] rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b]">
              {sortPlans(typePlans).map(plan => planRow(plan, null, '/dashboard/payments?tab=manage'))}
            </ul>
          </section>
        )
      })}

      {/* Plans with no class type: the fallback when a class has nothing else. Previously not listed here at all. */}
      {unlinked.length > 0 && (
        <section data-testid="plans-unlinked">
          <h2 className="mb-1 flex items-baseline gap-2 text-[15px] font-semibold text-[#eef2f9]">
            Any class
            <span className="text-xs font-normal tabular-nums text-[#5b6c86]">{unlinked.length} {unlinked.length === 1 ? 'plan' : 'plans'}</span>
          </h2>
          <p className="mb-2 text-xs text-[#93a2ba]">No class type set. These show on a class only when it has no plan of its own type.</p>
          <ul className="divide-y divide-[#1d2c42] rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b]">
            {sortPlans(unlinked).map(plan => planRow(plan, null, '/dashboard/payments?tab=manage'))}
          </ul>
        </section>
      )}

      {/* Plans attached to one specific class. */}
      {classSpecific.length > 0 && (
        <section data-testid="class-specific-plans">
          <h2 className="mb-1 flex items-baseline gap-2 text-[15px] font-semibold text-[#eef2f9]">
            One class only
            <span className="text-xs font-normal tabular-nums text-[#5b6c86]">{classSpecific.length} {classSpecific.length === 1 ? 'plan' : 'plans'}</span>
          </h2>
          <p className="mb-2 text-xs text-[#93a2ba]">These show on one class instead of every class of that type. Parents booking that class see only these.</p>
          <ul className="divide-y divide-[#1d2c42] rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b]">
            {sortPlans(classSpecific).map(plan => {
              const cls = classById.get(plan.training_group_id as string)
              return planRow(
                plan,
                cls
                  ? <>Only on <span className="text-[#eef2f9]">{cls.name}</span>{cls.day_of_week ? ` · ${cls.day_of_week}` : ''}{cls.time_slot ? ` ${cls.time_slot}` : ''}</>
                  : <span className="text-[#d8a95a]">Attached to a class that no longer exists</span>,
                cls ? `/dashboard/groups/${cls.id}/plans` : '/dashboard/payments?tab=manage',
              )
            })}
          </ul>
        </section>
      )}

      {/* Empty state for types with no plans */}
      {Object.keys(grouped).length === 0 && classSpecific.length === 0 && unlinked.length === 0 && (
        <div className="text-center py-12">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04]"><svg className="h-6 w-6 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>{PALETTE_ICON_PATHS['card']}</svg></span>
          <h3 className="font-bold text-lg mb-1">No plans yet</h3>
          <p className="text-white/40 text-sm mb-4">Create your first plan — it&apos;ll apply to all classes of that type</p>
        </div>
      )}

      {/* Add plan form */}
      {showAdd ? (
        <div className="bg-[#0f1a2b] border border-[#293b58] rounded-[15px] p-5 space-y-4">
          <h3 className="font-bold text-white">New Plan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Class Type *</label>
              <select value={newClassType} onChange={(e) => setNewClassType(e.target.value)} className={inputCls + ' appearance-none'}>
                {CLASS_TYPES.map(t => (
                  <option key={t.value} value={t.value} className="bg-[#142236]">{t.label}</option>
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
                <option value="1" className="bg-[#142236]">1 session</option>
                <option value="2" className="bg-[#142236]">2 sessions</option>
                <option value="3" className="bg-[#142236]">3 sessions</option>
                <option value="4" className="bg-[#142236]">4 sessions</option>
                <option value="0" className="bg-[#142236]">Unlimited</option>
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
      ) : null}

      {/* Applies to info */}
      <details className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-[#eef2f9]">Which plans does a parent see on a class?</summary>
        <div className="mt-3 space-y-2 text-xs text-white/50">
          <p>1. If a class has <strong className="text-white/70">class-specific plans</strong> (set from Classes → Plans), those show first</p>
          <p>2. If not, plans matching the <strong className="text-white/70">class type</strong> (created here) are shown</p>
          <p>3. If neither exist, <strong className="text-white/70">org-wide plans</strong> (no type set) are shown as fallback</p>
        </div>
      </details>
    </div>
  )
}
