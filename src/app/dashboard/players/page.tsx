import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/EmptyState'
import QuickAddPlayer from './QuickAddPlayer'
import PlayerAvatar from '@/components/PlayerAvatar'

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>
}) {
  const params = await searchParams
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

  const { data: players } = await supabase
    .from('players')
    .select(`
      *,
      parent:profiles!players_parent_id_fkey(full_name, email, phone),
      enrolments(status, group:training_groups(name))
    `)
    .order('first_name')

  const { data: parents } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'parent')
    .order('full_name')

  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name')
    .order('name')

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Players</h1>

      <div className="flex items-center gap-3">
        <QuickAddPlayer
          parents={parents || []}
          groups={groups || []}
          autoOpen={params.add === '1'}
          orgId={orgId}
        />
        <Link
          href="/dashboard/players/import"
          className="inline-flex items-center gap-2 px-4 py-2 border border-white/[0.08] rounded-lg text-sm font-medium hover:bg-white/[0.05] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3-3m0 0l3 3m-3-3v12" />
          </svg>
          Import Players
        </Link>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent" />

      {(players || []).length === 0 ? (
        <EmptyState message="No players registered yet. Add one above." />
      ) : (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-2 font-medium">Player</th>
                  <th className="text-left py-2 font-medium">Position</th>
                  <th className="text-left py-2 font-medium">Age Group</th>
                  <th className="text-left py-2 font-medium">Parent</th>
                  <th className="text-left py-2 font-medium hidden md:table-cell">Contact</th>
                  <th className="text-left py-2 font-medium">Groups</th>
                </tr>
              </thead>
              <tbody>
                {(players || []).map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.08] last:border-0 hover:bg-white/[0.03] cursor-pointer">
                    <td className="py-2.5 font-medium">
                      <Link href={`/dashboard/players/${p.id}`} className="flex items-center gap-2 text-[#4ecde6] hover:underline">
                        <PlayerAvatar photoUrl={p.photo_url} firstName={p.first_name} lastName={p.last_name} size="sm" />
                        {p.first_name} {p.last_name}
                        {p.playing_level && (() => {
                          const levelColors: Record<string, string> = { beginner: 'bg-green-500/15 text-green-400', development: 'bg-blue-500/15 text-blue-400', intermediate: 'bg-amber-500/15 text-amber-400', advanced: 'bg-purple-500/15 text-purple-400', elite: 'bg-red-500/15 text-red-400' }
                          const levelLabels: Record<string, string> = { beginner: 'Beginner', development: 'Development', intermediate: 'Intermediate', advanced: 'Advanced', elite: 'Elite' }
                          return <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${levelColors[p.playing_level] || 'bg-white/10 text-white'}`}>{levelLabels[p.playing_level] || p.playing_level}</span>
                        })()}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      {p.position
                        ? <span className="px-2 py-0.5 rounded-full text-xs bg-[#4ecde6]/10 text-[#4ecde6]">{p.position}</span>
                        : '—'}
                    </td>
                    <td className="py-2.5">
                      {p.age_group
                        ? <span className="px-2 py-0.5 rounded-full text-xs bg-[#4ecde6]/10 text-[#4ecde6]">{p.age_group}</span>
                        : '—'}
                    </td>
                    <td className="py-2.5">
                      {(p.parent as unknown as { full_name: string })?.full_name || '—'}
                    </td>
                    <td className="py-2.5 hidden md:table-cell">
                      <div className="text-white/60">{(p.parent as unknown as { email: string })?.email}</div>
                      {(p.parent as unknown as { phone: string })?.phone && (
                        <div className="text-white/60">{(p.parent as unknown as { phone: string }).phone}</div>
                      )}
                    </td>
                    <td className="py-2.5">
                      {(p.enrolments as unknown as Array<{
                        status: string
                        group: { name: string } | null
                      }>)
                        ?.filter((e) => e.status === 'active')
                        .map((e) => e.group?.name)
                        .join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
