import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ClassPlanManager from './ClassPlanManager'

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/groups" className="text-text-light hover:text-text text-sm">&larr; Classes</Link>
          </div>
          <h1 className="text-2xl font-bold">Pricing Plans — {group.name}</h1>
          <p className="text-text-light text-sm mt-1">
            Create plans specific to this class. Parents will see these when booking.
          </p>
        </div>
      </div>

      <ClassPlanManager
        groupId={groupId}
        groupName={group.name}
        classType={group.class_type || 'group'}
        orgId={orgId as string}
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
