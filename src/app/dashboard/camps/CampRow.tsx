import Link from 'next/link'
import CampActions from './CampActions'

// Row for the admin camps table, extracted so the same markup renders in both
// the active list and the collapsed "Past camps" (archived) section. Pure
// presentation — no data reads or writes. "Archived" is derived from end_date
// by the parent page; this component is unaware of it and renders any camp.

export type Camp = {
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
  booking_mode: string | null
  flex_price_per_day: number | null
}

export type CampStats = { bookingCount: number; paidCount: number; revenue: number }

export function getCampStatus(camp: Camp, bookingCount: number): string {
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

type Props = {
  camp: Camp
  stats: CampStats
  orgSlug: string
  editEnabled: boolean
  structuralEnabled: boolean
  trainingGroups: { id: string; name: string }[]
  flexiblePublishAllowed: boolean
}

export default function CampRow({ camp, stats, orgSlug, editEnabled, structuralEnabled, trainingGroups, flexiblePublishAllowed }: Props) {
  const status = getCampStatus(camp, stats.bookingCount)
  const capacityPct = camp.max_capacity
    ? Math.min(100, Math.round((stats.bookingCount / camp.max_capacity) * 100))
    : 0

  return (
    <tr className="border-b border-white/[0.08] last:border-0 hover:bg-white/[0.03]">
      <td className="px-6 py-4">
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
          {camp.booking_mode === 'flexible_days' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#4ecde6]/15 text-[#4ecde6]">
              Flexible
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-white/60 text-xs">
        {formatDateRange(camp.start_date, camp.end_date)}
      </td>
      <td className="px-6 py-4 text-white/60">
        {camp.booking_mode === 'flexible_days' ? (
          camp.flex_price_per_day != null
            ? `£${Number(camp.flex_price_per_day).toFixed(0)}/day`
            : '-'
        ) : camp.price != null ? `£${Number(camp.price).toFixed(0)}` : '-'}
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
          editEnabled={editEnabled}
          camp={editEnabled ? {
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
            booking_mode: camp.booking_mode,
            organisation_id: camp.organisation_id,
          } : undefined}
          bookedCount={editEnabled ? stats.bookingCount : undefined}
          trainingGroups={editEnabled ? trainingGroups : undefined}
          structuralEnabled={editEnabled && structuralEnabled}
          bookingMode={camp.booking_mode}
          organisationId={camp.organisation_id}
          flexiblePublishAllowed={flexiblePublishAllowed}
        />
      </td>
    </tr>
  )
}
