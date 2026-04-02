import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatementClient from './StatementClient'

export default async function StatementPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/signin')

  // Only parents can view their statement
  if (profile.role !== 'parent') redirect('/dashboard/payments')

  // Load all payments for this parent
  const { data: payments } = await supabase
    .from('payments')
    .select('*, player:players(first_name, last_name)')
    .eq('parent_id', user.id)
    .order('due_date', { ascending: true })

  // Load organisation details
  const { data: org } = profile.organisation_id
    ? await supabase
        .from('organisations')
        .select('name, logo_url, slug, email, phone, address')
        .eq('id', profile.organisation_id)
        .single()
    : { data: null }

  const formattedPayments = (payments || []).map((p) => {
    const player = p.player as unknown as { first_name: string; last_name: string } | null
    return {
      id: p.id as string,
      description: (p.description as string) || null,
      amount: Number(p.amount),
      amount_paid: Number(p.amount_paid || 0),
      status: p.status as string,
      due_date: (p.due_date as string) || null,
      paid_date: (p.paid_date as string) || null,
      created_at: p.created_at as string,
      player_name: player ? `${player.first_name} ${player.last_name}` : null,
    }
  })

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen">
      <StatementClient
        payments={formattedPayments}
        parentName={profile.full_name || 'Parent'}
        parentEmail={profile.email || user.email || ''}
        orgName={org?.name || 'Academy'}
        orgLogoUrl={org?.logo_url || null}
        orgEmail={((org as Record<string, unknown>)?.email as string) || null}
        orgPhone={((org as Record<string, unknown>)?.phone as string) || null}
        orgAddress={((org as Record<string, unknown>)?.address as string) || null}
      />
    </div>
  )
}
