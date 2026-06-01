import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import type { UserRole } from '@/lib/types'
import SessionPlanForm from './SessionPlanForm'

export default async function SessionPlansPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('session_plans')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const isStaff = role === 'admin' || role === 'coach'
  if (!isStaff) redirect('/dashboard')

  const orgId = profile?.organisation_id || ''
  if (!orgId) redirect('/dashboard')

  // CRITICAL: org-scoped. Without these filters, super-admins would see
  // every academy's session plans + training groups (same RLS-bypass class
  // as the Parents page leak).
  const { data: plans } = await supabase
    .from('session_plans')
    .select('*, group:training_groups(name)')
    .eq('organisation_id', orgId)
    .order('session_date', { ascending: false })
    .limit(50)

  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name')
    .eq('organisation_id', orgId)
    .order('name')

  // Group plans by date
  const grouped: Record<string, typeof plans> = {}
  for (const plan of plans || []) {
    const key = plan.session_date || 'No date'
    if (!grouped[key]) grouped[key] = []
    grouped[key]!.push(plan)
  }

  // Sort date keys: upcoming first, then past
  const today = new Date().toISOString().split('T')[0]
  const dateKeys = Object.keys(grouped).sort((a, b) => {
    if (a === 'No date') return 1
    if (b === 'No date') return -1
    const aUpcoming = a >= today!
    const bUpcoming = b >= today!
    if (aUpcoming && !bUpcoming) return -1
    if (!aUpcoming && bUpcoming) return 1
    return aUpcoming ? a.localeCompare(b) : b.localeCompare(a)
  })

  const statusColors: Record<string, string> = {
    draft: 'bg-white/10 text-white/50',
    ready: 'bg-[#4ecde6]/20 text-[#4ecde6]',
    completed: 'bg-emerald-500/20 text-emerald-400',
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] -m-6 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Session Plans</h1>
      </div>

      <SessionPlanForm
        groups={groups || []}
        coachId={user.id}
        orgId={orgId}
      />

      {dateKeys.length === 0 ? (
        <div className="text-center py-16 text-white/40">
          <svg className="mx-auto w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-1.992a48.09 48.09 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          <p className="text-sm">No session plans yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {dateKeys.map((dateKey) => {
            const isUpcoming = dateKey !== 'No date' && dateKey >= today!
            return (
              <div key={dateKey}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">
                    {dateKey === 'No date'
                      ? 'Unscheduled'
                      : new Date(dateKey + 'T00:00:00').toLocaleDateString('en-GB', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                  </h2>
                  {isUpcoming && (
                    <span className="text-[10px] uppercase tracking-widest text-[#4ecde6] bg-[#4ecde6]/10 px-2 py-0.5 rounded-full">
                      Upcoming
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {(grouped[dateKey] || []).map((plan) => (
                    <div
                      key={plan.id}
                      className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 hover:border-white/[0.15] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-white font-semibold truncate">{plan.title}</h3>
                            <span
                              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${statusColors[plan.status] || statusColors.draft}`}
                            >
                              {plan.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-white/40">
                            {(plan.group as unknown as { name: string })?.name && (
                              <span>{(plan.group as unknown as { name: string }).name}</span>
                            )}
                            {plan.duration_minutes && <span>{plan.duration_minutes} min</span>}
                          </div>
                          {plan.objectives && (
                            <p className="text-sm text-white/50 mt-2 line-clamp-2">{plan.objectives}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link
                            href={`/dashboard/session-plans/${plan.id}`}
                            className="px-3 py-1.5 bg-[#4ecde6]/10 text-[#4ecde6] rounded-lg text-xs font-semibold hover:bg-[#4ecde6]/20 transition-colors flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            View
                          </Link>
                          <SessionPlanForm
                            groups={groups || []}
                            coachId={user.id}
                            orgId={orgId}
                            editPlan={plan}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
