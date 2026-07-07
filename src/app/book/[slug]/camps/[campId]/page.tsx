import { createClient } from '@/lib/supabase/server'
// Auth-contamination fix — public reads (org, camp) go via the
// pure-anon client so a logged-in cross-org viewer sees the academy's
// camp page identically to anon viewers. The cookie-aware client is
// kept for the parent's auth session, their viewer profile (to gate
// reuse-of-details), and their own children list.
// See src/lib/supabase/public.ts.
import { createPublicClient } from '@/lib/supabase/public'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ShareButton from './ShareButton'
import CampBookingForm from './CampBookingForm'
// Flexible Camps (Phase 2) — parent-facing day picker. Rendered instead
// of CampBookingForm when the camp is booking_mode='flexible_days' AND
// FLEXIBLE_CAMPS_ENABLED is on. Purely view-only: no Stripe, no
// checkout, no writes.
import CampFlexibleDayPicker from './CampFlexibleDayPicker'
import { BOOKING_MODE_FLEXIBLE_DAYS, FLEXIBLE_CAMPS_ENABLED } from '@/lib/flexible-camps'

type ScheduleDay = {
  day: string
  date: string
  activities: string[]
}

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
  schedule: ScheduleDay[]
  is_published: boolean
  early_bird_price: number | null
  early_bird_deadline: string | null
  sibling_discount_enabled: boolean
  sibling_discount_percent: number | null
  collect_medical_info: boolean
  require_consent: boolean
  // Flexible Camps (Phase 0/1/2). Optional so existing whole-camp rows
  // (booking_mode='whole_camp' via Phase 0 default) render exactly as
  // before — none of these are read for the whole-camp branch.
  booking_mode?: string | null
  flex_price_per_day?: number | null
  flex_min_days?: number | null
}

