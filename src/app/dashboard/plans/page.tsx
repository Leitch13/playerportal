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

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-6">
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
      />
    </div>
  )
}
