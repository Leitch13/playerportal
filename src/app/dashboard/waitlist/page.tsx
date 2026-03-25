import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WaitlistManager from './WaitlistManager'

export default async function WaitlistPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  const { data: entries } = await supabase
    .from('waitlist')
    .select(`
      id, position, status, created_at, offered_at, expires_at,
      player:players(id, full_name, first_name, last_name),
      parent:profiles!waitlist_parent_id_fkey(full_name, email),
      group:training_groups!waitlist_training_group_id_fkey(id, name)
    `)
    .eq('organisation_id', orgId)
    .in('status', ['waiting', 'offered', 'expired'])
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Waitlist</h1>
        <p className="text-text-light text-sm mt-1">Manage players waiting for spots in full classes</p>
      </div>

      {grouped.size === 0 && (
        <div className="bg-white rounded-2xl border border-border p-12 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-semibold">No one on the waitlist</p>
          <p className="text-sm text-text-light mt-1">All classes have available spots</p>
        </div>
      )}

      {Array.from(grouped.values()).map((group) => (
        <div key={group.groupId} className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-surface/30">
            <h2 className="font-bold">{group.groupName}</h2>
            <p className="text-xs text-text-light">{group.entries!.length} waiting</p>
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
