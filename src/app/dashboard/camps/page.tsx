import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import CampForm from './CampForm'
import CampRow, { type Camp } from './CampRow'
// Camps Safe Edit — Phase 1A. Flag gates the Edit entry point; OFF ⇒ page
// renders identically to the create-only original (no extra reads, no Edit item).
import { CAMP_EDIT_ENABLED, CAMP_STRUCTURAL_EDIT_ENABLED } from '@/lib/camps-edit'
// Flexible Camps — Phase 1. Flag gates the booking-mode picker inside
// CampForm. OFF ⇒ CampForm renders and saves identically to the whole-camp
// original (no mode toggle, no flex fields, no camp_days rows written).
//
// Global Rollout hotfix — the publish-permission decision reads
// FLEXIBLE_CAMPS_ALLOW_ALL / the allowlist from process.env, which only
// exist server-side. This page (a server component) evaluates it once
// and passes `flexiblePublishAllowed` down; the client components never
// read the env vars themselves.
import {
  BOOKING_MODE_FLEXIBLE_DAYS,
  FLEXIBLE_CAMPS_ENABLED,
  isFlexibleModePublishBlocked,
} from '@/lib/flexible-camps'

type CampBooking = {
  camp_id: string
  amount_paid: number | null
  payment_status: string
}

