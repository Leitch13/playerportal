import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import TrialManager from './TrialManager'
// Phase 2.7 placement fix — promote ConversionMetrics from /funnel up to
// /dashboard/trials so the conversion numbers live in exactly one place,
// alongside the trial list academy owners already use. The /funnel
// sub-page keeps the deeper FunnelDashboard visualization.
import ConversionMetrics from './funnel/ConversionMetrics'
import { loadTrialConversionData } from '@/lib/trial-conversion-loader'
import { loadTrialFollowUpRows } from '@/lib/trial-followups-loader'

export default async function TrialsPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  // Sprint 6 — fetch academy name for WhatsApp template personalisation.
  const { data: orgRow } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', orgId)
    .single()
  const academyName = (orgRow?.name as string | undefined) || 'the academy'

  // Phase 2.7 placement fix — load the existing trial-bookings list plus the
  // conversion metrics + Pending Follow-Up cohort in parallel. Both
  // ancillary loaders swallow their own errors (return zeroed counts /
  // empty array) so a Postgrest hiccup never blocks the trial list.
  const [{ data: trials }, conversion, followUpRows] = await Promise.all([
    supabase
      .from('trial_bookings')
      .select('*, group:training_groups(name)')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false }),
    loadTrialConversionData(supabase, orgId).catch(() => ({
      counts: { booked: 0, attended: 0, converted: 0, lost: 0, pending: 0 },
      daysToConvertSamples: [],
    })),
    loadTrialFollowUpRows(supabase, orgId).catch(() => []),
  ])

  const allTrials = trials || []
  const stats = {
    pending: allTrials.filter(t => t.status === 'pending').length,
    confirmed: allTrials.filter(t => t.status === 'confirmed').length,
    attended: allTrials.filter(t => t.status === 'attended').length,
    total: allTrials.length,
    converted: allTrials.filter(t => t.converted).length,
    conversionRate: allTrials.filter(t => t.status === 'attended').length > 0
      ? Math.round(
          (allTrials.filter(t => t.converted).length /
            allTrials.filter(t => t.status === 'attended').length) *
            100
        )
      : 0,
  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trial Bookings</h1>
          <p className="text-white/60 text-sm mt-1">Manage free trial requests from new families</p>
        </div>
        <Link
          href="/dashboard/trials/funnel"
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#4ecde6]/10 text-[#4ecde6] hover:bg-[#4ecde6]/20 border border-[#4ecde6]/20 transition-colors"
        >
          View Funnel
        </Link>
      </div>

      {/* Phase 2.7 placement fix — ConversionMetrics promoted here from
          /dashboard/trials/funnel. Lives in exactly one place so the
          numbers don't drift; /funnel still hosts the deeper
          FunnelDashboard visualization. */}
      <ConversionMetrics
        counts={conversion.counts}
        daysToConvertSamples={conversion.daysToConvertSamples}
        pendingFollowUpCount={followUpRows.length}
      />

      {/* Legacy 5-tile Stats row — kept for the Pending / Confirmed
          breakdown which ConversionMetrics doesn't surface (it bundles
          them as "pending"). Both reads come from the same query, no
          drift risk. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4 text-center">
          <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
          <p className="text-xs text-white/60 font-medium">Pending</p>
        </div>
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4 text-center">
          <p className="text-2xl font-bold text-blue-500">{stats.confirmed}</p>
          <p className="text-xs text-white/60 font-medium">Confirmed</p>
        </div>
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4 text-center">
          <p className="text-2xl font-bold text-emerald-500">{stats.attended}</p>
          <p className="text-xs text-white/60 font-medium">Attended</p>
        </div>
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-white/60 font-medium">Total</p>
        </div>
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4 text-center">
          <p className="text-2xl font-bold text-[#4ecde6]">{stats.conversionRate}%</p>
          <p className="text-xs text-white/60 font-medium">Conversion</p>
        </div>
      </div>

      <TrialManager academyName={academyName} trials={allTrials.map(t => ({
        id: t.id,
        parentName: t.parent_name,
        parentEmail: t.parent_email,
        parentPhone: t.parent_phone,
        childName: t.child_name,
        childAge: t.child_age,
        groupName: (t.group as unknown as { name: string } | null)?.name || null,
        preferredDate: t.preferred_date,
        notes: t.notes,
        status: t.status,
        createdAt: t.created_at,
        // Phase 2.4 — exposes `updated_at` so the client can derive
        // stale_followup (>7d since the follow-up was marked sent).
        updatedAt: t.updated_at ?? null,
        reminder48h: t.reminder_48h_sent ?? false,
        reminder24h: t.reminder_24h_sent ?? false,
        reminder2h: t.reminder_2h_sent ?? false,
        followupSent: t.followup_sent ?? false,
        converted: t.converted ?? false,
      }))} />
    </div>
  )
}
