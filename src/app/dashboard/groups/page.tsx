import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/EmptyState'
import GroupForm from './GroupForm'
import GroupCard from './GroupCard'

export default async function GroupsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id, role')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organisation_id || ''
  const role = profile?.role || 'parent'
  const isAdmin = role === 'admin'

  // Get org slug for shareable class links
  const { data: org } = await supabase
    .from('organisations')
    .select('slug')
    .eq('id', orgId)
    .single()
  const orgSlug = org?.slug || ''

  const { data: groups } = await supabase
    .from('training_groups')
    .select('*, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .order('name')

  const { data: coaches } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['admin', 'coach'])
    .order('full_name')

  // Get enrolment counts per group
  const groupIds = (groups || []).map((g) => g.id)
  const { data: enrolments } = groupIds.length > 0
    ? await supabase
        .from('enrolments')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('status', 'active')
    : { data: [] as { group_id: string }[] }

  const countByGroup = new Map<string, number>()
  for (const e of enrolments || []) {
    countByGroup.set(e.group_id, (countByGroup.get(e.group_id) || 0) + 1)
  }

  // Sort by day of week
  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const sortedGroups = [...(groups || [])].sort((a, b) => {
    const dayA = DAY_ORDER.indexOf(a.day_of_week || '')
    const dayB = DAY_ORDER.indexOf(b.day_of_week || '')
    return (dayA === -1 ? 99 : dayA) - (dayB === -1 ? 99 : dayB)
  })

  // Group by day
  const groupsByDay = new Map<string, typeof sortedGroups>()
  for (const g of sortedGroups) {
    const day = g.day_of_week || 'Unscheduled'
    const list = groupsByDay.get(day) || []
    list.push(g)
    groupsByDay.set(day, list)
  }

  // Stats
  const totalClasses = (groups || []).length
  const totalEnrolled = Array.from(countByGroup.values()).reduce((a, b) => a + b, 0)
  const totalCapacity = (groups || []).reduce((sum, g) => sum + ((g.max_capacity as number) || 20), 0)
  const fillRate = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Classes</h1>
          <p className="text-sm text-text-light mt-0.5">Manage your training sessions and class capacity</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-primary">{totalClasses}</div>
          <div className="text-xs text-text-light mt-0.5">Total Classes</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-accent">{totalEnrolled}</div>
          <div className="text-xs text-text-light mt-0.5">Players Enrolled</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-primary">{totalCapacity}</div>
          <div className="text-xs text-text-light mt-0.5">Total Capacity</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className={`text-2xl font-bold ${fillRate >= 80 ? 'text-orange-500' : 'text-emerald-500'}`}>{fillRate}%</div>
          <div className="text-xs text-text-light mt-0.5">Fill Rate</div>
        </div>
      </div>

      {/* Create new class (admin only) */}
      {isAdmin && <GroupForm coaches={coaches || []} orgId={orgId} />}

      {/* Classes by day */}
      {(groups || []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="text-lg font-bold mb-1">No classes yet</h3>
          <p className="text-sm text-text-light mb-4">Create your first class to start enrolling players</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(groupsByDay.entries()).map(([day, dayGroups]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold">{day}</h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-light font-medium">{dayGroups.length} class{dayGroups.length !== 1 ? 'es' : ''}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dayGroups.map((g) => {
                  const enrolled = countByGroup.get(g.id) || 0
                  const capacity = (g.max_capacity as number) || 20
                  const coach = g.coach as unknown as { full_name: string } | null

                  return (
                    <GroupCard
                      key={g.id}
                      group={{
                        id: g.id,
                        name: g.name,
                        day_of_week: g.day_of_week,
                        time_slot: g.time_slot,
                        location: g.location,
                        coach_id: g.coach_id,
                        max_capacity: capacity,
                        age_group: (g as unknown as { age_group: string | null }).age_group,
                        description: (g as unknown as { description: string | null }).description,
                        price_per_session: (g as unknown as { price_per_session: number | null }).price_per_session,
                        end_time: null,
                      }}
                      coachName={coach?.full_name || null}
                      enrolled={enrolled}
                      isAdmin={isAdmin}
                      coaches={coaches || []}
                      orgId={orgId}
                      orgSlug={orgSlug}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
