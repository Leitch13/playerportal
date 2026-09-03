import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanManager from './PlanManager'

export default async function PlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('organisation_id', orgId)
    .order('class_type', { ascending: true })
    .order('amount', { ascending: true })

  // Names for the classes any class-specific plan is attached to. Without
  // these the list could only show an id, which tells an academy nothing.
  const classIds = [...new Set((plans || []).map((p) => p.training_group_id).filter(Boolean))] as string[]
  const { data: groups } = classIds.length
    ? await supabase
        .from('training_groups')
        .select('id, name, day_of_week, time_slot')
        .in('id', classIds)
    : { data: [] }

  return (
    <div className="bg-[#080e18] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <p className="text-white/50 text-sm mt-1">Create plans by class type — they automatically apply to all classes of that type</p>
      </div>

      <PlanManager
        orgId={orgId as string}
        existingPlans={(plans || []) as Array<{
          id: string
          name: string
          amount: number
          interval: string
          sessions_per_week: number | null
          description: string | null
          is_active: boolean
          class_type: string | null
          training_group_id: string | null
        }>}
        classes={(groups || []) as Array<{ id: string; name: string; day_of_week: string | null; time_slot: string | null }>}
      />
    </div>
  )
}
