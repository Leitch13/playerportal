import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MigrateMemberForm from './MigrateMemberForm'

export const metadata = { title: 'Migrate a member | Player Portal' }

/**
 * Admin tool: generate a signup link for an existing member who has already
 * prepaid the academy elsewhere. The link carries ?billedFrom=<date> so the
 * parent enters their card now (£0 today) and the first charge lands on the
 * date their existing payment runs out — no double-charge, no gap.
 */
export default async function MigrateMemberPage() {
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

  const [{ data: org }, { data: groups }, { data: plans }] = await Promise.all([
    supabase.from('organisations').select('slug, name').eq('id', profile.organisation_id).single(),
    supabase
      .from('training_groups')
      .select('id, name, day_of_week, time_slot')
      .eq('organisation_id', profile.organisation_id)
      .order('name'),
    supabase
      .from('subscription_plans')
      .select('id, name, amount')
      .eq('organisation_id', profile.organisation_id)
      .eq('active', true)
      .order('amount'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">Migrate a member</h1>
        <p className="text-sm text-white/50 mt-1">
          For a parent who&apos;s already paid you for the upcoming period. They get access now and
          aren&apos;t charged again until the date you set.
        </p>
      </div>
      <MigrateMemberForm
        slug={(org?.slug as string) || ''}
        groups={(groups || []).map((g) => ({
          id: g.id as string,
          name: g.name as string,
          day: (g.day_of_week as string | null) || null,
          time: (g.time_slot as string | null) || null,
        }))}
        plans={(plans || []).map((p) => ({
          id: p.id as string,
          name: p.name as string,
          amount: Number(p.amount),
        }))}
      />
    </div>
  )
}
