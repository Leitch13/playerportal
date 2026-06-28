import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/StatusBadge'

// ─── SECURITY: force dynamic rendering ───
// /dashboard/payments serves different content per user/role. Marking this
// route dynamic explicitly is defence-in-depth against any edge / CDN /
// build-time caching that could ever cross-serve an admin's RSC payload
// to a parent (or any other user). The supabase server client already
// touches cookies(), which Next infers as dynamic, but the explicit
// directive removes any room for misconfiguration.
export const dynamic = 'force-dynamic'
export const revalidate = 0
import EmptyState from '@/components/EmptyState'
import type { UserRole, SubscriptionPlan } from '@/lib/types'
import PaymentManager from './PaymentManager'
import PaymentStatusToggleClient from './PaymentStatusToggleClient'
import PayNowButton from './PayNowButton'
import SubscribeButton from './SubscribeButton'
import ManageBillingButton from './ManageBillingButton'
import SubscriptionPlanManager from './SubscriptionPlanManager'
import AssignSubscription from './AssignSubscription'
import SubscriptionActions from './SubscriptionActions'
import PaymentLinkGenerator from './PaymentLinkGenerator'
import Link from 'next/link'
import FinancialBreakdown from './FinancialBreakdown'
import CancellationIntelligence from './CancellationIntelligence'
import SendReminderButton from './SendReminderButton'
// Sprint 6 — WhatsApp deep-link for overdue rows.
import WhatsAppButton from '@/components/WhatsAppButton'
import { WA_TEMPLATES } from '@/lib/whatsapp'
// Parent Subscription Hub section components (built in this PR)
import MembershipOverview from './MembershipOverview'
import MyChildrenList, { type ChildSummary } from './MyChildrenList'
import ActiveClassesList, { type ActiveClass } from './ActiveClassesList'
import BillingPanel, { type BillingFacts } from './BillingPanel'
import MembershipManagement from './MembershipManagement'
import AvailableUpgrades from './AvailableUpgrades'

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    add?: string
    filter?: string
    success?: string
    cancelled?: string
    sub_success?: string
    sub_cancelled?: string
    tab?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, stripe_customer_id, organisation_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const orgId = profile?.organisation_id || ''

  // ─── SECURITY: STRICT role gate ───
  // Anything that isn't EXACTLY 'admin' falls through to the parent view.
  // The previous gate was `if (role === 'parent') ...` which routed any
  // unrecognised role string ('coach', 'super_admin', '', undefined, a
  // corrupted profile, etc.) to the admin view by default. The defaults
  // are now inverted: admin must be explicitly proven, everyone else gets
  // the parent hub.
  if (role !== 'admin') {
    return (
      <ParentPayments
        userId={user.id}
        orgId={orgId}
        hasStripeCustomer={!!profile?.stripe_customer_id}
        success={params.success === '1'}
        cancelled={params.cancelled === '1'}
        subSuccess={params.sub_success === '1'}
        subCancelled={params.sub_cancelled === '1'}
      />
    )
  }

  // ─── SECURITY: an admin without an organisation_id is a corrupt
  // state and must not see anything. 404 (not 401) — we don't want to
  // leak whether the route exists.
  if (!orgId) {
    notFound()
  }

  return <AdminPayments autoOpen={params.add === '1'} filter={params.filter || 'all'} orgId={orgId} activeTab={params.tab || 'overview'} />
}

/* ═══════════════════════════════════════════════
   PARENT VIEW
   ═══════════════════════════════════════════════ */
