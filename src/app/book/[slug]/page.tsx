import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
// Auth-contamination fix — pure anon client for public booking reads.
// See src/lib/supabase/public.ts for the full reasoning.
import { createPublicClient } from '@/lib/supabase/public'
import Link from 'next/link'
import type { Metadata } from 'next'
import PricingToggle from './PricingToggle'
import EnquiryButton from './EnquiryButton'
import { isQuarterlyEnabledForOrg } from '@/lib/quarterly-billing'
import BookingPageHero from '@/components/BookingPageHero'
import TermInfo from '@/components/TermInfo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  // Auth-contamination fix — metadata read uses the pure-anon client so
  // the page renders the correct academy regardless of viewer session.
  const supabase = createPublicClient()
  const { data: org } = await supabase
    .from('organisations')
    .select('name, description, logo_url')
    .ilike('slug', slug)
    .single()

  const title = org ? `${org.name} — Book Sessions` : 'Book Sessions'
  const description = org?.description || 'Professional football coaching for all ages and abilities. Book your sessions online.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(org?.logo_url ? { images: [{ url: org.logo_url }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

const CLASS_TYPE_CONFIG: Record<string, { label: string; gradient: string; color: string; icon: string }> = {
  group: { label: 'Group', gradient: 'from-blue-600 to-blue-900', color: '#3b82f6', icon: '&#9917;' },
  small_group: { label: 'Small Group', gradient: 'from-purple-600 to-purple-900', color: '#a855f7', icon: '&#127942;' },
  '1-2-1': { label: '1-2-1', gradient: 'from-amber-500 to-amber-800', color: '#f59e0b', icon: '&#11088;' },
  '2-1': { label: '2-1 Pair', gradient: 'from-orange-500 to-orange-800', color: '#f97316', icon: '&#129309;' },
  gk: { label: 'Goalkeeper', gradient: 'from-yellow-500 to-yellow-800', color: '#eab308', icon: '&#129349;' },
  soccer_tots: { label: 'Soccer Tots', gradient: 'from-pink-500 to-pink-800', color: '#ec4899', icon: '&#127880;' },
  academy: { label: 'Academy', gradient: 'from-indigo-600 to-indigo-900', color: '#6366f1', icon: '&#127941;' },
  accelerator: { label: 'Accelerator', gradient: 'from-rose-600 to-rose-900', color: '#f43f5e', icon: '&#128640;' },
  elite: { label: 'Elite', gradient: 'from-violet-600 to-violet-900', color: '#8b5cf6', icon: '&#128081;' },
  camp: { label: 'Camp', gradient: 'from-green-600 to-green-900', color: '#22c55e', icon: '&#127957;' },
  trial: { label: 'Trial', gradient: 'from-cyan-600 to-cyan-900', color: '#06b6d4', icon: '&#127919;' },
  girls: { label: 'Girls Only', gradient: 'from-fuchsia-600 to-fuchsia-900', color: '#d946ef', icon: '&#9734;' },
  adults: { label: 'Adults', gradient: 'from-slate-600 to-slate-800', color: '#64748b', icon: '&#127939;' },
  intensity: { label: 'Intensity', gradient: 'from-red-600 to-red-900', color: '#ef4444', icon: '&#128293;' },
}

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  // Trial Conversion 1A — Phase 3: read attribution params from the
  // personalised email links (?trial=<id>&email=<encoded>). Used below
  // once the org is loaded to write an attribution row that the webhook
  // auto-link consumes as the primary trial-match key.
  const sp = (await searchParams) || {}
  const incomingTrialId = typeof sp.trial === 'string' ? sp.trial : null
  const incomingEmailParam = typeof sp.email === 'string' ? sp.email : null
  // Auth-aware client — used ONLY for the owner-preview check below
  // (needs the viewer's session to identify them as the academy's own
  // admin/coach). Every other read on this page goes through the
  // pure-anon `publicSupabase` so a logged-in cross-org viewer doesn't
  // get auth-contaminated zero-row results from the *_select_own_org
  // RLS branch.
  const supabase = await createClient()
  const publicSupabase = createPublicClient()

  const { data: org } = await publicSupabase
    .from('organisations')
    .select('*')
    .ilike('slug', slug)
    .single()

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Academy Not Found</h1>
          <p className="text-text-light">This booking page doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  // ─── Trial Conversion 1A — Phase 3: write attribution row ──────────
  // When a parent arrives via the personalised email link
  // (/book/[slug]?trial=<id>&email=<encoded>), we record the (trial,
  // email, org) tuple so the Stripe webhook auto-link can match the
  // resulting subscription back to THIS specific trial — not just any
  // recent trial with the same email.
  //
  // Fire-and-forget: failures are logged but never block the page
  // render. We verify the trial belongs to THIS org before writing
  // (prevents URL-crafting from creating cross-org attributions).
  if (incomingTrialId && incomingEmailParam) {
    try {
      const sb = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const { data: trial } = await sb
        .from('trial_bookings')
        .select('id, organisation_id, parent_email, converted')
        .eq('id', incomingTrialId)
        .maybeSingle()
      if (
        trial &&
        trial.organisation_id === org.id &&
        !trial.converted &&
        trial.parent_email?.toLowerCase() === incomingEmailParam.toLowerCase()
      ) {
        await sb.from('trial_signup_attributions').insert({
          trial_booking_id: trial.id,
          parent_email: incomingEmailParam.toLowerCase(),
          organisation_id: org.id,
        })
      }
    } catch (err) {
      console.error('[trial_attribution_write_failed]', {
        slug,
        incomingTrialId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // ─── Publish gate (hybrid go-live model) ───
  // Academies set up free during their trial, but their public booking page
  // isn't bookable until they "go live" (subscribe to a platform plan).
  // The academy's own admin can still preview it (shown a banner); the public
  // sees a friendly "coming soon" instead.
  const isPublished = org.is_published !== false || !!org.pilot
  let isOwnerPreview = false
  if (!isPublished) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('organisation_id, role')
        .eq('id', user.id)
        .single()
      isOwnerPreview =
        viewerProfile?.organisation_id === org.id &&
        ['admin', 'coach'].includes((viewerProfile?.role as string) || '')
    }
    if (!isOwnerPreview) {
      const primary = (org.primary_color as string) || '#4ecde6'
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#060606] text-white px-4">
          <div
            className="fixed inset-x-0 top-0 h-64 opacity-30 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at top, ${primary}40 0%, transparent 60%)` }}
          />
          <div className="relative text-center max-w-md">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url as string} alt={org.name as string} className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4 bg-[#1a1a1a]" />
            ) : null}
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">{org.name}</h1>
            <p className="text-white/60 text-sm sm:text-base">
              This academy isn&apos;t taking online bookings just yet. Check back soon!
            </p>
          </div>
        </div>
      )
    }
  }

  // NOTE: training_groups does NOT have an is_published column — that gate
  // only exists on `camps`. An earlier "consistency" patch added
  // `.neq('is_published', false)` here which silently returned ZERO rows
  // because the column doesn't exist, so the whole Weekly Classes section
  // appeared empty on every academy's booking page. Do not re-add a
  // published filter until/unless the column is migrated in.
  const { data: groups } = await publicSupabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, max_capacity, coach:profiles!training_groups_coach_id_fkey(full_name), class_type, is_featured, price_per_session, trial_price, age_group, short_description, image_url, term_id')
    .eq('organisation_id', org.id)
    .order('name')

  // Phase 1B — fetch terms for the org so class cards can render term info
  // when a class has term_id set. Anon SELECT policy on terms (migration 092)
  // gates this to published orgs only.
  const { data: termsForBooking } = await publicSupabase
    .from('terms')
    .select('id, name, start_date, end_date, parent_message')
    .eq('organisation_id', org.id)
  const termById = new Map<string, { id: string; name: string; start_date: string; end_date: string; parent_message: string | null }>()
  for (const t of (termsForBooking || []) as Array<{ id: string; name: string; start_date: string; end_date: string; parent_message: string | null }>) {
    termById.set(t.id, t)
  }

  // Don't advertise "Free Trial" prominently if any of this academy's classes
  // actually charge for a trial (e.g. Jamie's £15 1-2-1s). For mixed academies
  // we keep the trial CTAs but drop the "Free" word so parents aren't misled
  // when they're really interested in a paid-trial class.
  const hasAnyPaidTrial = (groups || []).some(g => Number(g.trial_price ?? 0) > 0)
  const trialWord = hasAnyPaidTrial ? 'Trial' : 'Free Trial'
  const trialCtaShort = hasAnyPaidTrial ? 'Book Trial' : 'Try Free'

  // Class-card capacity counts include 'pending' (Stage 3 future-start) so
  // the seat is reserved at signup even before billing activates. Booking
  // gate enforces activates_on separately so this doesn't over-grant access.
  //
  // ─── 078 — use the SECURITY DEFINER RPC instead of direct enrolments
  // SELECT. The booking page server component runs under the anon role
  // (NEXT_PUBLIC_SUPABASE_ANON_KEY), and 077b restricted enrolments
  // SELECT to authenticated only. A direct query returned 0 rows for
  // every group, displaying every class as having full max_capacity
  // available — including the full ones. The RPC bypasses RLS and
  // returns ONLY (group_id, seat_count) aggregates, exposing no PII.
  const groupIds = (groups || []).map((g) => g.id)
  const { data: seatCounts } = await publicSupabase
    .rpc('get_group_seat_counts', { p_org_id: org.id })

  const countByGroup = new Map<string, number>()
  for (const row of (seatCounts || []) as Array<{ group_id: string; seat_count: number | string }>) {
    if (row.group_id && groupIds.includes(row.group_id)) {
      countByGroup.set(row.group_id, Number(row.seat_count) || 0)
    }
  }

  // Fetch ALL active plans for the org (we need them to show prices on class cards too)
  const { data: allPlans } = await publicSupabase
    .from('subscription_plans')
    .select('*')
    .eq('organisation_id', org.id)
    .eq('active', true)
    .order('sort_order')

  // Org-wide plans only (for the academy-level PricingToggle section)
  const rawPlans = (allPlans || []).filter(p => p.training_group_id === null && p.class_type === null)

  // Dedupe by (amount + sessions_per_week) to collapse semantic duplicates
  const seenKeys = new Set<string>()
  const plans = rawPlans.filter((p) => {
    const key = `${Number(p.amount)}|${p.sessions_per_week ?? ''}`
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })

  // Helper — find the cheapest matching plan for a given class.
  // Cascade: class-specific → class-type → generic (org-wide) fallback.
  //
  // The generic fallback ONLY fires when there's no specific/type plan. This
  // keeps academies that built type-specific plans clean (no generic noise —
  // the original complaint), while ensuring a class is NEVER unbookable: a
  // brand-new academy using only the default generic plans, or a one-off class
  // type with no dedicated plan, still gets a bookable price. Academies can
  // always add a class-type plan later to override the generic price.
  const genericPlans = (allPlans || []).filter(p => p.training_group_id === null && p.class_type === null)
  function findCheapestPlanFor(classId: string, classType: string | null) {
    const candidates = allPlans || []
    const classSpecific = candidates.filter(p => p.training_group_id === classId)
    if (classSpecific.length > 0) {
      return classSpecific.reduce((min, p) => Number(p.amount) < Number(min.amount) ? p : min)
    }
    if (classType) {
      const typeMatched = candidates.filter(p => p.class_type === classType && !p.training_group_id)
      if (typeMatched.length > 0) {
        return typeMatched.reduce((min, p) => Number(p.amount) < Number(min.amount) ? p : min)
      }
    }
    // Fallback: cheapest generic plan, so the class is still bookable.
    if (genericPlans.length > 0) {
      return genericPlans.reduce((min, p) => Number(p.amount) < Number(min.amount) ? p : min)
    }
    return null
  }

  const today = new Date().toISOString().split('T')[0]
  const { data: camps } = await publicSupabase
    .from('camps')
    .select('id')
    .eq('organisation_id', org.id)
    .eq('is_published', true)
    .gte('end_date', today)
    .limit(1)

  const hasCamps = (camps || []).length > 0

  const { data: events } = await publicSupabase
    .from('events')
    .select('*')
    .eq('organisation_id', org.id)
    .eq('active', true)
    .gte('end_date', today)
    .order('start_date')

  // Trust signals: count unique parents and total attendance records.
  // These remain on the cookie-aware client — `enrolments` and
  // `attendance` are 077b-locked to authenticated viewers, and the
  // existing behaviour already returns 0 for anon / cross-org viewers
  // (the trust-signal block hides itself when counts fall under the
  // 5/20 threshold). Switching to anon would unconditionally zero the
  // numbers for same-org admins viewing their own booking page —
  // regression. Leave as-is.
  const { count: parentCount } = await supabase
    .from('enrolments')
    .select('player_id', { count: 'exact', head: true })
    .in('group_id', groupIds)
    .eq('status', 'active')

  const { count: sessionCount } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .in('group_id', groupIds)

  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const sortedGroups = [...(groups || [])].sort((a, b) => {
    const aFeat = (a.is_featured as boolean) ? 0 : 1
    const bFeat = (b.is_featured as boolean) ? 0 : 1
    if (aFeat !== bFeat) return aFeat - bFeat
    const dayA = DAY_ORDER.indexOf(a.day_of_week || '')
    const dayB = DAY_ORDER.indexOf(b.day_of_week || '')
    return (dayA === -1 ? 99 : dayA) - (dayB === -1 ? 99 : dayB)
  })

  const primaryColor = org.primary_color || '#4ecde6'

  // Convert hex to r,g,b for CSS variable
  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '')
    const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
  }

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white"
      style={{ '--brand-primary': primaryColor, '--brand-primary-rgb': hexToRgb(primaryColor), '--color-accent': primaryColor } as React.CSSProperties}
    >
      {isOwnerPreview && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-3 text-center">
          <p className="text-sm text-amber-200">
            <strong>Preview mode</strong> — this page isn&apos;t public yet. Parents can&apos;t see it until you go live.{' '}
            <a href="/dashboard/billing" className="underline font-semibold hover:text-amber-100">Choose a plan to go live →</a>
          </p>
        </div>
      )}
      <BookingPageHero
        slug={slug}
        orgName={org.name as string}
        orgDescription={org.description as string | null}
        orgLogo={org.logo_url as string | null}
        orgHeroImage={org.hero_image_url as string | null}
        primaryColor={primaryColor as string}
        totalPlayers={parentCount || 0}
        totalSessions={sessionCount || 0}
        totalClasses={(groups || []).length}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12 space-y-8 sm:space-y-16">
        {/* Stripe-not-connected notice — shown when the academy hasn't finished Stripe Connect yet */}
        {!org.stripe_account_id && (
          <section>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-6 text-amber-100">
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0" aria-hidden>⚙️</div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-amber-200 mb-1">Payments coming soon</h3>
                  <p className="text-sm text-amber-100/80">
                    {org.name} is finishing setup. You can still browse classes and book a <strong>{trialWord.toLowerCase()}</strong> below — paid subscriptions will be available shortly.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Free Trial CTA Banner */}
        <section>
          <Link
            href={`/book/${slug}/trial/quick`}
            className="group block relative overflow-hidden rounded-2xl border-2 p-4 sm:p-6 transition-all hover:scale-[1.01] hover:shadow-xl"
            style={{ borderColor: '#10b981', background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)' }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[80px] bg-emerald-400/20" />
            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-white">
              <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-sm text-2xl sm:text-3xl shrink-0">
                &#9889;
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white">New</span>
                  {!hasAnyPaidTrial && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white">Free</span>}
                </div>
                <h3 className="text-base sm:text-xl font-extrabold">Book a {trialWord} Session</h3>
                <p className="text-white/70 text-xs sm:text-sm mt-0.5">No account needed. No payment. Takes 20 seconds to book.</p>
              </div>
              <div className="shrink-0 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-white text-emerald-900 font-bold text-sm transition-transform group-hover:scale-105">
                {trialCtaShort} &rarr;
              </div>
            </div>
          </Link>
        </section>

        {/* How It Works */}
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-white">How It Works</h2>
          <p className="text-center text-sm sm:text-base text-gray-400 mb-6 sm:mb-8">Three simple steps to get started</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
            {[
              { step: 1, title: `Book a ${trialWord}`, desc: 'Try a session with no commitment', icon: '&#128197;' },
              { step: 2, title: 'Join a Class', desc: 'Pick the sessions that suit your schedule', icon: '&#9917;' },
              { step: 3, title: 'Track Progress', desc: 'Watch your child develop with regular coach reports', icon: '&#128200;' },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-[#1e1e1e] bg-[#141414] p-4 sm:p-6 text-center">
                <div className="mx-auto mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full text-sm font-extrabold text-[#0a0a0a]" style={{ backgroundColor: primaryColor }}>{item.step}</div>
                <div className="text-xl sm:text-2xl mb-2 sm:mb-3" dangerouslySetInnerHTML={{ __html: item.icon }} />
                <h3 className="font-bold text-sm sm:text-base text-white mb-1">{item.title}</h3>
                <p className="text-xs sm:text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* "Our Plans" generic section removed — each class card now shows its
            own class-specific pricing. Showing org-wide generic plans here
            confused parents with prices that didn't match individual classes. */}

        <section>
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-white">Weekly Classes</h2>
          <p className="text-center text-sm sm:text-base text-gray-400 mb-6 sm:mb-8">Our regular training schedule</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {sortedGroups.map((group) => {
              const count = countByGroup.get(group.id) || 0
              const capacity = (group as unknown as { max_capacity: number }).max_capacity || 20
              const spotsLeft = capacity - count
              const isFull = spotsLeft <= 0
              const coach = group.coach as unknown as { full_name: string } | null
              const classType = (group.class_type as string) || 'group'
              const typeConfig = CLASS_TYPE_CONFIG[classType] || CLASS_TYPE_CONFIG.group
              const isFeatured = group.is_featured as boolean
              const price = group.price_per_session as number | null
              const ageGroup = group.age_group as string | null
              const shortDesc = group.short_description as string | null
              const coverImage = group.image_url as string | null
              const matchedPlan = findCheapestPlanFor(group.id, classType)

              return (
                <div key={group.id} className={`relative rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-[#141414] ${isFeatured ? 'border-2' : 'border-[#1e1e1e] hover:border-[#2a2a2a]'}`} style={isFeatured ? { borderColor: `${primaryColor}60`, boxShadow: `0 0 20px ${primaryColor}15` } : undefined}>
                  <div className={`relative h-28 sm:h-36 bg-gradient-to-br ${typeConfig.gradient} flex items-end p-3 sm:p-4`}>
                    {coverImage && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={coverImage} alt={group.name} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      </>
                    )}
                    {!coverImage && <div className="absolute top-3 right-3 w-16 h-16 rounded-full bg-white/10 blur-xl" />}
                    {!coverImage && <div className="absolute top-2 right-4 text-2xl opacity-30" dangerouslySetInnerHTML={{ __html: typeConfig.icon }} />}
                    {isFeatured && (
                      <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold uppercase tracking-wider">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        Featured
                      </div>
                    )}
                    <div className="relative z-10 flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/20">{typeConfig.label}</span>
                      {ageGroup && <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/20">{ageGroup}</span>}
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-base leading-tight text-white">{group.name}</h3>
                      {price != null && Number(price) > 0 ? (
                        <span className="shrink-0 text-lg font-extrabold whitespace-nowrap text-white">&pound;{Number(price).toFixed(0)}<span className="text-xs font-medium text-white/40">/session</span></span>
                      ) : matchedPlan ? (
                        (() => {
                          const monthly = Number(matchedPlan.amount)
                          const qEnabled = isQuarterlyEnabledForOrg((org as Record<string, unknown>).id as string, (org as Record<string, unknown>).quarterly_billing_enabled as boolean | null | undefined)
                          const qPercent = Math.max(0, Math.min(50, Number((org as Record<string, unknown>).quarterly_discount_percent ?? 10)))
                          const quarterly = monthly * 3 * (1 - qPercent / 100)
                          const saving = monthly * 3 * (qPercent / 100)
                          return (
                            <div className="shrink-0 text-right whitespace-nowrap">
                              <div className="flex items-baseline justify-end gap-1">
                                <span className="text-2xl sm:text-3xl font-extrabold text-white">&pound;{monthly.toFixed(0)}</span>
                                <span className="text-xs font-medium text-white/40">/mo</span>
                              </div>
                              {qEnabled && qPercent > 0 && (
                                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Save &pound;{saving.toFixed(0)}</span>
                                  <span className="text-[10px] opacity-80">· &pound;{quarterly.toFixed(0)}/3mo</span>
                                </div>
                              )}
                            </div>
                          )
                        })()
                      ) : null}
                    </div>
                    {shortDesc && <p className="text-xs text-gray-400 mb-3 line-clamp-2">{shortDesc}</p>}
                    {/* Phase 1B — Term block (only when class has term_id) */}
                    {(() => {
                      const termId = (group as unknown as { term_id: string | null }).term_id
                      if (!termId) return null
                      const t = termById.get(termId)
                      if (!t) return null
                      return (
                        <div className="mb-3">
                          <TermInfo
                            name={t.name}
                            start_date={t.start_date}
                            end_date={t.end_date}
                            parent_message={t.parent_message}
                          />
                        </div>
                      )
                    })()}
                    <div className="space-y-1.5 text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        <span className="font-semibold text-white">{group.day_of_week || 'TBA'}</span>
                        {group.time_slot && <span className="text-gray-500">{group.time_slot}</span>}
                      </div>
                      {group.location && (
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span>{group.location}</span>
                        </div>
                      )}
                      {coach?.full_name && (
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          <span>Coach {coach.full_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="mb-3 sm:mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        {isFull ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">Class Full</span>
                        ) : spotsLeft <= 3 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full animate-pulse">Only {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left!</span>
                        ) : (
                          <span className="text-xs text-gray-500">{spotsLeft} spots available</span>
                        )}
                        <span className="text-xs text-gray-500">{count}/{capacity}</span>
                      </div>
                      <div className="w-full bg-[#1e1e1e] rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (count / capacity) * 100)}%`, backgroundColor: isFull ? '#ef4444' : spotsLeft <= 3 ? '#f97316' : primaryColor }} />
                      </div>
                    </div>
                    <Link
                      href={`/book/${slug}/class/${group.id}`}
                      className="block w-full text-center py-3.5 sm:py-4 rounded-xl font-extrabold text-base transition-all hover:scale-[1.03] active:scale-[0.97] hover:brightness-110"
                      style={
                        isFull
                          ? { backgroundColor: '#1e1e1e', color: '#9ca3af' }
                          : {
                              background: `linear-gradient(135deg, #ffffff 0%, #e8f9fc 100%)`,
                              color: '#0a0a0a',
                              boxShadow: `0 8px 28px ${primaryColor}50, 0 0 0 2px ${primaryColor}, inset 0 -3px 0 rgba(0,0,0,0.06)`,
                            }
                      }
                    >
                      {isFull ? 'Join Waitlist' : 'Book Now'} &rarr;
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {(events || []).length > 0 && (
          <section>
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-white">Upcoming Events</h2>
            <p className="text-center text-sm sm:text-base text-gray-400 mb-6 sm:mb-8">Holiday camps, tournaments & more</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(events || []).map((event) => (
                <div key={event.id} className="rounded-xl border border-[#1e1e1e] bg-[#141414] p-5 hover:border-[#2a2a2a] transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 capitalize">{((event.event_type as string) || 'event').replace('_', ' ')}</span>
                      <h3 className="font-bold mt-2 text-white">{event.name}</h3>
                    </div>
                    {Number(event.price) > 0 && <span className="text-lg font-bold text-white">&pound;{Number(event.price).toFixed(0)}</span>}
                  </div>
                  {event.description && <p className="text-sm text-gray-400 mb-2">{event.description}</p>}
                  <div className="space-y-1 text-sm text-gray-400">
                    <div><span className="inline-block mr-1.5">&#128197;</span>{new Date(event.start_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{event.start_date !== event.end_date && (<> — {new Date(event.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</>)}</div>
                    {event.start_time && <div><span className="inline-block mr-1.5">&#128336;</span>{event.start_time}{event.end_time && ` — ${event.end_time}`}</div>}
                    {event.location && <div><span className="inline-block mr-1.5">&#128205;</span>{event.location}</div>}
                  </div>
                  <Link href={`/auth/signup?org=${slug}`} className="mt-4 block w-full text-center py-2 rounded-lg font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: primaryColor }}>Book Now</Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {hasCamps && (
          <section className="relative overflow-hidden rounded-2xl p-4 sm:p-8 text-center text-white" style={{ background: `linear-gradient(135deg, #065f46 0%, ${primaryColor} 100%)` }}>
            <div className="relative z-10">
              <span className="text-2xl sm:text-3xl block mb-2">&#127945;</span>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Football Camps</h2>
              <p className="text-sm sm:text-base text-white/70 mb-4 sm:mb-5 max-w-md mx-auto">Holiday camps with full-day sessions, games, tournaments &amp; more.</p>
              <Link href={`/book/${slug}/camps`} className="inline-block px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-semibold text-sm sm:text-base transition-transform hover:scale-105" style={{ backgroundColor: 'white', color: '#0a0a0a' }}>View Camps &rarr;</Link>
            </div>
          </section>
        )}

        <section className="relative overflow-hidden rounded-2xl p-4 sm:p-8 text-center text-white" style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${primaryColor} 100%)` }}>
          <div className="relative z-10">
            <span className="text-2xl sm:text-3xl block mb-2">&#9917;</span>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Not sure yet? Try a free session!</h2>
            <p className="text-sm sm:text-base text-white/70 mb-4 sm:mb-5 max-w-md mx-auto">Book a free taster session for your child — no commitment, no payment needed.</p>
            <Link href={`/book/${slug}/trial/quick`} className="inline-block px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-semibold text-sm sm:text-base transition-transform hover:scale-105" style={{ backgroundColor: 'white', color: '#0a0a0a' }}>Book a {trialWord} &rarr;</Link>
          </div>
        </section>

        {/* Trust Signals */}
        {((parentCount ?? 0) > 5 || (sessionCount ?? 0) > 20) && (
          <section className="rounded-2xl border border-[#1e1e1e] bg-[#141414] p-4 sm:p-10">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-6 sm:mb-8 text-white">Why families choose {org.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 text-center">
              {(parentCount ?? 0) > 0 && (
                <div>
                  <div className="text-3xl sm:text-4xl font-extrabold mb-1 text-white">{parentCount}+</div>
                  <div className="text-sm text-white/50">Active Players</div>
                </div>
              )}
              {(sessionCount ?? 0) > 0 && (
                <div>
                  <div className="text-3xl sm:text-4xl font-extrabold mb-1 text-white">{sessionCount?.toLocaleString()}+</div>
                  <div className="text-sm text-white/50">Sessions Delivered</div>
                </div>
              )}
              {(groups || []).length > 0 && (
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-3xl sm:text-4xl font-extrabold mb-1 text-white">{(groups || []).length}</div>
                  <div className="text-sm text-white/50">Weekly Classes</div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Trust / Qualification Badges */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'FA Qualified Coaches', icon: '&#127942;' },
              { label: 'DBS Checked', icon: '&#128274;' },
              { label: 'First Aid Trained', icon: '&#10010;' },
              { label: 'Fun & Safe Environment', icon: '&#128155;' },
            ].map((badge) => (
              <div key={badge.label} className="flex flex-col items-center gap-2 rounded-2xl border border-[#1e1e1e] bg-[#141414] p-4 sm:p-5 text-center">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full text-base sm:text-lg" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }} dangerouslySetInnerHTML={{ __html: badge.icon }} />
                <span className="text-[11px] sm:text-xs font-semibold text-gray-300">{badge.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Accordion */}
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-white">Frequently Asked Questions</h2>
          <p className="text-center text-sm sm:text-base text-gray-400 mb-6 sm:mb-8">Everything you need to know</p>
          <div className="space-y-3 max-w-2xl mx-auto">
            {[
              { q: 'What should my child wear?', a: 'Comfortable sportswear, shin pads, and appropriate footwear for the surface (astroturf trainers or football boots). Please bring a water bottle too.' },
              { q: 'What happens if it rains?', a: 'Sessions run in all weather unless conditions are unsafe. If a session is cancelled due to extreme weather, we will notify you in advance and offer a make-up session.' },
              { q: 'Can I change sessions?', a: 'Yes! You can switch between available sessions at any time by contacting us or through your parent portal. Subject to availability.' },
              { q: 'What age groups do you cater for?', a: 'We offer classes for children of all ages, from toddlers through to teens. Check our weekly schedule above to find the right group for your child.' },
              { q: 'Is there a trial session available?', a: hasAnyPaidTrial ? 'Yes — most classes offer a trial session so your child can experience our coaching before committing. Some 1-to-1s and specialist sessions are paid trials; the price (if any) will be shown on the class page. Tap "Book a Trial" to get started.' : 'Absolutely! We offer a free trial session so your child can experience our coaching before committing. Click the "Book a Free Trial" button to get started.' },
            ].map((faq) => (
              <details key={faq.q} className="group rounded-2xl border border-[#1e1e1e] bg-[#141414] overflow-hidden">
                <summary className="flex cursor-pointer items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 text-sm font-semibold text-white select-none list-none [&::-webkit-details-marker]:hidden">
                  <span>{faq.q}</span>
                  <span className="ml-4 shrink-0 text-gray-500 transition-transform group-open:rotate-45 text-lg leading-none">+</span>
                </summary>
                <div className="px-4 sm:px-5 pb-4 text-sm text-gray-400 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </section>

        <section className="text-center py-6 sm:py-12 px-4 rounded-2xl border border-[#1e1e1e]" style={{ backgroundColor: `${primaryColor}08` }}>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-white">Ready to get started?</h2>
          <p className="text-sm sm:text-base text-gray-400 mb-5 sm:mb-6">Sign up today and book your child&apos;s first class</p>
          <div className="flex flex-wrap gap-3 justify-center items-center">
            <Link href={`/auth/signup?org=${slug}`} className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-semibold text-sm sm:text-base text-white transition-transform hover:scale-105" style={{ backgroundColor: primaryColor }}>Sign Up Free</Link>
            <Link href={`/book/${slug}/trial/quick`} className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-semibold text-sm sm:text-base border-2 transition-transform hover:scale-105" style={{ borderColor: primaryColor, color: primaryColor }}>Book a {trialWord}</Link>
            <EnquiryButton orgId={org.id} academyName={org.name} primaryColor={primaryColor} />
          </div>
          {(org.contact_email || org.contact_phone) && (
            <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm text-gray-500">
              {org.contact_email && <span>&#9993;&#65039; {org.contact_email}</span>}
              {org.contact_phone && <span>&#128222; {org.contact_phone}</span>}
            </div>
          )}
          {(org.social_facebook || org.social_instagram) && (
            <div className="mt-3 flex gap-4 justify-center text-sm">
              {org.social_facebook && <a href={org.social_facebook} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors">Facebook</a>}
              {org.social_instagram && <a href={org.social_instagram} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors">Instagram</a>}
            </div>
          )}
        </section>
      </div>

      <footer className="border-t border-[#1e1e1e] py-6 text-center text-xs text-gray-600">Powered by Player Portal</footer>
    </div>
  )
}
