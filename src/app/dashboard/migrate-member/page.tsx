import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MigrateMemberForm from './MigrateMemberForm'

export const metadata = { title: 'Migrate a member | Player Portal' }

/**
 * Admin tool: generate a signup link for an existing member who has already
 * prepaid the academy elsewhere. The link carries ?billedFrom=<date> so the
 * parent enters their card now (£0 today) and the first charge lands on the
 * date their existing payment runs out — no double-charge, no gap.
 *
 * Finish-pass: clearer disambiguation from bulk Migration Wizard + a link
 * to the bulk tool for academies importing ≥ 5 families at once.
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

  const academyName = (org?.name as string | undefined) || 'your academy'

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">Migrate a member</h1>
        <p className="text-sm text-white/55 mt-1.5 leading-relaxed">
          Generate a one-click signup link for a parent who&apos;s already paid you for the
          upcoming period. They get access immediately, and Stripe schedules their first
          real charge for the date you set — no double-charge, no gap.
        </p>
      </div>

      {/* Disambiguation callout — points heavier loads at the bulk Migration Wizard */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03]">
        <span className="text-[#4ecde6] text-base shrink-0 mt-0.5" aria-hidden>👥</span>
        <div className="flex-1 text-xs sm:text-sm text-white/65 leading-relaxed">
          <strong className="text-white">For one family at a time.</strong> Migrating five or
          more parents at once? Use the{' '}
          <Link
            href="/dashboard/migration"
            className="text-[#4ecde6] hover:text-[#7dddf0] font-semibold underline-offset-2 hover:underline transition-colors"
          >
            bulk Migration Wizard
          </Link>{' '}
          — it handles CSV upload, cross-academy conflict detection, and batch invitations.
        </div>
      </div>

      <MigrateMemberForm
        slug={(org?.slug as string) || ''}
        academyName={academyName}
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
