import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const role = profile?.role || 'parent'
  const isAdmin = role === 'admin' || role === 'coach'

  // Fetch group with coach info
  const { data: group } = await supabase
    .from('training_groups')
    .select('*, coach:profiles!training_groups_coach_id_fkey(id, full_name, email)')
    .eq('id', id)
    .single()

  if (!group) redirect('/dashboard/groups')

  // Fetch enrolled players
  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('id, status, player:players(id, first_name, last_name, photo_url)')
    .eq('group_id', id)
    .eq('status', 'active')

  const players = (enrolments || [])
    .map((e) => e.player as unknown as { id: string; first_name: string; last_name: string; photo_url: string | null })
    .filter(Boolean)
    .sort((a, b) => a.first_name.localeCompare(b.first_name))

  const coach = group.coach as unknown as { id: string; full_name: string; email: string } | null
  const capacity = (group.max_capacity as number) || 20
  const enrolled = players.length
  const fillPercent = Math.min(100, Math.round((enrolled / capacity) * 100))
  const isFull = enrolled >= capacity
  const isWarning = fillPercent > 90 && !isFull
  const isNearFull = fillPercent >= 70 && !isFull

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Link href="/dashboard/groups" className="hover:text-[#4ecde6] transition-colors">
            Classes
          </Link>
          <span>/</span>
          <span className="text-white/80">{group.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{group.name}</h1>
            {(group as any).short_description && (
              <p className="text-sm text-white/60 mt-1">{(group as any).short_description}</p>
            )}
            {!(group as any).short_description && (group as any).description && (
              <p className="text-sm text-white/60 mt-1">{(group as any).description}</p>
            )}
          </div>
          {isAdmin && (
            <Link
              href={`/dashboard/session/${group.id}`}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#4ecde6] text-black hover:bg-[#3dbdd6] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Session
            </Link>
          )}
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {group.day_of_week && (
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4">
              <div className="text-xs text-white/50 mb-1">Day</div>
              <div className="text-sm font-semibold">{group.day_of_week}</div>
            </div>
          )}
          {group.time_slot && (
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4">
              <div className="text-xs text-white/50 mb-1">Time</div>
              <div className="text-sm font-semibold">{group.time_slot}</div>
            </div>
          )}
          {group.location && (
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4">
              <div className="text-xs text-white/50 mb-1">Location</div>
              <div className="text-sm font-semibold">{group.location}</div>
            </div>
          )}
          {coach && (
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4">
              <div className="text-xs text-white/50 mb-1">Coach</div>
              <div className="text-sm font-semibold">{coach.full_name}</div>
            </div>
          )}
        </div>

        {/* Capacity */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white">Capacity</h2>
            <div className="flex items-center gap-2">
              {isFull && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">FULL</span>
              )}
              <span className={`text-sm font-bold ${isFull ? 'text-red-500' : isWarning ? 'text-red-500' : isNearFull ? 'text-amber-500' : 'text-emerald-500'}`}>
                {enrolled} / {capacity}
              </span>
            </div>
          </div>
          <div className="w-full bg-[#1a1a1a] rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                isFull
                  ? 'bg-gradient-to-r from-red-400 to-red-500'
                  : isWarning
                    ? 'bg-gradient-to-r from-red-400 to-red-500'
                    : isNearFull
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                      : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              }`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
          <p className="text-xs text-white/40 mt-2">
            {isFull ? 'This class is full' : `${capacity - enrolled} spot${capacity - enrolled !== 1 ? 's' : ''} remaining`}
          </p>
        </div>

        {/* Quick actions */}
        {isAdmin && (
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={`/dashboard/attendance/register/${group.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#141414] border border-[#1e1e1e] hover:bg-[#1a1a1a] transition-colors"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Register
            </Link>
            <Link
              href={`/dashboard/attendance/qr/${group.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#141414] border border-[#1e1e1e] hover:bg-[#1a1a1a] transition-colors"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm-11 11h7v7H3v-7zm14 3.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 0v3.5m0-10V7" />
              </svg>
              QR Check-in
            </Link>
            <Link
              href={`/dashboard/groups/${group.id}/plans`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#141414] border border-[#1e1e1e] hover:bg-[#1a1a1a] transition-colors"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Session Plans
            </Link>
          </div>
        )}

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent" />

        {/* Enrolled players */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">
            Enrolled Players
            <span className="ml-2 text-sm font-normal text-white/50">({enrolled})</span>
          </h2>

          {players.length === 0 ? (
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-8 text-center">
              <div className="text-3xl mb-2">👥</div>
              <p className="text-sm text-white/50">No players enrolled in this class yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {players.map((player) => (
                <Link
                  key={player.id}
                  href={`/dashboard/players/${player.id}`}
                  className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 flex items-center gap-3 hover:bg-[#1a1a1a] hover:border-[#4ecde6]/30 transition-all group"
                >
                  {player.photo_url ? (
                    <img
                      src={player.photo_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover border border-[#1e1e1e]"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-xs font-bold text-[#4ecde6]">
                      {player.first_name?.[0]}{player.last_name?.[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate group-hover:text-[#4ecde6] transition-colors">
                      {player.first_name} {player.last_name}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-white/20 ml-auto shrink-0 group-hover:text-[#4ecde6]/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