// Flexible Camps (Phase 2) — parent-side view of a camp_days row. Read
// via the "Public read camp_days for published camps" RLS policy on the
// anon client. NEVER written by this page.
type CampDayRow = {
  id: string
  date: string
  price: number | null
  is_available: boolean
  sort_order: number | null
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sDay = s.getDate()
  const eDay = e.getDate()
  const month = s.toLocaleDateString('en-GB', { month: 'long' })
  const year = s.getFullYear()
  if (s.getMonth() === e.getMonth()) {
    return `${sDay}-${eDay} ${month} ${year}`
  }
  const eMonth = e.toLocaleDateString('en-GB', { month: 'long' })
  return `${sDay} ${month} - ${eDay} ${eMonth} ${year}`
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function getDurationDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

const dayColors = [
  'bg-emerald-500/10 border-emerald-500/20',
  'bg-cyan-500/10 border-cyan-500/20',
  'bg-blue-500/10 border-blue-500/20',
  'bg-purple-500/10 border-purple-500/20',
  'bg-amber-500/10 border-amber-500/20',
  'bg-rose-500/10 border-rose-500/20',
  'bg-teal-500/10 border-teal-500/20',
]

const dotColors = [
  'bg-emerald-400',
  'bg-cyan-400',
  'bg-blue-400',
  'bg-purple-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-teal-400',
]

export default async function CampDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; campId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug, campId } = await params
  const sp = await searchParams
  const bookedParam = sp.booked === '1'
  const bookingIdParam = typeof sp.booking === 'string' ? sp.booking : null

  // Cookie-aware client — used ONLY for the parent's auth session,
  // their profile (to confirm they belong to this org), and their own
  // children list. Every other read goes via `publicSupabase` so the
  // page renders identically regardless of viewer.
  const supabase = await createClient()
  const publicSupabase = createPublicClient()

  const { data: org } = await publicSupabase
    .from('organisations')
    .select('*')
    .ilike('slug', slug)
    .single()

  if (!org) notFound()

  const { data: camp } = await publicSupabase
    .from('camps')
    .select('*')
    .eq('id', campId)
    .eq('is_published', true)
    .single()

  if (!camp) notFound()

  const c = camp as Camp
  // Flexible Camps (Phase 2) — when the row is a flexible-days camp we
  // hard-guard the parent page. Flexible camps are supposed to be
  // publish-locked by Phase 1's guards, so `is_published=true` on a
  // flexible row should be impossible in production. Belt-and-braces
  // for the case where a row was force-published via direct DB edit
  // for testing:
  //   - Flag OFF ⇒ notFound() so no half-implemented flow ever renders.
  //   - Flag ON  ⇒ fall through and render the day picker instead of
  //                CampBookingForm.
  const isFlexibleCamp = c.booking_mode === BOOKING_MODE_FLEXIBLE_DAYS
  if (isFlexibleCamp && !FLEXIBLE_CAMPS_ENABLED) notFound()

  // Fetch camp_days ONLY for flexible camps + only when the flag is on.
  // Whole-camp code path issues zero new queries — byte-identical read
  // pattern to today.
  let campDays: CampDayRow[] = []
  if (isFlexibleCamp && FLEXIBLE_CAMPS_ENABLED) {
    const { data: cdData } = await publicSupabase
      .from('camp_days')
      .select('id, date, price, is_available, sort_order')
      .eq('camp_id', c.id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('date', { ascending: true })
    campDays = (cdData || []) as CampDayRow[]
  }

  const primaryColor = org.primary_color || '#4ecde6'
  const days = getDurationDays(c.start_date, c.end_date)
  const schedule: ScheduleDay[] = Array.isArray(c.schedule) ? c.schedule : []

  // Get booking count for spots left
  const { count: bookingCount } = await supabase
    .from('camp_bookings')
    .select('*', { count: 'exact', head: true })
    .eq('camp_id', campId)
    .in('payment_status', ['pending', 'paid'])

  const spotsLeft = c.max_capacity ? c.max_capacity - (bookingCount || 0) : null

  // If a parent is signed in (to THIS academy), let them reuse their details +
  // pick an existing child instead of retyping everything.
  let loggedInParent: { name: string; email: string } | null = null
  let existingChildren: { id: string; firstName: string; lastName: string; dob: string | null }[] = []
  const { data: { user: campUser } } = await supabase.auth.getUser()
  if (campUser) {
    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('full_name, email, organisation_id, role')
      .eq('id', campUser.id)
      .single()
    if (viewerProfile?.organisation_id === org.id && viewerProfile?.role === 'parent') {
      loggedInParent = {
        name: (viewerProfile.full_name as string) || '',
        email: (viewerProfile.email as string) || campUser.email || '',
      }
      const { data: kids } = await supabase
        .from('players')
        .select('id, first_name, last_name, date_of_birth')
        .eq('parent_id', campUser.id)
      existingChildren = (kids || []).map((k) => ({
        id: k.id as string,
        firstName: (k.first_name as string) || '',
        lastName: (k.last_name as string) || '',
        dob: (k.date_of_birth as string | null) || null,
      }))
    }
  }
  const signInUrl = `/auth/signin?redirect=${encodeURIComponent(`/book/${slug}/camps/${campId}`)}`

  // NOTE: we do NOT mark the booking paid here. The success-page redirect is
  // not proof of payment (anyone could hit ?booked=1). The Stripe webhook
  // (checkout.session.completed → metadata.camp_booking_id) is the source of
  // truth and flips payment_status to 'paid' on a verified completion.
  // bookedParam is used only to show the friendly confirmation UI.

  const today = new Date().toISOString().split('T')[0]
  const isEarlyBird = c.early_bird_price && c.early_bird_deadline && today <= c.early_bird_deadline

  const metaPill = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-white/[0.08] border border-white/[0.12] backdrop-blur-sm text-white/85'

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Cinematic hero */}
      <div className="relative overflow-hidden text-white min-h-[340px] sm:min-h-[440px] flex items-end">
        {/* Background: cover photo (slightly zoomed) or branded gradient */}
        {c.image_url ? (
          <div
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{ backgroundImage: `url(${c.image_url})` }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, #060606 0%, ${primaryColor}55 100%)` }}
          />
        )}
        {/* Bottom-up scrim so text is always legible over any photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/75 to-[#0a0a0a]/25" />
        {/* Brand glow */}
        <div
          className="absolute -top-24 left-1/3 w-[28rem] h-[28rem] rounded-full blur-[140px] opacity-25 pointer-events-none"
          style={{ background: primaryColor }}
        />

        <div className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-6 pt-8 pb-8 sm:pb-12">
          <Link
            href={`/book/${slug}/camps`}
            className="inline-flex items-center gap-1.5 mb-5 sm:mb-7 text-sm text-white/60 hover:text-white transition-colors"
          >
            &larr; All Camps
          </Link>

          {/* Academy badge row */}
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url as string} alt={org.name as string} className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover bg-white/10 ring-1 ring-white/15" />
            ) : null}
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm"
              style={{ backgroundColor: `${primaryColor}22`, color: '#fff', border: `1px solid ${primaryColor}55` }}
            >
              Holiday Camp
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4 sm:mb-5 leading-[1.05]">
            {c.name}
          </h1>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <span className={metaPill}>📅 {formatDateRange(c.start_date, c.end_date)}</span>
            <span className={metaPill}>{days} day{days !== 1 ? 's' : ''}</span>
            {c.daily_start_time && <span className={metaPill}>⏰ {c.daily_start_time}{c.daily_end_time ? `–${c.daily_end_time}` : ''}</span>}
            {c.age_group && <span className={metaPill}>Ages {c.age_group}</span>}
            {c.location && <span className={metaPill}>📍 {c.location}</span>}
          </div>

          {/* Urgency banner */}
          {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 10 && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-red-300 font-medium">Only {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left!</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
          {/* Left column - details */}
          <div className="lg:col-span-3 space-y-10">
            {/* Key Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <DetailCard label="Dates" value={formatDateRange(c.start_date, c.end_date)} />
              <DetailCard
                label="Times"
                value={`${c.daily_start_time || '09:00'} - ${c.daily_end_time || '15:00'}`}
              />
              {c.location && <DetailCard label="Location" value={c.location} />}
              {c.age_group && <DetailCard label="Age Group" value={c.age_group} />}
              {c.price != null && (
                <DetailCard
                  label="Price"
                  value={isEarlyBird ? `\u00A3${Number(c.early_bird_price).toFixed(0)}` : `\u00A3${Number(c.price).toFixed(0)}`}
                  accentColor={primaryColor}
                />
              )}
              {c.max_capacity && (
                <DetailCard label="Spots Left" value={spotsLeft !== null ? `${spotsLeft} / ${c.max_capacity}` : `${c.max_capacity} places`} accentColor={primaryColor} />
              )}
            </div>

            {/* Description */}
            {c.description && (
              <section>
                <h2 className="text-xl font-bold text-white mb-4">About This Camp</h2>
                <p className="text-white/70 leading-relaxed whitespace-pre-line">{c.description}</p>
              </section>
            )}

            {/* Daily Schedule */}
            {schedule.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-white mb-6">Daily Schedule</h2>
                <div className="space-y-4">
                  {schedule.map((day, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-5 ${dayColors[idx % dayColors.length]}`}
                    >
                      <h3 className="font-semibold text-white mb-4">
                        {day.date ? formatDayHeader(day.date) : day.day}
                      </h3>
                      <div className="space-y-3 ml-2">
                        {day.activities.map((activity, aIdx) => {
                          const dashIndex = activity.indexOf(' - ')
                          const time = dashIndex > -1 ? activity.substring(0, dashIndex) : ''
                          const desc = dashIndex > -1 ? activity.substring(dashIndex + 3) : activity
                          return (
                            <div key={aIdx} className="flex items-start gap-3">
                              <div className="flex flex-col items-center mt-1">
                                <div className={`w-2.5 h-2.5 rounded-full ${dotColors[idx % dotColors.length]}`} />
                                {aIdx < day.activities.length - 1 && (
                                  <div className="w-px h-6 bg-white/10 mt-1" />
                                )}
                              </div>
                              <div>
                                {time && (
                                  <span className="text-xs font-mono text-white/40 block">{time}</span>
                                )}
                                <span className="text-sm text-white/80">{desc}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* What to Bring */}
            {c.what_to_bring && (
              <section>
                <h2 className="text-xl font-bold text-white mb-4">What to Bring</h2>
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <p className="text-white/70 leading-relaxed whitespace-pre-line">{c.what_to_bring}</p>
                </div>
              </section>
            )}

            <div className="pt-2">
              <ShareButton />
            </div>
          </div>

          {/* Right column - booking form */}
          <div className="lg:col-span-2">
            <div
              className="sticky top-6 rounded-2xl border bg-white/[0.04] backdrop-blur-sm p-5 sm:p-6"
              style={{ borderColor: `${primaryColor}25`, boxShadow: `0 10px 40px ${primaryColor}10` }}
            >
              {/* Flexible Camps (Phase 2) — parents on a flexible-days
                  camp see the view-only day picker. The whole-camp
                  form + its "Book Your Place" heading are only
                  rendered for whole-camp bookings, so today's parent
                  flow stays byte-identical. */}
              {isFlexibleCamp ? (
                <CampFlexibleDayPicker
                  campName={c.name}
                  flexPricePerDay={c.flex_price_per_day ?? null}
                  flexMinDays={c.flex_min_days ?? null}
                  days={campDays}
                  primaryColor={primaryColor}
                />
              ) : (
                <>
                  <h3 className="text-lg font-bold text-white mb-1">Book Your Place</h3>
                  <div className="h-0.5 w-10 rounded-full mb-4" style={{ backgroundColor: primaryColor }} />
                  <CampBookingForm
                    camp={{
                      id: c.id,
                      organisation_id: c.organisation_id,
                      name: c.name,
                      start_date: c.start_date,
                      end_date: c.end_date,
                      daily_start_time: c.daily_start_time,
                      daily_end_time: c.daily_end_time,
                      location: c.location,
                      price: c.price,
                      early_bird_price: c.early_bird_price ?? null,
                      early_bird_deadline: c.early_bird_deadline ?? null,
                      sibling_discount_enabled: c.sibling_discount_enabled ?? false,
                      sibling_discount_percent: c.sibling_discount_percent ?? null,
                      collect_medical_info: c.collect_medical_info ?? false,
                      require_consent: c.require_consent ?? false,
                      max_capacity: c.max_capacity,
                    }}
                    slug={slug}
                    spotsLeft={spotsLeft}
                    primaryColor={primaryColor}
                    bookingId={bookedParam ? bookingIdParam : null}
                    loggedInParent={loggedInParent}
                    existingChildren={existingChildren}
                    signInUrl={signInUrl}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/30">
        Powered by Player Portal
      </footer>
    </div>
  )
}

function DetailCard({ label, value, accentColor }: { label: string; value: string; accentColor?: string }) {
  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 sm:p-4 transition-colors hover:bg-white/[0.05]"
      style={accentColor ? { borderColor: `${accentColor}30` } : undefined}
    >
      <div className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider mb-1">{label}</div>
      <div className="font-bold text-sm sm:text-base" style={{ color: accentColor || '#fff' }}>{value}</div>
    </div>
  )
}
