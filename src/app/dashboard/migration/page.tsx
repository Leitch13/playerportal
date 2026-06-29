import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MigrationWizard from './MigrationWizard'

export const metadata = { title: 'Migration Wizard | Player Portal' }

export default async function MigrationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organisation_id) redirect('/dashboard')
  if (profile.role !== 'admin') redirect('/dashboard')

  const orgId = profile.organisation_id

  // Load existing groups + plans for the mapping dropdowns
  const [{ data: groups }, { data: plans }, { data: pendingSubs }] = await Promise.all([
    supabase
      .from('training_groups')
      .select('id, name, day_of_week, time_slot')
      .eq('organisation_id', orgId)
      .order('name'),
    supabase
      .from('subscription_plans')
      .select('id, name, amount, sessions_per_week')
      .eq('organisation_id', orgId)
      .eq('active', true)
      .is('training_group_id', null)
      .order('amount'),
    supabase
      .from('subscriptions')
      .select('id, status, invite_token, invite_sent_at, invite_confirmed_at, player:players(first_name, last_name), plan:subscription_plans(name, amount)')
      .eq('organisation_id', orgId)
      .eq('invite_source', 'classforkids')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  return (
    <MigrationWizard
      orgId={orgId}
      groups={(groups || []).map((g) => ({
        id: g.id,
        name: g.name,
        day: g.day_of_week,
        time: g.time_slot,
      }))}
      plans={(plans || []).map((p) => ({
        id: p.id,
        name: p.name,
        amount: Number(p.amount),
        sessionsPerWeek: p.sessions_per_week,
      }))}
      existingInvitations={(pendingSubs || []).map((s) => {
        const player = s.player as unknown as { first_name: string; last_name: string | null } | null
        const plan = s.plan as unknown as { name: string; amount: number } | null
        return {
          id: s.id,
          status: s.status,
          inviteSentAt: s.invite_sent_at,
          inviteConfirmedAt: s.invite_confirmed_at,
          childName: player ? `${player.first_name} ${player.last_name || ''}`.trim() : '—',
          planName: plan?.name || '—',
          planAmount: plan ? Number(plan.amount) : 0,
        }
      })}
    />
  )
}
