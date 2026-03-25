import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import StatusBadge from '@/components/StatusBadge'
import EmptyState from '@/components/EmptyState'
import EnrolmentForm from './EnrolmentForm'
import EnrolmentStatusToggle from './EnrolmentStatusToggle'

export default async function EnrolmentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organisation_id || ''

  const { data: enrolments } = await supabase
    .from('enrolments')
    .select(`
      *,
      player:players(first_name, last_name, age_group),
      group:training_groups(name, day_of_week, time_slot)
    `)
    .order('enrolled_at', { ascending: false })

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .order('first_name')

  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week')
    .order('name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Enrolments</h1>

      <EnrolmentForm players={players || []} groups={groups || []} orgId={orgId} />

      {(enrolments || []).length === 0 ? (
        <EmptyState message="No enrolments yet." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium">Player</th>
                  <th className="text-left py-2 font-medium">Group</th>
                  <th className="text-left py-2 font-medium">Schedule</th>
                  <th className="text-left py-2 font-medium">Enrolled</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-left py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(enrolments || []).map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-2 font-medium">
                      {(e.player as unknown as { first_name: string; last_name: string })?.first_name}{' '}
                      {(e.player as unknown as { first_name: string; last_name: string })?.last_name}
                    </td>
                    <td className="py-2">
                      {(e.group as unknown as { name: string })?.name}
                    </td>
                    <td className="py-2 text-text-light">
                      {(e.group as unknown as { day_of_week: string })?.day_of_week}
                      {(e.group as unknown as { time_slot: string })?.time_slot &&
                        ` ${(e.group as unknown as { time_slot: string }).time_slot}`}
                    </td>
                    <td className="py-2">
                      {new Date(e.enrolled_at).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="py-2">
                      <EnrolmentStatusToggle
                        enrolmentId={e.id}
                        currentStatus={e.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
