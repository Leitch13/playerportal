import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'
import SessionRunner from './SessionRunner'

export default async function RunSessionPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // Ensure user is coach or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  if (role === 'parent') redirect('/dashboard')

  // Fetch training group details
  const { data: group } = await supabase
    .from('training_groups')
    .select('id, name')
    .eq('id', groupId)
    .single()

  if (!group) redirect('/dashboard')

  // Fetch enrolled players for this group (active enrolments)
  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('player:players(id, first_name, last_name, photo_url)')
    .eq('group_id', groupId)
    .eq('status', 'active')

  const players = (enrolments || [])
    .map((e) => e.player as unknown as { id: string; first_name: string; last_name: string; photo_url: string | null })
    .filter(Boolean)
    .sort((a, b) => a.first_name.localeCompare(b.first_name))

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Run Session &mdash; {group.name}</h1>
      <SessionRunner
        groupId={group.id}
        groupName={group.name}
        sessionDate={today}
        coachId={user.id}
        players={players}
      />
    </div>
  )
}
