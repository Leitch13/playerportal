import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { QuickBookForm } from './QuickBookForm'
import { isFutureStartBillingEnabled } from '@/lib/billing/flag'

export default async function QuickBookPage({
  params,
}: {
  params: Promise<{ slug: string; groupId: string }>
}) {
  const { slug, groupId } = await params
  const supabase = await createClient()

  // Get org. bridge_billing_mode (Stage 3 session enhancement) is fetched
  // separately below — it can be null if migration 072 hasn't been applied
  // yet, in which case we fall back to calendar mode safely.
  const { data: org } = await supabase
    .from('organisations')
    .select('id, name, slug, primary_color, contact_email, contact_phone')
    .ilike('slug', slug)
    .single()

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060606] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Academy Not Found</h1>
          <p className="text-white/50">This page doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  // Get the specific class
  const { data: group } = await supabase
    .from('training_groups')
    .select(
      'id, name, day_of_week, time_slot, location, max_capacity, age_group, description, price_per_session, class_type, coach:profiles!training_groups_coach_id_fkey(full_name)'
    )
    .eq('id', groupId)
    .eq('organisation_id', org.id)
    .single()

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060606] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Class Not Found</h1>
          <p className="text-white/50 mb-4">
            This class doesn&apos;t exist or has been removed.
          </p>
          <Link
            href={`/book/${slug}`}
            className="text-[#4ecde6] underline"
          >
            View all classes &rarr;
          </Link>
        </div>
      </div>
    )
  }

  // Get enrolment count for capacity. Includes 'pending' (Stage 3 future-start
  // enrolments that haven't activated yet) — the seat IS reserved from the
  // moment the parent commits, even if billing is deferred. The booking gate
  // separately blocks bookings before activates_on so this doesn't over-grant
  // access; it just keeps the spotsLeft count honest.
  const { count } = await supabase
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .in('status', ['active', 'pending'])

  const enrolled = count || 0
  const capacity = group.max_capacity || 20
  const spotsLeft = capacity - enrolled
  const isFull = spotsLeft <= 0

  if (isFull) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060606] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Class Full</h1>
          <p className="text-white/50 mb-4">
            This class is currently at capacity.
          </p>
          <Link
            href={`/book/${slug}/class/${groupId}`}
            className="text-[#4ecde6] underline"
          >
            View class details &rarr;
          </Link>
        </div>
      </div>
    )
  }

  // Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If logged in, fetch their existing children
  let existingChildren: { id: string; first_name: string; last_name: string }[] = []
  if (user) {
    const { data: children } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .eq('parent_id', user.id)
      .order('first_name')

    existingChildren = children || []
  }

  // Fetch plans: class-specific first, then class_type, then org-wide
  const { data: classPlans } = await supabase
    .from('subscription_plans')
    .select('id, name, description, amount, sessions_per_week, interval')
    .eq('organisation_id', org.id)
    .eq('active', true)
    .eq('training_group_id', groupId)
    .order('amount', { ascending: true })

  let plans = classPlans && classPlans.length > 0 ? classPlans : null

  if (!plans || plans.length === 0) {
    const classType = (group as Record<string, unknown>).class_type as string || 'group'
    const { data: typePlans } = await supabase
      .from('subscription_plans')
      .select('id, name, description, amount, sessions_per_week, interval')
      .eq('organisation_id', org.id)
      .eq('active', true)
      .eq('class_type', classType)
      .is('training_group_id', null)
      .order('amount', { ascending: true })
    plans = typePlans && typePlans.length > 0 ? typePlans : null
  }

  if (!plans || plans.length === 0) {
    const { data: orgPlans } = await supabase
      .from('subscription_plans')
      .select('id, name, description, amount, sessions_per_week, interval')
      .eq('organisation_id', org.id)
      .eq('active', true)
      .is('training_group_id', null)
      .is('class_type', null)
      .order('amount', { ascending: true })
    plans = orgPlans
  }

  const primaryColor = org.primary_color || '#4ecde6'
  const coach = group.coach as unknown as { full_name: string } | null

  // Stage 3 flag — server-side check, passed down so the picker can decide
  // between today-only (Option B clamp) and full today+future modes. Flag
  // currently OFF for all orgs in production until Stage 3 ships.
  const allowFutureStart = isFutureStartBillingEnabled(org.id)

  // Separately probe bridge_billing_mode and sessions_per_month so the page
  // renders correctly whether or not migration 072 has been applied. If
  // either query errors (column doesn't exist yet), we fall back to
  // calendar mode and treat all plans as session-mode-ineligible. Once
  // migration 072 is applied, both columns are read and session mode
  // becomes possible for orgs that opt in.
  let bridgeMode: 'calendar' | 'session' = 'calendar'
  let plansSessionMap = new Map<string, number | null>()
  try {
    const { data: orgBridge, error: bridgeErr } = await supabase
      .from('organisations')
      .select('bridge_billing_mode')
      .eq('id', org.id)
      .single()
    if (!bridgeErr && orgBridge && (orgBridge as { bridge_billing_mode?: string }).bridge_billing_mode === 'session') {
      bridgeMode = 'session'
    }
  } catch { /* migration 072 not applied — keep calendar default */ }
  try {
    const { data: planSessionsData, error: spmErr } = await supabase
      .from('subscription_plans')
      .select('id, sessions_per_month')
      .eq('organisation_id', org.id)
      .eq('active', true)
    if (!spmErr && planSessionsData) {
      plansSessionMap = new Map(
        (planSessionsData as Array<{ id: string; sessions_per_month: number | null }>)
          .map((p) => [p.id, p.sessions_per_month ?? null])
      )
    }
  } catch { /* migration 072 not applied — keep all-null fallback */ }

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      {/* Nav */}
      <nav className="backdrop-blur-xl bg-white/[0.02] border-b border-white/[0.06] sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href={`/book/${slug}/class/${groupId}`}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </Link>
          <span
            className="text-sm font-semibold"
            style={{ color: primaryColor }}
          >
            {org.name}
          </span>
        </div>
      </nav>

      {/* Class summary header */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Book {group.name}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-3 text-white/50 text-sm">
            <span style={{ color: primaryColor }} className="font-semibold">
              {group.day_of_week || 'TBA'}
            </span>
            {group.time_slot && <span>{group.time_slot}</span>}
            {group.location && <span>{group.location}</span>}
            {coach?.full_name && <span>{coach.full_name}</span>}
          </div>
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-white/40">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
            {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
          </div>
        </div>
      </div>

      {/* Quick Book Form */}
      <QuickBookForm
        isLoggedIn={!!user}
        existingChildren={existingChildren}
        plans={
          (plans || []).map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            amount: Number(p.amount),
            sessions_per_week: p.sessions_per_week,
            interval: p.interval,
            sessions_per_month: plansSessionMap.get(p.id) ?? null,
          }))
        }
        orgSlug={slug}
        orgId={org.id}
        orgName={org.name}
        groupId={groupId}
        groupName={group.name}
        primaryColor={primaryColor}
        classDayOfWeek={group.day_of_week as string | null}
        classTimeSlot={group.time_slot as string | null}
        allowFutureStart={allowFutureStart}
        bridgeMode={bridgeMode}
      />

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-white/20 mt-12">
        Powered by Player Portal
      </footer>
    </div>
  )
}
