import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  const { data: org } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', orgId)
    .single()

  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .eq('organisation_id', orgId)
    .order('role')

  // Usage stats
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('organisation_id', orgId)

  const { count: coachCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('organisation_id', orgId)
    .eq('role', 'coach')

  const { count: classCount } = await supabase
    .from('training_groups')
    .select('*', { count: 'exact', head: true })
    .eq('organisation_id', orgId)

  return (
    <SettingsForm
      org={org ? {
        id: org.id,
        name: org.name || '',
        slug: org.slug || '',
        description: org.description || '',
        contact_email: org.contact_email || '',
        contact_phone: org.contact_phone || '',
        location: org.location || '',
        primary_color: org.primary_color || '#4ecde6',
        logo_url: org.logo_url || '',
        hero_image_url: org.hero_image_url || '',
      } : null}
      team={(teamMembers || []).map(m => ({
        id: m.id,
        name: m.full_name || '',
        email: m.email || '',
        role: m.role || 'parent',
        joinedAt: m.created_at,
      }))}
      usage={{
        players: playerCount || 0,
        coaches: coachCount || 0,
        classes: classCount || 0,
      }}
    />
  )
}
