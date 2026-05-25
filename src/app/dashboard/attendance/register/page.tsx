import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'

export default async function RegisterListPage() {
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

  if (!profile) redirect('/dashboard')

  const role = (profile?.role || 'parent') as UserRole
  if (role === 'parent') redirect('/dashboard/attendance')

  const orgId = profile?.organisation_id || ''

  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .eq('organisation_id', orgId)
    .order('name')

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

  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const sortedGroups = [...(groups || [])].sort((a, b) => {
    const dayA = DAY_ORDER.indexOf(a.day_of_week || '')
    const dayB = DAY_ORDER.indexOf(b.day_of_week || '')
    return (dayA === -1 ? 99 : dayA) - (dayB === -1 ? 99 : dayB)
  })

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Print Class Register</h1>
            <p className="text-sm text-white/60 mt-0.5">
              Select a class to generate a printable attendance register
            </p>
          </div>
          <Link
            href="/dashboard/attendance"
            className="text-sm text-[#4ecde6] hover:text-[#4ecde6]/80 transition-colors"
          >
            Back to Attendance
          </Link>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent" />

        {sortedGroups.length === 0 ? (
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-lg font-bold mb-1 text-white">No classes found</h3>
            <p className="text-sm text-white/60">Create classes first to generate registers</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedGroups.map((g) => {
              const enrolled = countByGroup.get(g.id) || 0
              const coach = g.coach as unknown as { full_name: string } | null

              return (
                <div key={g.id} className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 hover:border-[#4ecde6]/30 transition-all group">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-white group-hover:text-[#4ecde6] transition-colors">
                      {g.name}
                    </h3>
                    {coach?.full_name && (
                      <p className="text-xs text-white/50 mt-0.5">Coach: {coach.full_name}</p>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm text-white/60 mb-5">
                    {g.day_of_week && (
                      <div className="flex items-center gap-2">
                        <span className="text-white/40">Day</span>
                        <span className="text-white/80">{g.day_of_week}</span>
                      </div>
                    )}
                    {g.time_slot && (
                      <div className="flex items-center gap-2">
                        <span className="text-white/40">Time</span>
                        <span className="text-white/80">{g.time_slot}</span>
                      </div>
                    )}
                    {g.location && (
                      <div className="flex items-center gap-2">
                        <span className="text-white/40">Location</span>
                        <span className="text-white/80">{g.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">Players</span>
                      <span className="text-white/80">{enrolled}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/attendance/register/${g.id}`}
                      className="flex-1 text-center px-3 py-2 bg-[#4ecde6] text-black text-sm font-semibold rounded-xl hover:bg-[#4ecde6]/90 transition-colors"
                    >
                      View Register
                    </Link>
                    <Link
                      href={`/dashboard/attendance/register/${g.id}/blank`}
                      className="flex-1 text-center px-3 py-2 bg-white/[0.08] text-white text-sm font-medium rounded-xl hover:bg-white/[0.12] transition-colors"
                    >
                      Blank Register
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