async function ParentPayments({
  userId,
  orgId,
  hasStripeCustomer,
  success,
  cancelled,
  subSuccess,
  subCancelled,
}: {
  userId: string
  orgId: string
  hasStripeCustomer: boolean
  success: boolean
  cancelled: boolean
  subSuccess: boolean
  subCancelled: boolean
}) {
  const supabase = await createClient()

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('*, plan:subscription_plans(*), player:players(first_name, last_name)')
    .eq('parent_id', userId)
    .order('created_at', { ascending: false })

  const { data: payments } = await supabase
    .from('payments')
    .select('*, player:players(first_name, last_name)')
    .eq('parent_id', userId)
    .order('due_date', { ascending: false })

  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  const { data: myPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name, date_of_birth')
    .eq('parent_id', userId)

  const playerIds = (myPlayers || []).map((p) => p.id)
  const { data: enrolments } = playerIds.length > 0
    ? await supabase
        .from('enrolments')
        .select('id, player_id, group_id, status, group:training_groups(name, day_of_week, time_slot, location, coach:profiles!training_groups_coach_id_fkey(full_name))')
        .in('player_id', playerIds)
        .eq('status', 'active')
    : { data: [] as never[] }

  type BookedClass = {
    id: string
    player_id: string
    group_id: string
    status: string
    group: {
      name: string
      day_of_week: string | null
      time_slot: string | null
      location: string | null
      coach: { full_name: string } | null
    } | null
  }

  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const bookedClasses = ((enrolments || []) as unknown as BookedClass[]).sort((a, b) => {
    const dayA = DAY_ORDER.indexOf(a.group?.day_of_week || '')
    const dayB = DAY_ORDER.indexOf(b.group?.day_of_week || '')
    return (dayA === -1 ? 99 : dayA) - (dayB === -1 ? 99 : dayB)
  })

  const activeSubs = (subscriptions || []).filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  )
  const otherSubs = (subscriptions || []).filter(
    (s) => s.status !== 'active' && s.status !== 'trialing'
  )

  // ─── Phase 1B — resolve term per active sub via enrolment → group → term ───
  // A sub doesn't directly link to a term; we walk: sub.player_id → enrolment
  // (already loaded into bookedClasses) → group_id → training_groups.term_id
  // → terms.* (two extra reads). When a player has multiple enrolments we use
  // the first one with a term assigned. No-term-anywhere → no extra rendering.
  const enrolledGroupIds = Array.from(new Set(bookedClasses.map((c) => c.group_id)))
  const { data: groupTermRows } = enrolledGroupIds.length > 0
    ? await supabase
        .from('training_groups')
        .select('id, term_id')
        .in('id', enrolledGroupIds)
    : { data: [] as { id: string; term_id: string | null }[] }
  const groupTermByGroupId = new Map<string, string | null>()
  for (const r of (groupTermRows || []) as { id: string; term_id: string | null }[]) {
    groupTermByGroupId.set(r.id, r.term_id)
  }
  const termIdsForSubs = Array.from(new Set(
    Array.from(groupTermByGroupId.values()).filter((v): v is string => !!v),
  ))
  const { data: termsForSubs } = termIdsForSubs.length > 0
    ? await supabase
        .from('terms')
        .select('id, name, start_date, end_date, parent_message')
        .in('id', termIdsForSubs)
    : { data: [] as { id: string; name: string; start_date: string; end_date: string; parent_message: string | null }[] }
  const termById = new Map<string, { id: string; name: string; start_date: string; end_date: string; parent_message: string | null }>()
  for (const t of (termsForSubs || []) as { id: string; name: string; start_date: string; end_date: string; parent_message: string | null }[]) {
    termById.set(t.id, t)
  }
  const termByPlayer = new Map<string, { id: string; name: string; start_date: string; end_date: string; parent_message: string | null }>()
  for (const e of bookedClasses) {
    if (termByPlayer.has(e.player_id)) continue
    const termId = groupTermByGroupId.get(e.group_id)
    if (termId) {
      const term = termById.get(termId)
      if (term) termByPlayer.set(e.player_id, term)
    }
  }
  const activeSubsWithTerm = activeSubs.map((s) => ({
    ...s,
    term: (s as { player_id?: string }).player_id
      ? termByPlayer.get((s as { player_id?: string }).player_id as string) || null
      : null,
  }))

  const totalDue = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
  const outstanding = totalDue - totalPaid
  const overdueCount = (payments || []).filter((p) => p.status === 'overdue').length

  const monthlyTotal = activeSubs.reduce((sum, s) => {
    const plan = s.plan as unknown as SubscriptionPlan
    return sum + (plan ? Number(plan.amount) : 0)
  }, 0)

  // ─── HUB: extra fetches for the new sections (org policy + retention + payment dates) ───
  // Try the post-075 column set first; gracefully fall back if migration not yet applied.
  // Mirrors the cancel-page pattern from earlier this session.
  type OrgRow = {
    name?: string
    cancellation_notice_days?: number
    cancellation_policy?: string | null
    retention_offer_enabled?: boolean
    retention_offer_percent?: number
    retention_offer_months?: number | null
    contact_phone?: string | null
  }
  let orgRow: OrgRow | null = null
  if (orgId) {
    const full = 'name, cancellation_notice_days, cancellation_policy, retention_offer_enabled, retention_offer_percent, retention_offer_months, contact_phone'
    const legacy = 'name, cancellation_notice_days, retention_offer_enabled, retention_offer_percent, retention_offer_months, contact_phone'
    const first = await supabase.from('organisations').select(full).eq('id', orgId).single()
    if (first.error && first.error.code === '42703') {
      const fallback = await supabase.from('organisations').select(legacy).eq('id', orgId).single()
      orgRow = (fallback.data ?? null) as unknown as OrgRow | null
    } else {
      orgRow = (first.data ?? null) as unknown as OrgRow | null
    }
  }
  const academyName = orgRow?.name || 'your academy'
  // Sprint 6 — academy's WhatsApp number (uses contact_phone for v1, no
  // new column). Null when missing; the widget hides itself in that case.
  const academyWhatsappPhone = orgRow?.contact_phone || null
  // First-child first name for the WhatsApp message template, when known.
  const firstChildFirstName = (myPlayers || [])[0]?.first_name as string | undefined
  const cancellationNoticeDays = Number(orgRow?.cancellation_notice_days ?? 0)
  const cancellationPolicy = orgRow?.cancellation_policy ?? null
  const retentionEnabled = orgRow?.retention_offer_enabled !== false
  const retentionPercent = Number(orgRow?.retention_offer_percent ?? 50)
  const retentionMonths: number | null = orgRow?.retention_offer_months === undefined
    ? 1
    : orgRow.retention_offer_months == null ? null : Number(orgRow.retention_offer_months)

  // ─── HUB: derive per-child summary (count of active enrolments + sessions/week) ───
  const enrolByPlayer = new Map<string, number>()
  for (const e of bookedClasses) {
    enrolByPlayer.set(e.player_id, (enrolByPlayer.get(e.player_id) || 0) + 1)
  }
  // sessions_per_week comes from the parent's ACTIVE subs (plan-level field).
  const sessionsByPlayer = new Map<string, number>()
  for (const s of activeSubs) {
    const plan = s.plan as unknown as SubscriptionPlan & { sessions_per_week?: number | null }
    const pid = (s as { player_id?: string }).player_id
    if (!pid || !plan) continue
    sessionsByPlayer.set(pid, (sessionsByPlayer.get(pid) || 0) + Number(plan.sessions_per_week ?? 0))
  }
  const childSummaries: ChildSummary[] = (myPlayers || []).map((p) => ({
    id: p.id as string,
    first_name: (p as { first_name?: string }).first_name || '',
    last_name: (p as { last_name?: string }).last_name || '',
    date_of_birth: (p as { date_of_birth?: string | null }).date_of_birth ?? null,
    activeClassCount: enrolByPlayer.get(p.id as string) || 0,
    sessionsPerWeek: sessionsByPlayer.get(p.id as string) || 0,
  }))

  // ─── HUB: enrich enrolments with the child's name (one extra denormalised join) ───
  const playerById = new Map<string, { first_name: string; last_name: string }>()
  for (const p of myPlayers || []) playerById.set(p.id as string, {
    first_name: (p as { first_name?: string }).first_name || '',
    last_name: (p as { last_name?: string }).last_name || '',
  })
  const activeClassesEnriched: ActiveClass[] = bookedClasses.map(b => ({
    id: b.id,
    player_id: b.player_id,
    group_id: b.group_id,
    group: b.group,
    child: playerById.get(b.player_id) || null,
  }))

  // ─── HUB: derive billing facts ───
  const paidPayments = (payments || []).filter(p => Number(p.amount_paid || 0) > 0).sort((a, b) => {
    const ad = a.paid_date || a.created_at || a.due_date
    const bd = b.paid_date || b.created_at || b.due_date
    return String(bd).localeCompare(String(ad))
  })
  const lastPaid = paidPayments[0] || null
  // Next payment = earliest current_period_end across active subs
  let nextPaymentIso: string | null = null
  let nextPaymentAmount: number | null = null
  for (const s of activeSubs) {
    const ts = (s as { current_period_end?: string | null }).current_period_end
    if (!ts) continue
    if (!nextPaymentIso || String(ts) < String(nextPaymentIso)) {
      nextPaymentIso = String(ts)
      nextPaymentAmount = Number((s.plan as unknown as SubscriptionPlan)?.amount ?? 0)
    }
  }
  const billingFacts: BillingFacts = {
    hasStripeCustomer,
    outstanding,
    totalPaid,
    overdueCount,
    lastPaymentDate: lastPaid?.paid_date || lastPaid?.created_at || null,
    lastPaymentAmount: lastPaid ? Number(lastPaid.amount_paid || 0) : null,
    nextPaymentDate: nextPaymentIso,
    nextPaymentAmount,
  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
    {/* Sprint M1 (MF-3) — Header compressed on mobile so Membership Overview
        sits above the fold at 375/390/430px. Tighter vertical spacing
        (space-y-3 sm:space-y-6), smaller h1 (text-lg → text-2xl @ sm:),
        banners compact (py-2 text-xs) until sm:. No business logic changed —
        ManageBillingButton, layout, sections all identical from sm: up. */}
    <div className="space-y-3 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        {/* Parent h1 says "Membership" — matches the parent nav label and the
            Membership Hub framing (2e1e255).  Admin h1 below is untouched. */}
        <h1 className="text-lg sm:text-2xl font-bold text-white leading-tight">Membership</h1>
        {hasStripeCustomer && <ManageBillingButton />}
      </div>

      {success && (
        <div className="bg-[#4ecde6]/10 border border-[#4ecde6]/30 text-[#4ecde6] rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium">
          Payment successful! Your balance will update shortly.
        </div>
      )}
      {cancelled && (
        <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium">
          Payment was cancelled. You can try again anytime.
        </div>
      )}
      {subSuccess && (
        <div className="bg-[#4ecde6]/10 border border-[#4ecde6]/30 text-[#4ecde6] rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium">
          Subscription activated! Welcome aboard.
        </div>
      )}
      {subCancelled && (
        <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium">
          Subscription setup was cancelled. You can subscribe anytime.
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          PARENT SUBSCRIPTION HUB — 6 composed sections per approved plan.
          Order: Membership · Children · Classes · Billing · Management · Upgrades
          Sections are pure presentation; all Stripe/cancel/messaging flows
          are reused unchanged through deep links + the existing components.
          ═══════════════════════════════════════════════════════════ */}

      <MembershipOverview activeSubs={activeSubsWithTerm as Parameters<typeof MembershipOverview>[0]['activeSubs']} outstanding={outstanding} />

      <MyChildrenList children={childSummaries} />

      <ActiveClassesList
        classes={activeClassesEnriched}
        retentionEnabled={retentionEnabled}
        retentionPercent={retentionPercent}
        retentionMonths={retentionMonths}
      />

      <BillingPanel facts={billingFacts} />

      <MembershipManagement
        hasActiveSub={activeSubs.length > 0}
        noticeDays={cancellationNoticeDays}
        policyText={cancellationPolicy}
        academyName={academyName}
        academyWhatsappPhone={academyWhatsappPhone}
        firstChildFirstName={firstChildFirstName}
      />

      {/* Pending subs (incomplete checkouts) — only show when present.
          Uses the existing SubscribeButton to complete activation. */}
      {otherSubs.filter((s) => s.status === 'incomplete').length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Pending Subscriptions</h2>
          {otherSubs
            .filter((s) => s.status === 'incomplete')
            .map((sub) => {
              const plan = sub.plan as unknown as SubscriptionPlan
              const player = sub.player as unknown as { first_name: string; last_name: string } | null

              return (
                <div key={sub.id} className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-sm">
                          {plan?.name || 'Subscription'}
                          {player && (
                            <span className="text-white/60 font-normal">
                              {' '}&mdash; {player.first_name} {player.last_name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/60 mt-1">
                          Assigned by your coach — activate to start paying
                        </div>
                      </div>
                      <StatusBadge status="pending" />
                    </div>
                    {plan && (
                      <SubscribeButton
                        planId={plan.id}
                        planName={plan.name}
                        amount={plan.amount}
                        interval={plan.interval}
                        playerId={sub.player_id || undefined}
                      />
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      )}

      <AvailableUpgrades plans={(plans || []) as Parameters<typeof AvailableUpgrades>[0]['plans']} hasActiveSub={activeSubs.length > 0} />

    </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   ADMIN VIEW
   ═══════════════════════════════════════════════ */
// ─── Local, on-brand presentation helpers — AdminPayments view ONLY. ───
// Deliberately NOT the shared StatusBadge (that one is also used by
// ParentPayments / other pages and must stay byte-identical). These render
// display chrome only — no status logic, no data, no behaviour.
function adminSubStatusPill(status: string) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    active: { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
    trialing: { label: 'Trialing', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30', dot: 'bg-blue-400' },
    scheduled: { label: 'Scheduled', cls: 'bg-[#4ecde6]/12 text-[#4ecde6] border-[#4ecde6]/30', dot: 'bg-[#4ecde6]' },
    paused: { label: 'Paused', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
    past_due: { label: 'Past due', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30', dot: 'bg-orange-400' },
    canceled: { label: 'Canceled', cls: 'bg-white/[0.06] text-white/50 border-white/[0.12]', dot: 'bg-white/40' },
    cancelled: { label: 'Canceled', cls: 'bg-white/[0.06] text-white/50 border-white/[0.12]', dot: 'bg-white/40' },
    incomplete: { label: 'Incomplete', cls: 'bg-white/[0.06] text-white/50 border-white/[0.12]', dot: 'bg-white/40' },
  }
  const m = map[status] || { label: status, cls: 'bg-white/[0.06] text-white/60 border-white/[0.12]', dot: 'bg-white/40' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} aria-hidden />
      {m.label}
    </span>
  )
}

function adminInitialsChip(name: string) {
  const initials = (name || '').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('') || '—'
  return (
    <span className="w-9 h-9 shrink-0 rounded-xl bg-[#4ecde6]/12 border border-[#4ecde6]/25 flex items-center justify-center text-xs font-bold text-[#4ecde6]">
      {initials}
    </span>
  )
}

async function AdminPayments({
  autoOpen,
  filter,
  orgId,
  activeTab,
}: {
  autoOpen: boolean
  filter: string
  orgId: string
  activeTab: string
}) {
  const supabase = await createClient()

  // ─── SECURITY: re-assert role + org inside the admin component ───
  // The page-level gate is the primary guard, but if this component is
  // ever rendered through a different code path (a hot-reload mid-edit,
  // a future route alias, a copy-paste in another file), the re-check
  // catches it. We also re-read the profile from THIS request's auth
  // context — never trust the orgId prop without verifying.
  const { data: { user: meUser } } = await supabase.auth.getUser()
  if (!meUser) redirect('/auth/signin')
  const { data: meProfile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', meUser.id)
    .single()
  if (!meProfile || meProfile.role !== 'admin') notFound()
  if (!meProfile.organisation_id || meProfile.organisation_id !== orgId) notFound()
  // From here on, `orgId` is proven to be this admin's actual organisation.

  // Sprint 6 — fetch academy name for WhatsApp deep-link templates.
  const { data: adminOrgRow } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', orgId)
    .single()
  const adminAcademyName = (adminOrgRow?.name as string | undefined) || 'the academy'

  // ─── Subscription Plans (org-scoped) ───
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('organisation_id', orgId)
    .order('sort_order')

  const activePlans = (plans || []).filter((p) => p.active)

  // ─── All Subscriptions (org-scoped) ───
  // SECURITY: explicit org filter is defence-in-depth. RLS on this
  // table already restricts to the caller's org, but if RLS is ever
  // mis-migrated this explicit filter keeps the leak surface to zero.
  const { data: allSubscriptions } = await supabase
    .from('subscriptions')
    .select('*, plan:subscription_plans(*), player:players(first_name, last_name), parent:profiles!subscriptions_parent_id_fkey(full_name)')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200)

  // ─── Players with parent names for assignment (org-scoped) ───
  const { data: playersRaw } = await supabase
    .from('players')
    .select('id, first_name, last_name, parent_id, parent:profiles!players_parent_id_fkey(full_name)')
    .eq('organisation_id', orgId)
    .order('first_name')

  const playersForAssign = (playersRaw || []).map((p) => ({
    id: p.id as string,
    first_name: p.first_name as string,
    last_name: p.last_name as string,
    parent_id: p.parent_id as string,
    parent_name: (p.parent as unknown as { full_name: string })?.full_name || '—',
  }))

  // ─── All Payments (org-scoped) — for stats + financial breakdown ───
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount, amount_paid, status, parent_id, created_at, paid_date')
    .eq('organisation_id', orgId)

  // ─── Filtered payments for list (org-scoped) ───
  let query = supabase
    .from('payments')
    .select('*, parent:profiles!payments_parent_id_fkey(full_name, email, phone), player:players(first_name, last_name)')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (filter === 'overdue') query = query.eq('status', 'overdue')
  else if (filter === 'unpaid') query = query.in('status', ['unpaid', 'partial'])
  else if (filter === 'paid') query = query.eq('status', 'paid')

  const { data: payments } = await query

  // ─── All Parents (with signup dates) — org-scoped ───
  const { data: allParents } = await supabase
    .from('profiles')
    .select('id, full_name, created_at')
    .eq('role', 'parent')
    .eq('organisation_id', orgId)
    .order('full_name')

  // ─── Cancellation Intelligence — org-scoped read of the cancellations
  // table + a pre-join to subscription_plans.amount so the derive layer
  // can compute Lost MRR / Saved MRR / Offer ROI without holding any
  // business logic of its own. Fetched only when on the analytics tab
  // to keep the Overview tab fast.
  //
  // Schema-safe shape: cancellations.subscription_id is the *Stripe*
  // subscription id (sub_*). We join subscriptions on
  // stripe_subscription_id, then plan.amount.
  type CancellationFetchRow = {
    id: string
    cancellation_type: string | null
    reason: string | null
    reason_detail: string | null
    offered_discount: boolean
    accepted_discount: boolean
    discount_percent: number | null
    final_status: string | null
    cancelled_at: string | null
    subscription_id: string | null
  }
  let cancellationsForDerive: import('@/lib/cancellation-derive').CancellationRow[] = []
  let detectedSubscriptionCancellations = 0
  if (activeTab === 'analytics') {
    const { data: rawCancellations } = await supabase
      .from('cancellations')
      .select('id, cancellation_type, reason, reason_detail, offered_discount, accepted_discount, discount_percent, final_status, cancelled_at, subscription_id')
      .eq('organisation_id', orgId)
      .order('cancelled_at', { ascending: false })
      .limit(1000)
    const rows = (rawCancellations || []) as CancellationFetchRow[]

    // Pull the plan amount for every Stripe sub id referenced. One round-trip.
    const subIds = Array.from(new Set(rows.map(r => r.subscription_id).filter((s): s is string => !!s)))
    const planAmountBySubId = new Map<string, number>()
    if (subIds.length > 0) {
      const { data: subRows } = await supabase
        .from('subscriptions')
        .select('stripe_subscription_id, plan:subscription_plans(amount)')
        .eq('organisation_id', orgId)
        .in('stripe_subscription_id', subIds)
      // PostgREST returns the embedded relation as an array even on a
      // 1:1 join; coerce safely.
      for (const s of (subRows || []) as unknown as Array<{ stripe_subscription_id: string | null; plan: { amount: number | string | null } | { amount: number | string | null }[] | null }>) {
        if (!s.stripe_subscription_id) continue
        const plan = Array.isArray(s.plan) ? s.plan[0] : s.plan
        const amt = Number(plan?.amount ?? 0)
        planAmountBySubId.set(s.stripe_subscription_id, amt)
      }
    }

    // Enrich rows for the derive layer.
    cancellationsForDerive = rows.map(r => ({
      id: r.id,
      cancellation_type: (r.cancellation_type === 'class' || r.cancellation_type === 'subscription')
        ? r.cancellation_type
        : null,
      reason: r.reason,
      reason_detail: r.reason_detail,
      offered_discount: !!r.offered_discount,
      accepted_discount: !!r.accepted_discount,
      discount_percent: r.discount_percent == null ? null : Number(r.discount_percent),
      final_status: r.final_status,
      cancelled_at: r.cancelled_at,
      plan_amount: r.subscription_id ? (planAmountBySubId.get(r.subscription_id) ?? null) : null,
    }))

    // Detected subscription cancellations = subscriptions table cancel signals.
    // Used by the derive layer's data-integrity check to surface orphaned
    // cancels (e.g. legacy Stripe-side admin cancels that bypassed CancelFlow).
    const { count: cancelledStatusCount } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', orgId)
      .eq('status', 'canceled')
    const { count: canceledAtCount } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', orgId)
      .not('canceled_at', 'is', null)
    // Either signal is a cancel — take the max (over-counting risk < 0 because both signals don't overlap by intent).
    detectedSubscriptionCancellations = Math.max(cancelledStatusCount || 0, canceledAtCount || 0)
  }

  // ─── All Players (org-scoped) ───
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name, parent_id, created_at')
    .eq('organisation_id', orgId)
    .order('first_name')

  // ═══════════════════════════════════════
  // FINANCIAL ANALYTICS DATA
  // ═══════════════════════════════════════

  const activeSubsList = (allSubscriptions || []).filter((s) => s.status === 'active')
  const canceledSubs = (allSubscriptions || []).filter((s) => s.status === 'canceled')

  // Monthly recurring revenue
  const monthlyRecurring = activeSubsList.reduce((sum, s) => {
    const plan = s.plan as unknown as SubscriptionPlan
    return sum + (plan ? Number(plan.amount) : 0)
  }, 0)

  // Total lifetime revenue (all paid amounts)
  const totalLifetimeRevenue = (allPayments || []).reduce((s, p) => s + Number(p.amount_paid || 0), 0)

  // Projected annual
  const projectedAnnual = monthlyRecurring * 12

  // Unique parents with players
  const parentsWithPlayers = new Set((allPlayers || []).map((p) => p.parent_id)).size
  const totalParentCount = (allParents || []).length

  // Avg revenue per player
  const avgRevenuePerPlayer = (allPlayers || []).length > 0
    ? monthlyRecurring / Math.max(1, (allPlayers || []).length)
    : 0

  // Avg revenue per parent
  const avgRevenuePerParent = totalParentCount > 0
    ? (monthlyRecurring + totalLifetimeRevenue / Math.max(1, totalParentCount)) / Math.max(1, totalParentCount)
    : 0

  // Collection rate
  const totalDueAll = (allPayments || []).reduce((s, p) => s + Number(p.amount), 0)
  const totalCollectedAll = (allPayments || []).reduce((s, p) => s + Number(p.amount_paid || 0), 0)
  const collectionRate = totalDueAll > 0 ? Math.round((totalCollectedAll / totalDueAll) * 100) : 100

  // ─── Monthly income breakdown (last 6 months) ───
  const monthlyData: {
    label: string
    monthKey: string
    subscriptionIncome: number
    oneOffIncome: number
    totalIncome: number
    newSignups: number
    churnedSubs: number
  }[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })

    // One-off payments collected this month
    const monthPayments = (allPayments || []).filter((p) => p.paid_date?.substring(0, 7) === monthKey)
    const oneOffIncome = monthPayments.reduce((s, p) => s + Number(p.amount_paid || 0), 0)

    // Subscription income = MRR (same each month for active subs)
    // For past months, estimate from subs created before that month and not canceled
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString()
    const subsActiveInMonth = (allSubscriptions || []).filter((s) => {
      const created = s.created_at
      const isActive = s.status === 'active' || s.status === 'trialing'
      const isCanceled = s.status === 'canceled'
      if (created > monthEnd) return false
      if (isCanceled && s.cancel_at_period_end) return true // was active during the month
      return isActive || created <= monthEnd
    })
    const subscriptionIncome = subsActiveInMonth.reduce((sum, s) => {
      const plan = s.plan as unknown as SubscriptionPlan
      return sum + (plan ? Number(plan.amount) : 0)
    }, 0)

    // New parent signups this month
    const newSignups = (allParents || []).filter((p) => p.created_at?.substring(0, 7) === monthKey).length

    // Churned subs this month
    const churnedSubs = canceledSubs.filter((s) => {
      const updated = s.updated_at || s.created_at
      return updated?.substring(0, 7) === monthKey
    }).length

    monthlyData.push({
      label,
      monthKey,
      subscriptionIncome,
      oneOffIncome,
      totalIncome: subscriptionIncome + oneOffIncome,
      newSignups,
      churnedSubs,
    })
  }

  // Growth rate (month over month)
  const lastMonth = monthlyData[monthlyData.length - 1]?.totalIncome || 0
  const prevMonth = monthlyData[monthlyData.length - 2]?.totalIncome || 0
  const growthRate = prevMonth > 0 ? Math.round(((lastMonth - prevMonth) / prevMonth) * 100) : 0

  // Churn rate
  const churnRate = activeSubsList.length > 0
    ? Math.round((canceledSubs.length / (activeSubsList.length + canceledSubs.length)) * 100)
    : 0

  // ─── Plan breakdown ───
  const planBreakdown = activePlans.map((plan) => {
    const subs = activeSubsList.filter((s) => s.plan_id === plan.id)
    const monthlyValue = subs.length * Number(plan.amount)
    return {
      name: plan.name,
      activeSubs: subs.length,
      monthlyValue,
      percentage: monthlyRecurring > 0 ? (monthlyValue / monthlyRecurring) * 100 : 0,
    }
  }).filter((p) => p.activeSubs > 0).sort((a, b) => b.monthlyValue - a.monthlyValue)

  // ─── Revenue by parent ───
  const parentRevenueMap = new Map<string, { name: string; subscriptions: number; oneOff: number }>()

  for (const sub of activeSubsList) {
    const parent = sub.parent as unknown as { full_name: string } | null
    const plan = sub.plan as unknown as SubscriptionPlan
    if (!parent || !plan) continue
    const existing = parentRevenueMap.get(sub.parent_id) || { name: parent.full_name, subscriptions: 0, oneOff: 0 }
    existing.subscriptions += Number(plan.amount)
    parentRevenueMap.set(sub.parent_id, existing)
  }

  for (const p of allPayments || []) {
    const paid = Number(p.amount_paid || 0)
    if (paid <= 0) continue
    const existing = parentRevenueMap.get(p.parent_id)
    if (existing) {
      existing.oneOff += paid
    } else {
      const parentProfile = (allParents || []).find((pr) => pr.id === p.parent_id)
      parentRevenueMap.set(p.parent_id, {
        name: parentProfile?.full_name || '—',
        subscriptions: 0,
        oneOff: paid,
      })
    }
  }

  const topParents = [...parentRevenueMap.values()]
    .map((p) => ({ ...p, total: p.subscriptions + p.oneOff }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // ─── Basic stats for overview ───
  const stats = {
    totalDue: totalDueAll,
    totalCollected: totalCollectedAll,
    overdueCount: (allPayments || []).filter((p) => p.status === 'overdue').length,
    unpaidCount: (allPayments || []).filter((p) => p.status === 'unpaid' || p.status === 'partial').length,
    paidCount: (allPayments || []).filter((p) => p.status === 'paid').length,
    activeSubs: activeSubsList.length,
    monthlyRevenue: monthlyRecurring,
  }

  const filters = [
    { key: 'all', label: 'All', count: (allPayments || []).length },
    { key: 'overdue', label: 'Overdue', count: stats.overdueCount },
    { key: 'unpaid', label: 'Unpaid / Partial', count: stats.unpaidCount },
    { key: 'paid', label: 'Paid', count: stats.paidCount },
  ]

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'analytics', label: 'Financial Analytics' },
    { key: 'manage', label: 'Manage' },
  ]

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Payments & Subscriptions</h1>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white/[0.05] rounded-lg p-1">
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href={`/dashboard/payments?tab=${tab.key}`}
            className={`flex-1 text-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[#4ecde6] text-[#0a0a0a] shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Overdue summary banner */}
      {stats.overdueCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm text-red-400 font-medium">
              {stats.overdueCount} overdue payment{stats.overdueCount !== 1 ? 's' : ''} totalling&nbsp;
              &pound;{(allPayments || [])
                .filter((p) => p.status === 'overdue')
                .reduce((sum, p) => sum + (Number(p.amount) - Number(p.amount_paid || 0)), 0)
                .toFixed(2)}
            </span>
          </div>
          <a
            href="/dashboard/payments?tab=overview&filter=overdue"
            className="text-xs text-red-400 hover:text-red-300 font-medium whitespace-nowrap ml-3"
          >
            View All &rarr;
          </a>
        </div>
      )}

      {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Monthly Recurring */}
            <div className="relative overflow-hidden bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-[#4ecde6]/10 blur-2xl rounded-full pointer-events-none" aria-hidden />
              <span className="w-8 h-8 rounded-lg bg-[#4ecde6]/15 border border-[#4ecde6]/25 flex items-center justify-center text-[#4ecde6] mb-2.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </span>
              <div className="text-2xl font-bold text-white">&pound;{stats.monthlyRevenue.toFixed(0)}</div>
              <div className="text-xs text-white/60 mt-0.5">Monthly Recurring</div>
              <div className="text-[11px] text-white/40 mt-1">&pound;{projectedAnnual.toFixed(0)}/yr projected</div>
            </div>
            {/* Active Subs */}
            <div className="relative overflow-hidden bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-emerald-500/10 blur-2xl rounded-full pointer-events-none" aria-hidden />
              <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-300 mb-2.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 00-3-3.87" /></svg>
              </span>
              <div className="text-2xl font-bold text-emerald-300">{stats.activeSubs}</div>
              <div className="text-xs text-white/60 mt-0.5">Active Subs</div>
              <div className="text-[11px] text-white/40 mt-1">of {(allSubscriptions || []).length} total</div>
            </div>
            {/* Collected */}
            <div className="relative overflow-hidden bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-[#4ecde6]/10 blur-2xl rounded-full pointer-events-none" aria-hidden />
              <span className="w-8 h-8 rounded-lg bg-[#4ecde6]/15 border border-[#4ecde6]/25 flex items-center justify-center text-[#4ecde6] mb-2.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </span>
              <div className="text-2xl font-bold text-white">&pound;{stats.totalCollected.toFixed(0)}</div>
              <div className="text-xs text-white/60 mt-0.5">Collected</div>
              <div className="text-[11px] text-white/40 mt-1">{collectionRate}% collection rate</div>
            </div>
            {/* Overdue */}
            <div className={`relative overflow-hidden bg-white/[0.05] backdrop-blur-xl border rounded-2xl p-5 ${stats.overdueCount > 0 ? 'border-red-500/30' : 'border-white/[0.08]'}`}>
              <div className={`absolute -top-6 -right-6 w-20 h-20 ${stats.overdueCount > 0 ? 'bg-red-500/15' : 'bg-white/[0.04]'} blur-2xl rounded-full pointer-events-none`} aria-hidden />
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 border ${stats.overdueCount > 0 ? 'bg-red-500/15 border-red-500/25 text-red-300' : 'bg-white/[0.06] border-white/[0.12] text-white/50'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </span>
              <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-red-400' : 'text-white'}`}>{stats.overdueCount}</div>
              <div className="text-xs text-white/60 mt-0.5">Overdue</div>
              <div className={`text-[11px] mt-1 ${stats.overdueCount > 0 ? 'text-red-400/70' : 'text-white/40'}`}>{stats.overdueCount > 0 ? 'Needs attention' : 'All clear'}</div>
            </div>
          </div>

          {/* Active Subscriptions Table */}
          {(allSubscriptions || []).length > 0 && (
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5"><h2 className="text-lg font-semibold text-white mb-4">Subscriptions</h2>
              <div className="space-y-2">
                {(allSubscriptions || []).map((sub) => {
                  const plan = sub.plan as unknown as SubscriptionPlan
                  const player = sub.player as unknown as { first_name: string; last_name: string } | null
                  const parent = sub.parent as unknown as { full_name: string } | null
                  const periodEnd = sub.current_period_end
                    ? new Date(sub.current_period_end).toLocaleDateString()
                    : '—'

                  return (
                    <div
                      key={sub.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {adminInitialsChip(parent?.full_name || '')}
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate text-white">
                            {parent?.full_name || '—'}
                            {player && (
                              <span className="text-white/55 font-normal">
                                {' '}&middot; {player.first_name} {player.last_name}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-white/55 mt-0.5">
                            <span className="text-white/75 font-medium">&pound;{plan ? Number(plan.amount).toFixed(0) : '—'}</span>/mo &middot; Next: {periodEnd}
                          </div>
                        </div>
                      </div>
                      {adminSubStatusPill(sub.status)}
                      <SubscriptionActions
                        subscriptionId={sub.id}
                        currentStatus={sub.status}
                        currentPlanId={sub.plan_id}
                        plans={activePlans}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent" />

          {/* One-off Payments */}
          <div className="border-t border-white/[0.08] pt-6 space-y-4">
            <h2 className="text-lg font-semibold">One-off Payments</h2>

            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <a
                  key={f.key}
                  href={`/dashboard/payments?tab=overview${f.key !== 'all' ? `&filter=${f.key}` : ''}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filter === f.key
                      ? 'bg-[#4ecde6] text-[#0a0a0a]'
                      : 'bg-white/[0.05] text-white/60 hover:bg-border'
                  }`}
                >
                  {f.label} ({f.count})
                </a>
              ))}
            </div>

            {(payments || []).length === 0 ? (
              <EmptyState message={filter === 'all' ? 'No payments recorded yet.' : `No ${filter} payments.`} />
            ) : (
              <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-white/45">
                        <th className="text-left py-2.5 font-semibold">Parent</th>
                        <th className="text-left py-2.5 font-semibold">Player</th>
                        <th className="text-left py-2.5 font-semibold hidden md:table-cell">Description</th>
                        <th className="text-right py-2.5 font-semibold">Due</th>
                        <th className="text-right py-2.5 font-semibold">Paid</th>
                        <th className="text-left py-2.5 font-semibold hidden md:table-cell">Due Date</th>
                        <th className="text-left py-2.5 font-semibold">Status</th>
                        <th className="text-left py-2.5 font-semibold w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payments || []).map((p) => (
                        <tr key={p.id} className="border-b border-white/[0.08] last:border-0 hover:bg-white/[0.03]">
                          <td className="py-2.5">
                            <div className="font-medium">{(p.parent as unknown as { full_name: string })?.full_name || '—'}</div>
                            <div className="text-xs text-white/60 hidden md:block">
                              {(p.parent as unknown as { email: string })?.email}
                            </div>
                          </td>
                          <td className="py-2.5">
                            {(p.player as unknown as { first_name: string; last_name: string })
                              ? `${(p.player as unknown as { first_name: string; last_name: string }).first_name} ${(p.player as unknown as { first_name: string; last_name: string }).last_name}`
                              : '—'}
                          </td>
                          <td className="py-2.5 hidden md:table-cell text-white/60">{(p.description as string) || '—'}</td>
                          <td className="py-2.5 font-medium text-right tabular-nums">&pound;{Number(p.amount).toFixed(2)}</td>
                          <td className="py-2.5 text-right tabular-nums">
                            <span className={Number(p.amount_paid || 0) >= Number(p.amount) ? 'text-[#4ecde6] font-medium' : 'text-white/70'}>
                              &pound;{Number(p.amount_paid || 0).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2.5 hidden md:table-cell text-white/60">
                            {p.due_date ? new Date(p.due_date as string).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-2.5">
                            <PaymentStatusToggleClient
                              paymentId={p.id as string}
                              currentStatus={p.status as string}
                              amountDue={Number(p.amount)}
                              currentAmountPaid={Number(p.amount_paid || 0)}
                            />
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/dashboard/payments/invoice/${p.id}`}
                                className="text-[#4ecde6] hover:text-[#4ecde6]/80 transition-colors"
                                title="View Invoice"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </Link>
                              {p.status === 'overdue' && (
                                <SendReminderButton paymentId={p.id as string} />
                              )}
                              {/* Sprint 6 — WhatsApp deep-link for overdue rows.
                                  Hidden when the parent has no phone — never a
                                  broken link. */}
                              {p.status === 'overdue' && (
                                <WhatsAppButton
                                  phone={(p.parent as unknown as { phone?: string | null })?.phone || null}
                                  message={WA_TEMPLATES.paymentChase({
                                    parentName: (p.parent as unknown as { full_name?: string })?.full_name || 'there',
                                    academyName: adminAcademyName,
                                  })}
                                  iconOnly
                                  testId="overdue-row-whatsapp"
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════ ANALYTICS TAB ═══════════════ */}
      {activeTab === 'analytics' && (
        <>
          <FinancialBreakdown
            monthlyData={monthlyData}
            planBreakdown={planBreakdown}
            topParents={topParents}
            summary={{
              totalLifetimeRevenue,
              monthlyRecurring,
              projectedAnnual,
              avgRevenuePerPlayer,
              avgRevenuePerParent,
              collectionRate,
              activeParents: parentsWithPlayers,
              totalParents: totalParentCount,
              churnRate,
              growthRate,
            }}
          />
          {/* Revenue Sprint 2 — Cancellation Intelligence (read-only, pure-derive) */}
          <CancellationIntelligence
            rows={cancellationsForDerive}
            detectedSubscriptionCancellations={detectedSubscriptionCancellations}
          />
        </>
      )}

      {/* ═══════════════ MANAGE TAB ═══════════════ */}
      {activeTab === 'manage' && (
        <>
          <SubscriptionPlanManager plans={plans || []} orgId={orgId} />

          {activePlans.length > 0 && (
            <AssignSubscription plans={activePlans} players={playersForAssign} orgId={orgId} />
          )}

          <PaymentLinkGenerator />

          <PaymentManager parents={allParents || []} players={allPlayers || []} autoOpen={autoOpen} orgId={orgId} />
        </>
      )}
    </div>
    </div>
  )
}
