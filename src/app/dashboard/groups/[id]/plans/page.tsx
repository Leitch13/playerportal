import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ClassPlanManager from './ClassPlanManager'
import { pricesForClass } from '@/lib/class-prices'

export default async function ClassPlansPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  const { data: group } = await supabase
    .from('training_groups')
    .select('id, name, class_type')
    .eq('id', groupId)
    .eq('organisation_id', orgId)
    .single()

  if (!group) redirect('/dashboard/groups')

  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('organisation_id', orgId)
    .eq('training_group_id', groupId)
    .order('amount', { ascending: true })

  // No price of its own: what parents are offered now (class type / "any class"), shown so the academy knows.
  const { data: orgPlans } = await supabase
    .from('subscription_plans')
    .select('id, name, amount, training_group_id, class_type, active')
    .eq('organisation_id', orgId)
  const current = pricesForClass((orgPlans || []) as { id: string; name: string; amount: number; training_group_id: string | null; class_type: string | null; active: boolean | null }[], { id: groupId, class_type: group.class_type })
  const inheritedPrices = current.own ? [] : current.prices.map((p) => ({ name: p.name, amount: Number(p.amount) }))

  return (
    <div className="bg-[#080e18] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/groups" className="text-white/40 hover:text-white text-sm">&larr; Classes</Link>
          </div>
          <h1 className="text-2xl font-bold text-white">Prices — {group.name}</h1>
          <p className="text-white/40 text-sm mt-1">
            What parents pay for this class. Use your own names.
          </p>
        </div>
      </div>

      <ClassPlanManager
        groupId={groupId}
        groupName={group.name}
        classType={group.class_type || 'group'}
        orgId={orgId as string}
        inheritedPrices={inheritedPrices}
        existingPlans={(plans || []) as Array<{
          id: string
          name: string
          amount: number
          interval: string
          sessions_per_week: number | null
          description: string | null
          is_active: boolean
        }>}
      />
    </div>
  )
}
