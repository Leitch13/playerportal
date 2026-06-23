import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import FunnelDashboard from './FunnelDashboard'
import ConversionBySource from './ConversionBySource'

// Phase 2.7 placement fix — ConversionMetrics moved up to /dashboard/trials
// so headline numbers live in exactly one place. This page keeps the deeper
// FunnelDashboard visualization (stage-by-stage drop-off + Nudge action).

export default async function TrialFunnelPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  const { data: trials } = await supabase
    .from('trial_bookings')
    .select('*')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  const mapped = (trials || []).map((t) => ({
    id: t.id,
    parentName: t.parent_name,
    parentEmail: t.parent_email,
    childName: t.child_name,
    status: t.status,
    preferredDate: t.preferred_date,
    createdAt: t.created_at,
    reminder48h: t.reminder_48h_sent ?? false,
    reminder24h: t.reminder_24h_sent ?? false,
    reminder2h: t.reminder_2h_sent ?? false,
    followupSent: t.followup_sent ?? false,
    conversionOfferSent: t.conversion_offer_sent ?? false,
    converted: t.converted ?? false,
    discountCode: t.discount_code ?? null,
  }))

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/trials"
              className="text-white/40 hover:text-white text-sm transition-colors"
            >
              Trials
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-sm text-white/60">Funnel</span>
          </div>
          <h1 className="text-2xl font-bold">Conversion Funnel</h1>
          <p className="text-white/60 text-sm mt-1">
            Track trial bookings from first contact to enrolment
          </p>
        </div>
        <Link
          href="/dashboard/trials"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#141414] border border-[#1e1e1e] text-white/60 hover:text-white transition-colors"
        >
          Back to Trials
        </Link>
      </div>

      <FunnelDashboard trials={mapped} />

      {/* Trial Conversion 1A — Phase 5: source-segmented conversion view.
          Re-uses the already-loaded `trials` rows; zero new fetches. */}
      <ConversionBySource
        trials={(trials || []).map((t) => ({
          status: t.status as string,
          converted: (t.converted as boolean) ?? false,
          trial_source: (t.trial_source as string | null) ?? null,
          source_detail: (t.source_detail as string | null) ?? null,
        }))}
      />
    </div>
  )
}
