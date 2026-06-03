import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import FunnelDashboard from './FunnelDashboard'
// Phase 2.7 — server-rendered conversion metrics. Booking-side only;
// sample-size caveats baked into the derive layer.
import ConversionMetrics from './ConversionMetrics'
import { loadTrialConversionData } from '@/lib/trial-conversion-loader'
// Phase 2.7 — reuse the EXISTING Phase 2.4 follow-up loader so the
// Pending Follow-Up count stays in lockstep with the Enrolments page
// section and the Parents-list filter.
import { loadTrialFollowUpRows } from '@/lib/trial-followups-loader'

export default async function TrialFunnelPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  // Phase 2.7 — load conversion counts + pending follow-up cohort in
  // parallel with the existing trials pull. Both loaders swallow their
  // own errors so a Postgrest hiccup never breaks the page.
  const [{ data: trials }, conversion, followUpRows] = await Promise.all([
    supabase
      .from('trial_bookings')
      .select('*')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false }),
    loadTrialConversionData(supabase, orgId).catch(() => ({
      counts: { booked: 0, attended: 0, converted: 0, lost: 0, pending: 0 },
      daysToConvertSamples: [],
    })),
    loadTrialFollowUpRows(supabase, orgId).catch(() => []),
  ])

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

      {/* Phase 2.7 — server-rendered metrics block above the existing
          client-side funnel visualization. Sample-size caveats live in
          the derive layer; this component only renders.
          The EXISTING FunnelDashboard below is unchanged — it owns the
          interactive funnel + Nudge action (which sends emails; we are
          explicitly leaving that protected surface alone). */}
      <ConversionMetrics
        counts={conversion.counts}
        daysToConvertSamples={conversion.daysToConvertSamples}
        pendingFollowUpCount={followUpRows.length}
      />

      <FunnelDashboard trials={mapped} />
    </div>
  )
}
