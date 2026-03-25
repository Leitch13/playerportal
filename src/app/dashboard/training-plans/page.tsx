import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import type { UserRole } from '@/lib/types'
import TrainingPlanForm from './TrainingPlanForm'

export default async function TrainingPlansPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const orgId = profile?.organisation_id || ''

  const { data: plans } = await supabase
    .from('training_plans')
    .select('*, group:training_groups(name)')
    .order('week_starting', { ascending: false })
    .limit(20)

  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name')
    .order('name')

  const isStaff = role === 'admin' || role === 'coach'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Training Plans</h1>

      {isStaff && <TrainingPlanForm groups={groups || []} orgId={orgId} />}

      {(plans || []).length === 0 ? (
        <EmptyState message="No training plans published yet." />
      ) : (
        <div className="space-y-4">
          {(plans || []).map((plan) => (
            <Card
              key={plan.id}
              title={plan.title}
            >
              <div className="space-y-2 text-sm">
                <div className="flex gap-4 text-text-light">
                  <span>{(plan.group as unknown as { name: string })?.name}</span>
                  <span>
                    Week of{' '}
                    {new Date(plan.week_starting).toLocaleDateString()}
                  </span>
                </div>
                {plan.description && <p>{plan.description}</p>}
                {plan.focus_areas && (
                  <p>
                    <span className="font-medium">Focus: </span>
                    {plan.focus_areas}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
