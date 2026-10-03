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
import SendPayLinkButton from './SendPayLinkButton'
import OutstandingInvoices, { toOutstandingRows } from './OutstandingInvoices'
import SubscribeButton from './SubscribeButton'
import ManageBillingButton from './ManageBillingButton'
import SubscriptionPlanManager from './SubscriptionPlanManager'
import AssignSubscription from './AssignSubscription'
import SubscriptionActions from './SubscriptionActions'
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
import MembershipTabs from './MembershipTabs'
import { isQuarterlyEnabledForOrg } from '@/lib/quarterly-billing'
import PayoutsBox from './PayoutsBox'
import MembershipsList, { type MembershipRow } from './MembershipsList'
import { getPayoutSnapshot } from '@/lib/payouts'
import { recoverySummary } from '@/lib/refund-recovery'

// Phase 1A — Membership & Billing safe reskin. Flag OFF (default) ⇒ the parent
// page renders byte-identically to today. Flag ON ⇒ a tabbed, subscription-first
// reskin that REUSES the same section components (preserving every protected
// testid) — presentation only. No Stripe, no billing mutation, no new queries,
// no subscription-control change. See MEMBERSHIP_BILLING_PHASE0A.md.
const MEMBERSHIP_RESKIN_ENABLED = process.env.MEMBERSHIP_RESKIN_ENABLED === 'true'

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
    month?: string
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

  return <AdminPayments autoOpen={params.add === '1'} filter={params.filter || 'all'} month={params.month || 'current'} orgId={orgId} activeTab={params.tab || 'overview'} />
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

  // players_active (migration 109) — parent's own children. A parent must
  // never be shown their own archived child.
  const { data: myPlayers } = await supabase
    .from('players_active')
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

  // Waived (written-off) and refunded rows must not count towards what a
  // parent owes — a waived invoice is the academy saying "you don't owe this".
  // Same rule the player passport already applies (ProgressionPassport.tsx).
  const billablePayments = (payments || []).filter(
    (p) => p.status !== 'waived' && p.status !== 'refunded'
  )
  const totalDue = billablePayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalPaid = billablePayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
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
    quarterly_billing_enabled?: boolean | null
  }
  let orgRow: OrgRow | null = null
  if (orgId) {
    const full = 'name, cancellation_notice_days, cancellation_policy, retention_offer_enabled, retention_offer_percent, retention_offer_months, contact_phone, quarterly_billing_enabled'
    const legacy = 'name, cancellation_notice_days, retention_offer_enabled, retention_offer_percent, retention_offer_months, contact_phone, quarterly_billing_enabled'
    const first = await supabase.from('organisations').select(full).eq('id', orgId).single()
    if (first.error && first.error.code === '42703') {
      const fallback = await supabase.from('organisations').select(legacy).eq('id', orgId).single()
      orgRow = (fallback.data ?? null) as unknown as OrgRow | null
    } else {
      orgRow = (first.data ?? null) as unknown as OrgRow | null
    }
  }
  // Per-org quarterly enablement for the parent hub's upgrade cards. Default OFF
  // unless this academy is allow-listed (or the global flag is on).
  const quarterlyEnabledForOrg = isQuarterlyEnabledForOrg(orgId, orgRow?.quarterly_billing_enabled)
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
  // One-off invoices the parent can pay right now (unpaid/partial/overdue
  // with a balance). Each links to the proven public /pay/[id] flow.
  const outstandingRows = toOutstandingRows(payments || [])

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

  // ════════════════════════════════════════════════════════════════════════
  // Phase 1A — Membership & Billing safe reskin (flag-gated). REUSES the same
  // section components (every protected testid preserved) in a tabbed,
  // subscription-first layout. Presentation only: no new queries, no Stripe,
  // no billing mutation, no subscription-control change. The flag-OFF path
  // below is left byte-identical to today.
  // ════════════════════════════════════════════════════════════════════════
  if (MEMBERSHIP_RESKIN_ENABLED) {
    const primaryPlan = (activeSubs[0]?.plan ?? null) as { name?: string; sessions_per_week?: number } | null
    const spw = Number(primaryPlan?.sessions_per_week ?? 0) || 0
    const whatYouGet = [
      spw > 0 ? `${spw} session${spw === 1 ? '' : 's'} per week` : 'Weekly coaching sessions',
      'Qualified coaches',
      'Small group sizes',
      'Session attendance tracking',
      'Progress reports',
      'Awards & achievements',
    ]
    const banners = (
      <>
        {success && (
          <div className="rounded-lg border border-[#4ecde6]/30 bg-[#4ecde6]/10 px-4 py-3 text-sm font-medium text-[#4ecde6]">Payment successful! Your balance will update shortly.</div>
        )}
        {cancelled && (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-medium text-orange-400">Payment was cancelled. You can try again anytime.</div>
        )}
        {subSuccess && (
          <div className="rounded-lg border border-[#4ecde6]/30 bg-[#4ecde6]/10 px-4 py-3 text-sm font-medium text-[#4ecde6]">Subscription activated! Welcome aboard.</div>
        )}
        {subCancelled && (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-medium text-orange-400">Subscription setup was cancelled. You can subscribe anytime.</div>
        )}
      </>
    )

    const paymentMethodPanel = (
      <div className="rounded-2xl border border-white/10 bg-[#0f1a2b] p-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">Payment Method</p>
        <p className="text-sm text-white/70">Your payment method is managed securely via Stripe.</p>
        {hasStripeCustomer ? (
          <div className="mt-3"><ManageBillingButton /></div>
        ) : (
          <p className="mt-2 text-xs text-white/40">No card on file yet — it&rsquo;s added when you subscribe.</p>
        )}
      </div>
    )

    const quarterlyExplainer = (
      <div className="rounded-2xl border border-[#4ecde6]/20 bg-[#4ecde6]/[0.04] p-5" data-testid="quarterly-explainer">
        <p className="mb-2 text-sm font-semibold text-white">Prefer to pay quarterly?</p>
        <ul className="space-y-1 text-sm text-white/70">
          <li>• Quarterly means paying once every 3 months.</li>
          <li>• Your membership remains active during the full billing period.</li>
          <li>• Cancellation still follows your academy&rsquo;s policy.</li>
          <li>• To ask about quarterly billing, message your academy — this page doesn&rsquo;t switch billing automatically.</li>
        </ul>
        <Link
          href="/dashboard/messages"
          className="mt-3 inline-block rounded-lg border border-[#4ecde6]/30 bg-[#4ecde6]/10 px-4 py-2 text-sm font-semibold text-[#4ecde6] transition hover:bg-[#4ecde6]/20"
        >
          Ask academy about quarterly billing →
        </Link>
      </div>
    )

    const trustBar = (
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-[#0f1a2b] p-4 text-xs text-white/60 sm:grid-cols-4">
        <div><span className="block font-semibold text-white"> Cancel anytime</span>No long-term contracts</div>
        <div><span className="block font-semibold text-white"> Secure payments</span>Powered by Stripe</div>
        <div><span className="block font-semibold text-white"> Save with longer plans</span>Ask about quarterly billing</div>
        <div><span className="block font-semibold text-white"> Dedicated support</span>We&rsquo;re here to help</div>
      </div>
    )

    const overviewPanel = (
      <div className="space-y-6">
        <OutstandingInvoices rows={outstandingRows} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <MembershipOverview activeSubs={activeSubs as Parameters<typeof MembershipOverview>[0]['activeSubs']} outstanding={outstanding} />
            <BillingPanel facts={billingFacts} />
            {paymentMethodPanel}
            {quarterlyExplainer}
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#0f1a2b] p-5">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">What you get</p>
              <ul className="space-y-2 text-sm text-white/80">
                {whatYouGet.map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-emerald-400" aria-hidden></span>{f}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f1a2b] p-5">
              <p className="mb-1 text-sm font-semibold text-white">Need help?</p>
              <p className="mb-3 text-xs text-white/50">Contact the academy about your membership.</p>
              <Link href="/dashboard/messages" className="inline-flex items-center gap-2 rounded-lg bg-[#4ecde6] px-4 py-2 text-sm font-semibold text-[#0a0a0a] transition hover:opacity-90"> Message Academy</Link>
            </div>
          </div>
        </div>

        <MyChildrenList children={childSummaries} />
        <ActiveClassesList classes={activeClassesEnriched} retentionEnabled={retentionEnabled} retentionPercent={retentionPercent} retentionMonths={retentionMonths} />
        <AvailableUpgrades plans={(plans || []) as Parameters<typeof AvailableUpgrades>[0]['plans']} hasActiveSub={activeSubs.length > 0} quarterlyEnabled={quarterlyEnabledForOrg} myChildren={(myPlayers || []).map((p) => ({ id: p.id as string, first_name: p.first_name as string | null, last_name: p.last_name as string | null }))} />
        <MembershipManagement
          hasActiveSub={activeSubs.length > 0}
          noticeDays={cancellationNoticeDays}
          policyText={cancellationPolicy}
          academyName={academyName}
          academyWhatsappPhone={academyWhatsappPhone}
          firstChildFirstName={firstChildFirstName}
        />
        {trustBar}
      </div>
    )

    const fmtGBP = (n: number | null) => (n == null ? '—' : `£${Number(n).toFixed(2)}`)
    const fmtDate = (d: string | null) => {
      if (!d) return '—'
      const t = Date.parse(d)
      return Number.isNaN(t) ? '—' : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }
    const billingHistoryPanel = (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f1a2b] p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-white/40">Billing summary</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-white/60">Last payment</dt><dd className="font-semibold text-white">{fmtGBP(billingFacts.lastPaymentAmount)} · {fmtDate(billingFacts.lastPaymentDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-white/60">Next payment</dt><dd className="font-semibold text-white">{fmtGBP(billingFacts.nextPaymentAmount)} · {fmtDate(billingFacts.nextPaymentDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-white/60">Total paid</dt><dd className="font-semibold text-white">{fmtGBP(billingFacts.totalPaid)}</dd></div>
            <div className="flex justify-between"><dt className="text-white/60">Outstanding</dt><dd className={`font-semibold ${billingFacts.outstanding > 0 ? 'text-red-400' : 'text-white'}`}>{fmtGBP(billingFacts.outstanding)}</dd></div>
          </dl>
          <Link href="/dashboard/payments/statement" className="mt-4 inline-block text-xs font-medium text-[#4ecde6] hover:underline">View full payment history →</Link>
        </div>
        {/* Full BillingPanel preserved for parity (billing-panel testid lives in Overview too). */}
      </div>
    )

    return (
      <div className="min-h-screen -m-6 bg-[#080e18] p-4 text-white sm:p-6 lg:-m-8 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">Membership &amp; Billing</h1>
              <p className="mt-1 text-sm text-white/50">Manage your subscription, billing, and support options.</p>
            </div>
            {hasStripeCustomer && <ManageBillingButton />}
          </div>
          {banners}
          <MembershipTabs
            overview={overviewPanel}
            billingHistory={billingHistoryPanel}
            paymentMethods={paymentMethodPanel}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#080e18] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
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

      <OutstandingInvoices rows={outstandingRows} />

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

      <AvailableUpgrades plans={(plans || []) as Parameters<typeof AvailableUpgrades>[0]['plans']} hasActiveSub={activeSubs.length > 0} quarterlyEnabled={quarterlyEnabledForOrg} myChildren={(myPlayers || []).map((p) => ({ id: p.id as string, first_name: p.first_name as string | null, last_name: p.last_name as string | null }))} />

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
async function AdminPayments({
  autoOpen,
  filter,
  orgId,
  activeTab,
  month,
}: {
  autoOpen: boolean
  filter: string
  orgId: string
  activeTab: string
  month: string
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
    .select('name, stripe_account_id')
    .eq('id', orgId)
    .single()
  const adminAcademyName = (adminOrgRow?.name as string | undefined) || 'the academy'

  // Payouts box — live, read-only view of the academy's own Stripe account.
  // Fail-soft: null when there's no connected account or Stripe is slow.
  const payoutSnapshot = await getPayoutSnapshot(adminOrgRow?.stripe_account_id as string | null | undefined)
  // Refunds Player Portal paid because this academy's Stripe balance was empty (migration 121).
  const refundCover = await recoverySummary(supabase, orgId).catch(() => ({ owedPence: 0, repaidPence: 0, open: [] }))

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
  // players_active (migration 109): you cannot assign a NEW payment to a
  // child who has left. This is a "who is here now" read.
  const { data: playersRaw } = await supabase
    .from('players_active')
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
  // The list defaults to THIS MONTH rather than everything: the old
  // all-time default was silently capped at 200 rows, so an academy past
  // that (Jamie: 288) lost its oldest payments with no indication. A month
  // view is both what an academy actually asks for ("what came in on the
  // 1st?") and safely inside the cap.
  const effectiveMonth = month === 'current' ? new Date().toISOString().slice(0, 7) : month
  let query = supabase
    .from('payments')
    .select('*, parent:profiles!payments_parent_id_fkey(full_name, email, phone), player:players(first_name, last_name)')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (filter === 'overdue') query = query.eq('status', 'overdue')
  else if (filter === 'unpaid') query = query.in('status', ['unpaid', 'partial'])
  else if (filter === 'paid') query = query.eq('status', 'paid')

  // ─── Month window (?month=YYYY-MM) — "what came in on the 1st of August?"
  // Filters on paid_date for settled money, falling back to created_at for
  // rows never paid, so an unpaid August invoice still appears under August.
  if (/^\d{4}-\d{2}$/.test(effectiveMonth)) {
    const from = `${effectiveMonth}-01`
    const [yy, mm] = effectiveMonth.split('-').map(Number)
    const to = new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10)
    query = query.or(
      `and(paid_date.gte.${from},paid_date.lte.${to}),and(paid_date.is.null,created_at.gte.${from}T00:00:00Z,created_at.lte.${to}T23:59:59Z)`
    )
  }

  const { data: payments } = await query

  // ─── Month options for the picker: every month that has payments, newest
  // first, capped at 12 so the row stays one line. Built from allPayments
  // (already fetched for stats) — no extra query. ───
  const monthKeys = [...new Set(
    (allPayments || [])
      .map((p) => ((p.paid_date as string | null) || (p.created_at as string | null) || '').slice(0, 7))
      .filter((k) => /^\d{4}-\d{2}$/.test(k))
  )].sort().reverse().slice(0, 12)
  const monthOptions = monthKeys.map((key) => {
    const [y, m] = key.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1, 1))
    return {
      key,
      short: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      long: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    }
  })
  const selectedMonth = monthOptions.find((m) => m.key === effectiveMonth) || null
  const monthLabel = selectedMonth?.long || null
  const monthRows = selectedMonth
    ? (allPayments || []).filter((p) => (((p.paid_date as string | null) || (p.created_at as string | null) || '').slice(0, 7)) === selectedMonth.key)
    : []
  const monthCollected = monthRows.reduce((s2, p) => s2 + Number(p.amount_paid || 0), 0)
  const monthCount = monthRows.filter((p) => Number(p.amount_paid || 0) > 0).length

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
  // players_active (migration 109). This one is worth being explicit about,
  // because it feeds a FINANCIAL number and the instinct is to leave financial
  // reads on the raw table.
  //
  // It feeds three things, and all three want live players:
  //   • parentsWithPlayers — a current headcount
  //   • avgRevenuePerPlayer = monthlyRecurring / players.length. Dividing
  //     CURRENT recurring revenue by a player count inflated with archived
  //     duplicates understates revenue per player by a third. Using the raw
  //     table here does not make the number more honest, it makes it wrong.
  //   • the PaymentManager assignment picker — same reason as above.
  //
  // The rule is not "financial reads use the raw table". It is that a read
  // covering a PERIOD uses the raw table, and a read describing NOW uses the
  // view. This one describes now.
  const { data: allPlayers } = await supabase
    .from('players_active')
    .select('id, first_name, last_name, parent_id, created_at')
    .eq('organisation_id', orgId)
    .order('first_name')

  // ── WHAT DELIBERATELY STAYS ON THE RAW `players` TABLE ──────────────
  // The embedded reads on payments and subscriptions — `player:players(...)`
  // at lines ~134, ~140, ~736 and ~773 — resolve the CHILD'S NAME against a
  // payment or a subscription that already exists.
  //
  // Those must never be narrowed. A payment made in March by a family whose
  // child left in June is still a real payment, and it has to render with a
  // name on it. Pointing those at players_active would leave the name blank
  // and quietly drop rows from a financial history — which is exactly the
  // failure this change is meant to avoid, in the opposite direction.
  //
  // The split, stated once: a read describing WHO IS HERE NOW uses the view.
  // A read covering a PERIOD, or resolving a name against a record that
  // already happened, uses the table.

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

  // Collection rate — waived/refunded rows are excluded: written-off money
  // isn't "due", so it must not drag the rate down.
  const billableAll = (allPayments || []).filter(
    (p) => p.status !== 'waived' && p.status !== 'refunded'
  )
  const totalDueAll = billableAll.reduce((s, p) => s + Number(p.amount), 0)
  const totalCollectedAll = billableAll.reduce((s, p) => s + Number(p.amount_paid || 0), 0)
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
    { key: 'analytics', label: 'Reports' },
    { key: 'manage', label: 'Plans & invoices' },
  ]

  return (
    <div className="bg-[#080e18] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#eef2f9]">Payments</h1>
        <p className="mt-1 text-sm text-[#93a2ba]">
          <span className="tabular-nums text-[#eef2f9]">&pound;{stats.monthlyRevenue.toFixed(0)}</span> a month from {stats.activeSubs} membership{stats.activeSubs === 1 ? '' : 's'}
          {monthLabel && <> · <span className="tabular-nums text-[#eef2f9]">&pound;{monthCollected.toFixed(0)}</span> taken in {monthLabel}</>}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-[#1d2c42]">
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href={`/dashboard/payments?tab=${tab.key}`}
            className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-[#4ecde6] text-[#eef2f9]'
                : 'border-transparent text-[#93a2ba] hover:text-[#eef2f9]'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Overdue: one quiet line, only when there is something overdue */}
      {stats.overdueCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#1d2c42] bg-[#0f1a2b] px-4 py-3">
          <span className="flex items-center gap-2.5 text-sm text-[#eef2f9]">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#d8a95a]" aria-hidden />
            {stats.overdueCount} overdue payment{stats.overdueCount !== 1 ? 's' : ''}, &pound;{(allPayments || [])
              .filter((p) => p.status === 'overdue')
              .reduce((sum, p) => sum + (Number(p.amount) - Number(p.amount_paid || 0)), 0)
              .toFixed(2)} to collect
          </span>
          <a href="/dashboard/payments?tab=overview&filter=overdue" className="whitespace-nowrap text-xs font-semibold text-[#4ecde6] hover:text-[#eef2f9]">
            See them &rarr;
          </a>
        </div>
      )}

      {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Payouts — when the money lands, and what came out of it */}
          <PayoutsBox snapshot={payoutSnapshot} />

          {/* Refunds Player Portal covered, and what is being taken back from membership payments */}
          {(refundCover.owedPence > 0 || refundCover.repaidPence > 0) && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-5" data-testid="refund-cover">
              <h2 className="text-sm font-semibold text-white">Refunds Player Portal paid for you</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/60">When your Stripe balance is empty, Player Portal pays the parent straight away and takes the amount back from your next membership payments. Parents pay exactly the same.</p>
              <div className="mt-3 flex flex-wrap gap-6 text-sm">
                <div><div className="text-lg font-bold tabular-nums text-white">£{(refundCover.owedPence / 100).toFixed(2)}</div><div className="text-[11px] text-white/50">still to come off your payments</div></div>
                <div><div className="text-lg font-bold tabular-nums text-white">£{(refundCover.repaidPence / 100).toFixed(2)}</div><div className="text-[11px] text-white/50">already taken back</div></div>
              </div>
              {refundCover.open.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-white/60">
                  {refundCover.open.map((r) => (
                    <li key={r.id}>{new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {r.description || 'Refund'} · £{(r.remainingPence / 100).toFixed(2)} to go</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Memberships: search, tabs, one calm row each */}
          {(allSubscriptions || []).length > 0 && (
            <MembershipsList
              plans={activePlans}
              rows={(allSubscriptions || []).map((sub): MembershipRow => {
                const plan = sub.plan as unknown as SubscriptionPlan | null
                const player = sub.player as unknown as { first_name: string; last_name: string } | null
                const parent = sub.parent as unknown as { full_name: string } | null
                const end = sub.current_period_end
                  ? new Date(sub.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })
                  : null
                const live = ['active', 'trialing', 'scheduled', 'past_due'].includes(sub.status)
                return {
                  id: sub.id,
                  status: sub.status,
                  planId: sub.plan_id,
                  parentName: parent?.full_name || '',
                  playerName: player ? `${player.first_name} ${player.last_name}` : null,
                  planName: plan?.name || 'No plan',
                  amount: plan ? Number(plan.amount) : null,
                  nextLabel: live && !sub.cancel_at_period_end ? end : null,
                  endsLabel: live && sub.cancel_at_period_end ? end : null,
                }
              })}
            />
          )}

          {/* One-off Payments */}
          <div className="pt-2 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-[#eef2f9]">Payments and invoices</h2>
                {monthLabel && (
                  <p className="mt-0.5 text-[13px] text-white/45">
                    {monthLabel} · <span className="font-semibold text-[#eef2f9] tabular-nums">£{monthCollected.toFixed(2)}</span> collected across {monthCount} payment{monthCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              {/* Month picker — plain links so it works without JS and the URL is shareable */}
              <div className="flex flex-wrap items-center gap-1.5">
                <a
                  href={`/dashboard/payments?tab=overview&month=all${filter !== 'all' ? `&filter=${filter}` : ''}`}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${month === 'all' ? 'bg-[#4ecde6] text-black' : 'bg-white/[0.06] text-white/50 hover:text-white'}`}
                >All time</a>
                {monthOptions.map((m) => (
                  <a
                    key={m.key}
                    href={`/dashboard/payments?tab=overview&month=${m.key}${filter !== 'all' ? `&filter=${filter}` : ''}`}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${effectiveMonth === m.key ? 'bg-[#4ecde6] text-black' : 'bg-white/[0.06] text-white/50 hover:text-white'}`}
                  >{m.short}</a>
                ))}
              </div>
            </div>

            {(payments || []).length >= 1000 && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
                Showing the most recent 1,000 payments. Pick a month above, or use Exports for the full history.
              </p>
            )}

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
              <div className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] p-5">
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
                            {/* Click the family to see their full payment history. */}
                            {p.parent_id ? (
                              <Link href={`/dashboard/parents/${p.parent_id}`} className="group/fam block">
                                <div className="font-medium transition-colors group-hover/fam:text-[#4ecde6]">
                                  {(p.parent as unknown as { full_name: string })?.full_name || '—'}
                                </div>
                                <div className="hidden text-xs text-white/60 md:block">
                                  {(p.parent as unknown as { email: string })?.email}
                                </div>
                              </Link>
                            ) : (
                              <>
                                <div className="font-medium">{(p.parent as unknown as { full_name: string })?.full_name || '—'}</div>
                                <div className="hidden text-xs text-white/60 md:block">
                                  {(p.parent as unknown as { email: string })?.email}
                                </div>
                              </>
                            )}
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
                            {p.due_date ? new Date(p.due_date as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
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
                              {/* Email the parent a link to pay this invoice.
                                  Raising an invoice notifies nobody on its own,
                                  so unpaid/partial/overdue rows get an explicit
                                  send action. Settled rows never show it. */}
                              {(p.status === 'unpaid' ||
                                p.status === 'partial' ||
                                p.status === 'overdue') && (
                                <SendPayLinkButton paymentId={p.id as string} />
                              )}
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

          <div>
            <h2 className="text-[15px] font-semibold text-[#eef2f9]">Do it by hand</h2>
            <p className="mt-0.5 text-xs text-[#93a2ba]">For the odd case where a parent can&rsquo;t sign up or pay online themselves.</p>
          </div>
          {activePlans.length > 0 && (
            <AssignSubscription plans={activePlans} players={playersForAssign} orgId={orgId} />
          )}

          {/* PaymentLinkGenerator disabled 2026-07-17: the payment-link route
              creates links on the PLATFORM Stripe account (no Connect routing,
              no application fee, no ledger row) so funds would bypass the
              academy entirely. Never used in production (verified via Stripe:
              zero payment links). Re-enable once /api/stripe/payment-link
              gets the standard Connect treatment. */}

          <PaymentManager parents={allParents || []} players={allPlayers || []} autoOpen={autoOpen} orgId={orgId} />
        </>
      )}
    </div>
    </div>
  )
}
