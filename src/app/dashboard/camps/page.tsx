import { CAMP_WAITLIST_SOURCE, waitingByCamp } from '@/lib/camp-waitlist'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import EmptyState from '@/components/EmptyState'
import CampForm from './CampForm'
import CampActions from './CampActions'
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
  // Flexible Camps (Phase 0/1). Nullable so existing rows without the
  // column (there shouldn't be any post-migration 095) still parse.
  booking_mode: string | null
  // Flexible Camps (Phase 3E). Per-day price surfaces on the camps list
  // when the camp is flexible. Nullable for whole-camp rows.
  flex_price_per_day: number | null
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

  // How many people are on each camp's waiting list (read-only; see src/lib/camp-waitlist.ts).
  const { data: waitRows } = await supabase
    .from('leads')
    .select('notes')
    .eq('organisation_id', orgId)
    .eq('source', CAMP_WAITLIST_SOURCE)
    .not('status', 'in', '(enrolled,lost)')
    .limit(1000)
  const waitingCounts = waitingByCamp((waitRows || []) as Array<{ notes: string | null }>)

  // Build booking stats per camp
  const campStats: Record<string, { bookingCount: number; paidCount: number; revenue: number; unpaidCount: number }> = {}
  for (const camp of allCamps) {
    const campBookings = allBookings.filter((b) => b.camp_id === camp.id)
    const paidBookings = campBookings.filter((b) => b.payment_status === 'paid')
    campStats[camp.id] = {
      bookingCount: campBookings.filter((b) => ['pending', 'paid'].includes(b.payment_status)).length,
      paidCount: paidBookings.length,
      revenue: paidBookings.reduce((sum, b) => sum + Number(b.amount_paid || 0), 0),
      // Booked but not paid yet: these hold a place.
      unpaidCount: campBookings.filter((b) => b.payment_status === 'pending').length,
    }
  }

  // Total revenue across all camps
  const totalRevenue = Object.values(campStats).reduce((sum, s) => sum + s.revenue, 0)
  
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

  // ── Oct 2026 — the calm, card layout. Same data and the same actions; only
  // how it is laid out changed. Camps are grouped by where they are in their
  // life: on sale or coming up, drafts, and past (folded away). ──
  const withStatus = allCamps.map((camp) => {
    const stats = campStats[camp.id] || { bookingCount: 0, paidCount: 0, revenue: 0, unpaidCount: 0 }
    return { camp, stats, status: getCampStatus(camp, stats.bookingCount) }
  })
  const live = withStatus.filter((c) => ['ongoing', 'upcoming', 'full'].includes(c.status)).sort((a, b) => a.camp.start_date.localeCompare(b.camp.start_date))
  const drafts = withStatus.filter((c) => c.status === 'draft').sort((a, b) => a.camp.start_date.localeCompare(b.camp.start_date))
  const past = withStatus.filter((c) => c.status === 'past')
  const liveBooked = live.reduce((n, c) => n + c.stats.bookingCount, 0)
  const liveUnpaid = live.reduce((n, c) => n + c.stats.unpaidCount, 0)

  const STATUS: Record<string, { label: string; cls: string }> = {
    ongoing: { label: 'Running now', cls: 'border-[#67c79a]/40 text-[#67c79a]' },
    upcoming: { label: 'On sale', cls: 'border-[#67c79a]/40 text-[#67c79a]' },
    full: { label: 'Full', cls: 'border-[#4ecde6]/40 text-[#4ecde6]' },
    draft: { label: 'Draft, not on sale', cls: 'border-[#d8a95a]/50 text-[#d8a95a]' },
    past: { label: 'Finished', cls: 'border-[#293b58] text-[#93a2ba]' },
  }
  const dayCount = (c: Camp) => Math.round((new Date(c.end_date + 'T00:00:00').getTime() - new Date(c.start_date + 'T00:00:00').getTime()) / 86_400_000) + 1
  const money = (n: number) => `\u00A3${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`

  const campCard = ({ camp, stats, status }: (typeof withStatus)[number]) => {
    const start = new Date(camp.start_date + 'T00:00:00')
    const pct = camp.max_capacity ? Math.min(100, Math.round((stats.bookingCount / camp.max_capacity) * 100)) : null
    const days = dayCount(camp)
    const priceText = camp.booking_mode === 'flexible_days'
      ? (camp.flex_price_per_day != null ? `${money(Number(camp.flex_price_per_day))} a day` : 'Price not set')
      : (camp.price != null ? money(Number(camp.price)) : 'Price not set')
    const st = STATUS[status] || STATUS.past
    return (
      <article key={camp.id} className={`overflow-hidden rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] ${status === 'past' ? 'opacity-75' : ''}`} data-testid="camp-card">
        {/* Top band: the camp photo when there is one, otherwise a quiet panel. The date sits on it. */}
        <div className="relative h-24 bg-gradient-to-br from-[#142236] to-[#0b1422]">
          {camp.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={camp.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1a2b] via-[#0f1a2b]/30 to-transparent" />
          <div className="absolute left-4 top-3 flex h-[58px] w-[54px] flex-col items-center justify-center rounded-[11px] border border-white/15 bg-[#080e18]/85 backdrop-blur-sm">
            <span className="text-[19px] font-bold leading-none text-white tabular-nums">{start.getDate()}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4ecde6]">{start.toLocaleDateString('en-GB', { month: 'short' })}</span>
          </div>
          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full border bg-[#080e18]/85 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${st.cls}`}>{st.label}</span>
            <span className="rounded-lg bg-[#080e18]/85 backdrop-blur-sm">
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
                  // Flexible Camps (Phase 1) — plumb the mode
                  // through so CampEditForm can lock publishing
                  // for flexible drafts.
                  booking_mode: camp.booking_mode,
                  flex_price_per_day: camp.flex_price_per_day,
                  // Flexible Camps (Phase 3E pilot gate) — org
                  // id is consulted against the allowlist
                  // inside the CampEditForm.
                  organisation_id: camp.organisation_id,
                } : undefined}
                bookedCount={CAMP_EDIT_ENABLED ? stats.bookingCount : undefined}
                trainingGroups={CAMP_EDIT_ENABLED ? trainingGroups : undefined}
                structuralEnabled={CAMP_EDIT_ENABLED && CAMP_STRUCTURAL_EDIT_ENABLED}
                // Flexible Camps (Phase 1) — CampActions uses this
                // to lock the row-action publish button. Passed
                // unconditionally so pre-existing flexible drafts
                // stay guarded even if the create flag is off.
                bookingMode={camp.booking_mode}
                // Flexible Camps (Phase 3E pilot gate) — org
                // id is consulted against the allowlist
                // inside the row-action publish handler.
                organisationId={camp.organisation_id}
                // Global Rollout hotfix — server-evaluated
                // publish permission (see above). Client code
                // cannot read the env vars this derives from.
                flexiblePublishAllowed={flexiblePublishAllowed}
              />
            </span>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3 sm:px-5">
          <Link href={`/dashboard/camps/${camp.id}`} className="block truncate text-[17px] font-semibold text-white transition-colors hover:text-[#4ecde6]">
            {camp.name}
          </Link>
          <p className="mt-0.5 truncate text-sm text-[#93a2ba]">
            {formatDateRange(camp.start_date, camp.end_date)} · {days} {days === 1 ? 'day' : 'days'}
            {camp.daily_start_time && camp.daily_end_time ? ` · ${camp.daily_start_time.slice(0, 5)}–${camp.daily_end_time.slice(0, 5)}` : ''}
          </p>
          {(camp.location || camp.age_group || camp.booking_mode === 'flexible_days') && (
            <p className="mt-0.5 truncate text-xs text-[#5b6c86]">
              {[camp.location, camp.age_group, camp.booking_mode === 'flexible_days' ? 'Parents pick their days' : null].filter(Boolean).join(' · ')}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[#1d2c42] pt-3.5">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">Price</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-white">{priceText}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">Booked</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-white">
                {stats.bookingCount}{camp.max_capacity ? <span className="font-normal text-[#93a2ba]"> of {camp.max_capacity}</span> : null}
                {(waitingCounts.get(camp.id) || 0) > 0 && <span className="ml-2 text-xs font-semibold text-[#d8a95a]" data-testid="camp-waiting-count">{waitingCounts.get(camp.id)} waiting</span>}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">Taken</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-white">{money(stats.revenue)}</dd>
            </div>
          </dl>
          {pct != null && (
            <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-[#1d2c42]" aria-hidden>
              <div className="h-full rounded-full bg-[#4ecde6]" style={{ width: `${pct}%` }} />
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
            <Link href={`/dashboard/camps/${camp.id}`} className="rounded-[9px] border border-[#293b58] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-[#4ecde6]">
              See who&rsquo;s booked
            </Link>
            {stats.unpaidCount > 0 && (
              <Link href={`/dashboard/camps/${camp.id}`} className="flex items-center gap-1.5 text-xs font-medium text-[#d8a95a] hover:underline">
                <span className="h-1.5 w-1.5 rounded-full bg-[#d8a95a]" aria-hidden />
                {stats.unpaidCount} not paid yet
              </Link>
            )}
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Camps</h1>
          <p className="mt-1 text-sm text-[#93a2ba] tabular-nums" data-testid="camps-headline">
            {allCamps.length === 0
              ? 'Holiday camps and one-off days.'
              : `${live.length} on sale or coming up · ${liveBooked} booked${liveUnpaid > 0 ? ` · ${liveUnpaid} not paid yet` : ''} · ${money(totalRevenue)} taken across all camps`}
          </p>
        </div>
        <CampForm
          orgId={orgId}
          orgSlug={orgSlug}
          trainingGroups={trainingGroups}
          existingCamps={allCamps as unknown as Parameters<typeof CampForm>[0]['existingCamps']}
          flexibleCampsEnabled={FLEXIBLE_CAMPS_ENABLED}
          flexiblePublishAllowed={flexiblePublishAllowed}
        />
      </div>

      {allCamps.length === 0 ? (
        <EmptyState message="No camps yet. Press Create camp to set up your first one." />
      ) : (
        <>
          {live.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">On sale and coming up · {live.length}</h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">{live.map(campCard)}</div>
            </section>
          ) : (
            <p className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] px-5 py-6 text-sm text-[#93a2ba]">No camps on sale right now.</p>
          )}

          {drafts.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">Drafts · {drafts.length}</h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">{drafts.map(campCard)}</div>
            </section>
          )}

          {past.length > 0 && (
            <details className="group" data-testid="camps-past">
              <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86] hover:text-white [&::-webkit-details-marker]:hidden">
                Past camps · {past.length} <span className="normal-case tracking-normal text-[#4ecde6] group-open:hidden">Show</span><span className="hidden normal-case tracking-normal text-[#4ecde6] group-open:inline">Hide</span>
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">{past.map(campCard)}</div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
