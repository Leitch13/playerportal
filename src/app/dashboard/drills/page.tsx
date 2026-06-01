import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import type { UserRole } from '@/lib/types'
import DrillsLibrary from './DrillsLibrary'

export default async function DrillsPage() {
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

  // CRITICAL: org-scoped. Super-admins bypass RLS — without this filter the
  // drills library leaks every academy's drill IP into a single view.
  const { data: drills } = await supabase
    .from('drills')
    .select('*')
    .eq('organisation_id', orgId)
    .order('name')

  return (
    <DrillsLibrary
      drills={drills || []}
      orgId={orgId}
      userId={user.id}
    />
  )
}