export default async function CampsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('camps')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'coach'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const orgId = profile.organisation_id || ''

  // Get org slug for share links
  const { data: org } = await supabase
    .from('organisations')
    .select('slug')
    .eq('id', orgId)
    .single()

  const orgSlug = org?.slug || ''

  const { data: camps } = await supabase
    .from('camps')
    .select('*')
    .eq('organisation_id', orgId)
    .order('start_date', { ascending: false })

  const allCamps = (camps || []) as Camp[]

  // Get all bookings for these camps
  const campIds = allCamps.map((c) => c.id)
  let allBookings: CampBooking[] = []
  if (campIds.length > 0) {
    const { data: bookings } = await supabase
      .from('camp_bookings')
      .select('camp_id, amount_paid, payment_status')
      .in('camp_id', campIds)

    allBookings = (bookings || []) as CampBooking[]
  }

  // Build booking stats per camp
  const campStats: Record<string, { bookingCount: number; paidCount: number; revenue: number }> = {}
  for (const camp of allCamps) {
    const campBookings = allBookings.filter((b) => b.camp_id === camp.id)
    const paidBookings = campBookings.filter((b) => b.payment_status === 'paid')
    campStats[camp.id] = {
      bookingCount: campBookings.filter((b) => ['pending', 'paid'].includes(b.payment_status)).length,
      paidCount: paidBookings.length,
      revenue: paidBookings.reduce((sum, b) => sum + Number(b.amount_paid || 0), 0),
    }
  }

  // Total revenue across all camps
  const totalRevenue = Object.values(campStats).reduce((sum, s) => sum + s.revenue, 0)
  const totalBookings = Object.values(campStats).reduce((sum, s) => sum + s.paidCount, 0)

  // Get training groups for the form
  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name')
    .eq('organisation_id', orgId)
    .order('name')

  const trainingGroups = (groups || []) as { id: string; name: string }[]

  // Global Rollout hotfix — evaluate the flexible-publish permission HERE,
  // server-side, where FLEXIBLE_CAMPS_ALLOW_ALL and the allowlist actually
  // exist. "Would a flexible-days camp belonging to this org be allowed to
  // publish?" All camps on this page belong to orgId, so one boolean covers
  // every row. Client components receive it as a prop and never consult
  // process.env themselves.
  const flexiblePublishAllowed = !isFlexibleModePublishBlocked(
    BOOKING_MODE_FLEXIBLE_DAYS,
    orgId,
  )

  // "Archive after the date": a camp is Past the day its end_date passes.
  // Derived from end_date — not stored — so it self-updates with no cron and
  // no data change. Active camps stay in the main table; past ones drop into a
  // collapsed section below. (The public booking page already hides past camps.)
  const todayStr = new Date().toISOString().split('T')[0]
  const activeCamps = allCamps.filter((c) => c.end_date >= todayStr)
  const pastCamps = allCamps.filter((c) => c.end_date < todayStr)

  const tableHead = (
    <thead>
      <tr className="border-b border-white/[0.08] text-left text-white/60">
        <th className="px-6 py-3 font-medium">Camp</th>
        <th className="px-6 py-3 font-medium">Dates</th>
        <th className="px-6 py-3 font-medium">Price</th>
        <th className="px-6 py-3 font-medium">Bookings</th>
        <th className="px-6 py-3 font-medium">Revenue</th>
        <th className="px-6 py-3 font-medium">Status</th>
        <th className="px-6 py-3 font-medium">Actions</th>
      </tr>
    </thead>
  )

  const rowFor = (camp: Camp) => (
    <CampRow
      key={camp.id}
      camp={camp}
      stats={campStats[camp.id] || { bookingCount: 0, paidCount: 0, revenue: 0 }}
      orgSlug={orgSlug}
      editEnabled={CAMP_EDIT_ENABLED}
      structuralEnabled={CAMP_STRUCTURAL_EDIT_ENABLED}
      trainingGroups={trainingGroups}
      flexiblePublishAllowed={flexiblePublishAllowed}
    />
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Camps</h1>
          <p className="text-sm text-white/60 mt-1">
            Manage holiday camps and multi-day sessions
          </p>
        </div>
      </div>

      {/* Revenue summary cards */}
      {allCamps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/[0.08] bg-[#141414] p-5">
            <div className="text-xs text-white/40 uppercase tracking-wider">Total Camp Revenue</div>
            <div className="text-2xl font-bold text-green-400 mt-1">&pound;{totalRevenue.toFixed(0)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#141414] p-5">
            <div className="text-xs text-white/40 uppercase tracking-wider">Total Bookings</div>
            <div className="text-2xl font-bold text-white mt-1">{totalBookings}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#141414] p-5">
            <div className="text-xs text-white/40 uppercase tracking-wider">Active Camps</div>
            <div className="text-2xl font-bold text-accent mt-1">
              {allCamps.filter((c) => c.is_published && c.end_date >= todayStr).length}
            </div>
          </div>
        </div>
      )}

      <Card
        title="Camps"
        action={
          <CampForm
            orgId={orgId}
            orgSlug={orgSlug}
            trainingGroups={trainingGroups}
            existingCamps={allCamps as unknown as Parameters<typeof CampForm>[0]['existingCamps']}
            flexibleCampsEnabled={FLEXIBLE_CAMPS_ENABLED}
            flexiblePublishAllowed={flexiblePublishAllowed}
          />
        }
      >
        {allCamps.length === 0 ? (
          <EmptyState message="No camps created yet. Click 'Create Camp' to get started." />
        ) : (
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm">
              {tableHead}
              <tbody>
                {activeCamps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-6 text-center text-white/40 text-sm">
                      No active camps. See Past camps below.
                    </td>
                  </tr>
                ) : (
                  activeCamps.map(rowFor)
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Archived: camps whose end_date has passed. Collapsed by default via a
          native <details> (no client JS). Records are untouched — this is
          purely a view; "archived" is derived from end_date. */}
      {pastCamps.length > 0 && (
        <details className="rounded-xl border border-white/[0.08] bg-[#141414] overflow-hidden">
          <summary className="cursor-pointer select-none px-6 py-4 text-sm font-medium text-white/70 hover:text-white flex items-center gap-2">
            Past camps
            <span className="text-xs text-white/40">({pastCamps.length})</span>
          </summary>
          <div className="overflow-x-auto border-t border-white/[0.08]">
            <table className="w-full text-sm">
              {tableHead}
              <tbody>
                {pastCamps.map(rowFor)}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
