import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LeadsPipeline from './LeadsPipeline'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('organisation_id', orgId)
    .in('role', ['admin', 'coach'])
    .order('full_name')

  const { data: trainingGroups } = await supabase
    .from('training_groups')
    .select('id, name')
    .order('name')

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
      <LeadsPipeline
        leads={leads || []}
        teamMembers={teamMembers || []}
        trainingGroups={trainingGroups || []}
        orgId={orgId || ''}
      />
    </div>
  )
}
