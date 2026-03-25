import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import type { UserRole } from '@/lib/types'
import AttendanceManager from './AttendanceManager'

export default async function AttendancePage() {
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

  if (role === 'parent') return <ParentAttendance userId={user.id} />
  return <CoachAttendance orgId={orgId} />
}

async function ParentAttendance({ userId }: { userId: string }) {
  const supabase = await createClient()

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('parent_id', userId)

  const playerIds = (players || []).map((p) => p.id)

  const { data: attendance } = await supabase
    .from('attendance')
    .select(`
      *,
      player:players(first_name, last_name),
      group:training_groups(name)
    `)
    .in('player_id', playerIds.length > 0 ? playerIds : ['none'])
    .order('session_date', { ascending: false })
    .limit(50)

  const totalSessions = (attendance || []).length
  const present = (attendance || []).filter((a) => a.present).length
  const rate = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Attendance</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">{totalSessions}</div>
            <div className="text-sm text-text-light">Sessions</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-accent">{present}</div>
            <div className="text-sm text-text-light">Present</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">{rate}%</div>
            <div className="text-sm text-text-light">Rate</div>
          </div>
        </Card>
      </div>

      {(attendance || []).length === 0 ? (
        <EmptyState message="No attendance records yet." />
      ) : (
        <Card title="Recent Sessions">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Player</th>
                  <th className="text-left py-2 font-medium">Group</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(attendance || []).map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="py-2">
                      {new Date(a.session_date).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      {(a.player as unknown as { first_name: string; last_name: string })?.first_name}{' '}
                      {(a.player as unknown as { first_name: string; last_name: string })?.last_name}
                    </td>
                    <td className="py-2">{(a.group as unknown as { name: string })?.name}</td>
                    <td className="py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.present
                            ? 'bg-cyan-100 text-cyan-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {a.present ? 'Present' : 'Absent'}
                      </span>
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

async function CoachAttendance({ orgId }: { orgId: string }) {
  const supabase = await createClient()

  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot')
    .order('name')

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, age_group')
    .order('first_name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage Attendance</h1>
      <AttendanceManager
        groups={groups || []}
        players={players || []}
        orgId={orgId}
      />
    </div>
  )
}
