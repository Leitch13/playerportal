import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
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

  if (!profile) redirect('/dashboard')

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

  // ─── Compute streaks per player/group ───
  type StreakKey = string
  const streakMap = new Map<StreakKey, { name: string; group: string; playerId: string; streak: number; absenceStreak: number }>()

  // Group attendance by player+group, sorted by date descending (already sorted)
  const byPlayerGroup = new Map<StreakKey, typeof attendance>()
  for (const a of attendance || []) {
    const player = a.player as unknown as { first_name: string; last_name: string }
    const group = a.group as unknown as { name: string }
    const key = `${a.player_id}__${a.group_id}`
    if (!byPlayerGroup.has(key)) {
      byPlayerGroup.set(key, [])
      streakMap.set(key, {
        name: `${player?.first_name || ''} ${player?.last_name || ''}`.trim(),
        group: group?.name || '',
        playerId: a.player_id,
        streak: 0,
        absenceStreak: 0,
      })
    }
    byPlayerGroup.get(key)!.push(a)
  }

  for (const [key, records] of byPlayerGroup) {
    const info = streakMap.get(key)!
    // Records are already date-descending — count consecutive present from most recent
    let streak = 0
    for (const r of records!) {
      if (r.present) streak++
      else break
    }
    info.streak = streak

    // Count consecutive absences from most recent
    let absenceStreak = 0
    for (const r of records!) {
      if (!r.present) absenceStreak++
      else break
    }
    info.absenceStreak = absenceStreak
  }

  const absenceAlerts = [...streakMap.values()].filter((s) => s.absenceStreak >= 3)
  const bestStreaks = [...streakMap.values()].filter((s) => s.streak >= 2).sort((a, b) => b.streak - a.streak)

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Attendance</h1>

      {/* Absence alerts */}
      {absenceAlerts.length > 0 && (
        <div className="space-y-2">
          {absenceAlerts.map((alert) => (
            <div
              key={`${alert.playerId}-${alert.group}`}
              className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-sm text-red-400 font-medium">
                  {alert.name} has missed {alert.absenceStreak} sessions in a row
                  {alert.group ? ` (${alert.group})` : ''}
                </span>
              </div>
              <Link
                href={`/dashboard/players?search=${encodeURIComponent(alert.name)}`}
                className="text-xs text-red-400 hover:text-red-300 font-medium whitespace-nowrap ml-3"
              >
                View Profile &rarr;
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className="text-3xl font-bold text-[#4ecde6]">{totalSessions}</div>
            <div className="text-sm text-white/60">Sessions</div>
          </div>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className="text-3xl font-bold text-accent">{present}</div>
            <div className="text-sm text-white/60">Present</div>
          </div>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className="text-3xl font-bold text-[#4ecde6]">{rate}%</div>
            <div className="text-sm text-white/60">Rate</div>
          </div>
        </div>
      </div>

      {/* Attendance streaks */}
      {bestStreaks.length > 0 && (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white/80 mb-3">Attendance Streaks</h2>
          <div className="space-y-2">
            {bestStreaks.slice(0, 5).map((s) => (
              <div key={`${s.playerId}-${s.group}`} className="flex items-center justify-between">
                <div className="text-sm text-white">
                  {s.name}
                  {s.group && <span className="text-white/40 ml-1.5 text-xs">{s.group}</span>}
                </div>
                <span className="text-xs font-medium text-[#4ecde6] bg-[#4ecde6]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {s.streak} sessions in a row
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(attendance || []).length === 0 ? (
        <EmptyState message="No attendance records yet." />
      ) : (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Sessions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-2 font-medium text-white/80">Date</th>
                  <th className="text-left py-2 font-medium text-white/80">Player</th>
                  <th className="text-left py-2 font-medium text-white/80">Group</th>
                  <th className="text-left py-2 font-medium text-white/80">Status</th>
                  <th className="text-left py-2 font-medium text-white/80">Streak</th>
                </tr>
              </thead>
              <tbody>
                {(attendance || []).map((a) => {
                  const key = `${a.player_id}__${a.group_id}`
                  const info = streakMap.get(key)
                  return (
                    <tr key={a.id} className="border-b border-white/[0.08] last:border-0 hover:bg-white/[0.03]">
                      <td className="py-2 text-white/80">
                        {new Date(a.session_date).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-white">
                        {(a.player as unknown as { first_name: string; last_name: string })?.first_name}{' '}
                        {(a.player as unknown as { first_name: string; last_name: string })?.last_name}
                      </td>
                      <td className="py-2 text-white/60">{(a.group as unknown as { name: string })?.name}</td>
                      <td className="py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            a.present
                              ? 'bg-[#4ecde6]/10 text-[#4ecde6]'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {a.present ? 'Present' : 'Absent'}
                        </span>
                      </td>
                      <td className="py-2">
                        {info && info.streak > 0 && (
                          <span className="text-xs text-[#4ecde6]/70">{info.streak} in a row</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

async function CoachAttendance({ orgId }: { orgId: string }) {
  const supabase = await createClient()

  // P2 Trial Funnel Reliability — surface trial guests above enrolled
  // players so the coach knows who else will be at the session. Window
  // covers ±60 days so a guest booked for the next session shows even
  // if the academy is browsing back through past sessions. The client
  // filters by selected group + date.
  const trialWindowStart = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().split('T')[0]
  const trialWindowEnd = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split('T')[0]

  const [{ data: groups }, { data: players }, { data: enrolments }, { data: trials }] = await Promise.all([
    supabase
      .from('training_groups')
      .select('id, name, day_of_week, time_slot, location')
      .eq('organisation_id', orgId)
      .order('day_of_week', { nullsFirst: false })
      .order('name'),
    supabase
      .from('players')
      .select('id, first_name, last_name, age_group')
      .eq('organisation_id', orgId)
      .order('first_name'),
    supabase
      .from('enrolments')
      .select('group_id, player_id')
      .eq('organisation_id', orgId)
      .eq('status', 'active'),
    supabase
      .from('trial_bookings')
      .select('id, training_group_id, parent_name, parent_email, parent_phone, child_name, child_age, preferred_date, status')
      .eq('organisation_id', orgId)
      .in('status', ['pending', 'confirmed'])
      .gte('preferred_date', trialWindowStart)
      .lte('preferred_date', trialWindowEnd)
      .order('preferred_date'),
  ])

  // Build a group_id -> [player_id] map so the manager only shows enrolled players
  const enrolmentMap: Record<string, string[]> = {}
  for (const e of enrolments || []) {
    if (!e.group_id || !e.player_id) continue
    if (!enrolmentMap[e.group_id]) enrolmentMap[e.group_id] = []
    enrolmentMap[e.group_id].push(e.player_id)
  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Attendance</h1>
            <p className="text-sm text-white/50 mt-1">Mark your class register — tap each player or use the bulk actions.</p>
          </div>
          <Link
            href="/dashboard/attendance/register"
            className="px-3 py-2 rounded-full text-xs font-semibold bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10 whitespace-nowrap"
          >
            🖨 Print register
          </Link>
        </div>

        <AttendanceManager
          groups={groups || []}
          players={players || []}
          enrolmentMap={enrolmentMap}
          orgId={orgId}
          trials={(trials || []).map(t => ({
            id: t.id,
            group_id: t.training_group_id,
            child_name: t.child_name,
            child_age: t.child_age,
            parent_name: t.parent_name,
            parent_email: t.parent_email,
            parent_phone: t.parent_phone,
            preferred_date: t.preferred_date,
            status: t.status,
          }))}
        />

        <p className="text-xs text-white/30 text-center">
          💡 Coach tip: use <strong className="text-white/50">Mark all present</strong> first, then tap ✗ on any no-shows. Faster than tapping every player.
        </p>
      </div>
    </div>
  )
}
