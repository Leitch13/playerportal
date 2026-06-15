import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import CampForm from './CampForm'
import CampActions from './CampActions'
// Camps Safe Edit — Phase 1A. Flag gates the Edit entry point; OFF ⇒ page
// renders identically to the create-only original (no extra reads, no Edit item).
import { CAMP_EDIT_ENABLED, CAMP_STRUCTURAL_EDIT_ENABLED } from '@/lib/camps-edit'

type Camp = {
  id: string
  organisation_id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  daily_start_time: string | null
  daily_end_time: string | null
  location: string | null
  age_group: string | null
  price: number | null
  max_capacity: number | null
  image_url: string | null
  what_to_bring: string | null
  schedule: unknown
  is_published: boolean
  created_at: string
  early_bird_price: number | null
  early_bird_deadline: string | null
  sibling_discount_enabled: boolean
  sibling_discount_percent: number | null
  collect_medical_info: boolean
  require_consent: boolean
  training_group_id: string | null
}

type CampBooking = {
  camp_id: string
  amount_paid: number | null
  payment_status: string
}

function getCampStatus(camp: Camp, bookingCount: number): string {
  const today = new Date().toISOString().split('T')[0]
  if (camp.end_date < today) return 'past'
  if (!camp.is_published) return 'draft'
  if (camp.max_capacity && bookingCount >= camp.max_capacity) return 'full'
  if (camp.start_date <= today && camp.end_date >= today) return 'ongoing'
  return 'upcoming'
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'past': return 'bg-white/10 text-white/50'
    case 'draft': return 'bg-amber-500/20 text-amber-400'
    case 'full': return 'bg-red-500/20 text-red-400'
    case 'ongoing': return 'bg-green-500/20 text-green-400'
    case 'upcoming': return 'bg-blue-500/20 text-blue-400'
    default: return 'bg-white/10 text-white/50'
  }
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
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
              {allCamps.filter((c) => {
                const today = new Date().toISOString().split('T')[0]
                return c.is_published && c.end_date >= today
              }).length}
            </div>
          </div>
        </div>
      )}

      <Card
        title="All Camps"
        action={
          <CampForm
            orgId={orgId}
            orgSlug={orgSlug}
            trainingGroups={trainingGroups}
            existingCamps={allCamps as unknown as Parameters<typeof CampForm>[0]['existingCamps']}
          />
        }
      >
        {allCamps.length === 0 ? (
          <EmptyState message="No camps created yet. Click 'Create Camp' to get started." />
        ) : (
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm">
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
              <tbody>
                {allCamps.map((camp) => {
                  const stats = campStats[camp.id] || { bookingCount: 0, paidCount: 0, revenue: 0 }
                  const status = getCampStatus(camp, stats.bookingCount)
                  const capacityPct = camp.max_capacity
                    ? Math.min(100, Math.round((stats.bookingCount / camp.max_capacity) * 100))
                    : 0

                  return (
                    <tr key={camp.id} className="border-b border-white/[0.08] last:border-0 hover:bg-white/[0.03]">
                      <td className="px-6 py-4">
                        {/* Sprint 9: name links to the camp roster page */}
                        <Link
                          href={`/dashboard/camps/${camp.id}`}
                          className="font-medium text-white hover:text-[#4ecde6] transition-colors"
                        >
                          {camp.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          {camp.location && (
                            <span className="text-xs text-white/40">{camp.location}</span>
                          )}
                          {camp.age_group && (
                            <span className="text-xs text-white/30">{camp.age_group}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-white/60 text-xs">
                        {formatDateRange(camp.start_date, camp.end_date)}
                      </td>
                      <td className="px-6 py-4 text-white/60">
                        {camp.price != null ? `\u00A3${Number(camp.price).toFixed(0)}` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{stats.bookingCount}</span>
                          {camp.max_capacity && (
                            <span className="text-white/40">/ {camp.max_capacity}</span>
                          )}
                        </div>
                        {camp.max_capacity && (
                          <div className="w-20 h-1.5 rounded-full bg-white/10 mt-1">
                            <div
                              className={`h-full rounded-full transition-all ${
                                capacityPct >= 90 ? 'bg-red-400' : capacityPct >= 60 ? 'bg-amber-400' : 'bg-green-400'
                              }`}
                              style={{ width: `${capacityPct}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {stats.revenue > 0 ? (
                          <span className="text-green-400 font-semibold">&pound;{stats.revenue.toFixed(0)}</span>
                        ) : (
                          <span className="text-white/30">&pound;0</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <CampActions
                          campId={camp.id}
                          campName={camp.name}
                          isPublished={camp.is_published}
                          orgSlug={orgSlug}
                          editEnabled={CAMP_EDIT_ENABLED}
                          camp={CAMP_EDIT_ENABLED ? {
                            id: camp.id,
                            name: camp.name,
                            description: camp.description,
                            start_date: camp.start_date,
                            end_date: camp.end_date,
                            daily_start_time: camp.daily_start_time,
                            daily_end_time: camp.daily_end_time,
                            location: camp.location,
                            age_group: camp.age_group,
                            price: camp.price,
                            max_capacity: camp.max_capacity,
                            image_url: camp.image_url,
                            what_to_bring: camp.what_to_bring,
                            is_published: camp.is_published,
                            early_bird_price: camp.early_bird_price,
                            sibling_discount_enabled: camp.sibling_discount_enabled,
                            sibling_discount_percent: camp.sibling_discount_percent,
                            training_group_id: camp.training_group_id,
                            schedule: Array.isArray(camp.schedule)
                              ? (camp.schedule as { day: string; date: string; activities: string[] }[])
                              : [],
                          } : undefined}
                          bookedCount={CAMP_EDIT_ENABLED ? stats.bookingCount : undefined}
                          trainingGroups={CAMP_EDIT_ENABLED ? trainingGroups : undefined}
                          structuralEnabled={CAMP_EDIT_ENABLED && CAMP_STRUCTURAL_EDIT_ENABLED}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
