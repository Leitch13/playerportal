import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import WaitlistManager from './WaitlistManager'

// WAITLIST_SCHEMA_FIX_ENABLED — see /api/waitlist/accept/route.ts.
const SCHEMA_FIX_ON = process.env.WAITLIST_SCHEMA_FIX_ENABLED === 'true'
const ENTRIES_SELECT = SCHEMA_FIX_ON
  ? `id, position, status, created_at, offered_at, expires_at,
     player:players(id, full_name, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_group_id_fkey(id, name)`
  : `id, position, status, created_at, offered_at, expires_at,
     player:players(id, full_name, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_training_group_id_fkey(id, name)`

export default async function WaitlistPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) redirect('/dashboard')
  await requireFeature('waitlists')

  const { data: orgId } = await supabase.rpc('get_my_org')

  const { data: entries } = await supabase
    .from('waitlist')
    .select(ENTRIES_SELECT)
    .eq('organisation_id', orgId)
    .in('status', ['waiting', 'offered', 'accepted', 'declined', 'expired'])
    .order('position')

  // Group by class
  const grouped = new Map<string, { groupName: string; groupId: string; entries: typeof entries }>()
  for (const entry of entries || []) {
    const g = entry.group as unknown as { id: string; name: string } | null
    if (!g) continue
    if (!grouped.has(g.id)) {
      grouped.set(g.id, { groupName: g.name, groupId: g.id, entries: [] })
    }
    grouped.get(g.id)!.entries!.push(entry)
  }

  // Count active (waiting + offered) per group for the subtitle
  const activeCount = (items: typeof entries) =>
    (items || []).filter((e) => e.status === 'waiting' || e.status === 'offered').length

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Waitlist</h1>
        <p className="text-white/60 text-sm mt-1">Manage players waiting for spots in full classes. When a spot opens, the next person is automatically offered the place.</p>
      </div>

      {/* Auto-promote info banner */}
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#4ecde6]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[#4ecde6] text-sm">&#9889;</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white/90">Auto-promote is active</p>
          <p className="text-xs text-white/50 mt-0.5">When an enrolment is cancelled, the next person on the waitlist is automatically offered the spot with a 48-hour deadline. Expired offers cascade to the next person.</p>
        </div>
      </div>

      {grouped.size === 0 && (
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-12 text-center">
          <p className="text-4xl mb-3">&#127881;</p>
          <p className="font-semibold">No one on the waitlist</p>
          <p className="text-sm text-white/60 mt-1">All classes have available spots</p>
        </div>
      )}

      {Array.from(grouped.values()).map((group) => (
        <div key={group.groupId} className="bg-[#141414] rounded-2xl border border-[#1e1e1e] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1e1e] bg-white/[0.03] flex items-center justify-between">
            <div>
              <h2 className="font-bold">{group.groupName}</h2>
              <p className="text-xs text-white/60">{activeCount(group.entries)} active &middot; {group.entries!.length} total</p>
            </div>
          </div>
          <WaitlistManager entries={(group.entries || []).map(e => {
            const player = e.player as unknown as { id: string; full_name?: string; first_name?: string; last_name?: string } | null
            const parent = e.parent as unknown as { full_name: string; email: string } | null
            return {
              id: e.id,
              position: e.position,
              status: e.status,
              created_at: e.created_at,
              offered_at: e.offered_at,
              expires_at: e.expires_at,
              playerName: player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'Unknown',
              parentName: parent?.full_name || 'Unknown',
              parentEmail: parent?.email || '',
            }
          })} groupId={group.groupId} />
        </div>
      ))}
    </div>
  )
}
