import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/StatusBadge'
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
import CancelSubscriptionButton from './CancelSubscriptionButton'
import FinancialBreakdown from './FinancialBreakdown'

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

  if (role === 'parent')
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
    .select('id, first_name, last_name')
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

  const totalDue = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
  const outstanding = totalDue - totalPaid
  const overdueCount = (payments || []).filter((p) => p.status === 'overdue').length

  const monthlyTotal = activeSubs.reduce((sum, s) => {
    const plan = s.plan as unknown as SubscriptionPlan
    return sum + (plan ? Number(plan.amount) : 0)
  }, 0)

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Payments & Subscriptions</h1>
        {hasStripeCustomer && <ManageBillingButton />}
      </div>

      {success && (
        <div className="bg-[#4ecde6]/10 border border-[#4ecde6]/30 text-[#4ecde6] rounded-lg px-4 py-3 text-sm font-medium">
          Payment successful! Your balance will update shortly.
        </div>
      )}
      {cancelled && (
        <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg px-4 py-3 text-sm font-medium">
          Payment was cancelled. You can try again anytime.
        </div>
      )}
      {subSuccess && (
        <div className="bg-[#4ecde6]/10 border border-[#4ecde6]/30 text-[#4ecde6] rounded-lg px-4 py-3 text-sm font-medium">
          Subscription activated! Welcome aboard.
        </div>
      )}
      {subCancelled && (
        <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg px-4 py-3 text-sm font-medium">
          Subscription setup was cancelled. You can subscribe anytime.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className="text-xl font-bold text-[#4ecde6]">&pound;{monthlyTotal.toFixed(0)}</div>
            <div className="text-xs text-white/60 mt-0.5">Monthly</div>
          </div>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className={`text-xl font-bold ${outstanding > 0 ? 'text-orange-400' : 'text-[#4ecde6]'}`}>
              &pound;{outstanding.toFixed(2)}
            </div>
            <div className="text-xs text-white/60 mt-0.5">Outstanding</div>
          </div>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className="text-xl font-bold text-accent">&pound;{totalPaid.toFixed(2)}</div>
            <div className="text-xs text-white/60 mt-0.5">Total Paid</div>
          </div>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center">
            <div className={`text-xl font-bold ${overdueCount > 0 ? 'text-red-400' : 'text-[#4ecde6]'}`}>
              {overdueCount}
            </div>
            <div className="text-xs text-white/60 mt-0.5">Overdue</div>
          </div>
        </div>
      </div>

      {activeSubs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Your Subscriptions</h2>
          {activeSubs.map((sub) => {
            const plan = sub.plan as unknown as SubscriptionPlan
            const player = sub.player as unknown as { first_name: string; last_name: string } | null
            const periodEnd = sub.current_period_end
              ? new Date(sub.current_period_end).toLocaleDateString()
              : null

            return (
              <div key={sub.id} className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
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
                    <div className="text-xs text-white/60 mt-1 space-y-0.5">
                      <div>&pound;{plan ? Number(plan.amount).toFixed(2) : '—'}/month</div>
                      {periodEnd && <div>Next payment: {periodEnd}</div>}
                      {sub.cancel_at_period_end && (
                        <div className="text-orange-400 font-medium">Cancels at end of period</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={sub.status} />
                    {!sub.cancel_at_period_end && (
                      <CancelSubscriptionButton
                        subscriptionId={sub.id}
                        planName={plan?.name || 'Subscription'}
                        amount={plan ? Number(plan.amount) : 0}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

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

      {bookedClasses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Your Booked Classes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bookedClasses.map((bc) => {
              const player = (myPlayers || []).find((p) => p.id === bc.player_id)
              const group = bc.group
              const isToday =
                group?.day_of_week ===
                new Date().toLocaleDateString('en-GB', { weekday: 'long' })

              return (
                <div
                  key={bc.id}
                  className={`rounded-xl border p-4 ${
                    isToday ? 'border-[#4ecde6] bg-[#4ecde6]/5 ring-1 ring-[#4ecde6]/20' : 'border-white/[0.08] bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-semibold text-sm">{group?.name || 'Class'}</div>
                    {isToday && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[#4ecde6]/10 text-[#4ecde6] font-medium">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-[#4ecde6]">{group?.day_of_week || '—'}</span>
                      {group?.time_slot && (
                        <span className="text-primary font-medium">{group.time_slot}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/60">
                      {group?.location && <span>{group.location}</span>}
                      {group?.coach?.full_name && <span>{group.coach.full_name}</span>}
                    </div>
                    {player && (
                      <div className="flex items-center gap-1.5 text-xs pt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4ecde6]" />
                        <span className="text-[#4ecde6] font-medium">
                          {player.first_name} {player.last_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="text-center">
            <a
              href="/dashboard/schedule"
              className="text-xs text-[#4ecde6] hover:underline font-medium"
            >
              View full schedule & book more classes &rarr;
            </a>
          </div>
        </div>
      )}

      {bookedClasses.length === 0 && (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-white/60">No classes booked yet.</p>
            <a
              href="/dashboard/schedule"
              className="inline-block px-4 py-2 bg-[#4ecde6] text-[#0a0a0a] rounded-lg text-sm font-medium hover:bg-[#4ecde6]/90 transition-colors"
            >
              Browse & Book Classes
            </a>
          </div>
        </div>
      )}

      {(plans || []).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            {activeSubs.length > 0 ? 'Change or Add Plan' : 'Choose a Plan'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(plans || []).map((plan) => {
              const existingForPlan = activeSubs.filter((s) => s.plan_id === plan.id)
              const subscribedPlayerIds = existingForPlan.map((s) => s.player_id)
              const unsubscribedPlayers = (myPlayers || []).filter(
                (p) => !subscribedPlayerIds.includes(p.id)
              )
              const isFullySubscribed = unsubscribedPlayers.length === 0 && existingForPlan.length > 0

              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-4 ${
                    isFullySubscribed
                      ? 'border-[#4ecde6]/30 bg-[#4ecde6]/5'
                      : 'border-white/[0.08] bg-white/[0.05]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{plan.name}</div>
                        {plan.description && (
                          <div className="text-xs text-white/60 mt-0.5">{plan.description}</div>
                        )}
                      </div>
                      {isFullySubscribed && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-[#4ecde6]/10 text-[#4ecde6] font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-white">&pound;{Number(plan.amount).toFixed(0)}</span>
                      <span className="text-sm text-white/60">/month</span>
                    </div>
                    <div className="text-xs text-white/60">
                      {plan.sessions_per_week} session{plan.sessions_per_week !== 1 ? 's' : ''} per week
                    </div>

                    {existingForPlan.length > 0 && (
                      <div className="space-y-1">
                        {existingForPlan.map((sub) => {
                          const player = sub.player as unknown as { first_name: string; last_name: string } | null
                          return (
                            <div key={sub.id} className="flex items-center gap-1.5 text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#4ecde6]" />
                              <span className="text-[#4ecde6] font-medium">
                                {player ? `${player.first_name} ${player.last_name}` : 'Subscribed'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!isFullySubscribed && unsubscribedPlayers.length > 0 && (
                      <div className="space-y-2">
                        {unsubscribedPlayers.map((player) => (
                          <SubscribeButton
                            key={player.id}
                            planId={plan.id}
                            planName={plan.name}
                            amount={plan.amount}
                            interval={plan.interval}
                            playerId={player.id}
                            label={`Subscribe ${player.first_name}`}
                          />
                        ))}
                      </div>
                    )}

                    {!isFullySubscribed && unsubscribedPlayers.length === 0 && existingForPlan.length === 0 && (
                      <SubscribeButton
                        planId={plan.id}
                        planName={plan.name}
                        amount={plan.amount}
                        interval={plan.interval}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Payment History</h2>
        {(payments || []).length === 0 ? (
          <EmptyState message="No payment records found." />
        ) : (
          <div className="space-y-2">
            {(payments || []).map((p) => {
              const due = Number(p.amount)
              const paid = Number(p.amount_paid || 0)
              const remaining = due - paid
              const pct = due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0
              const canPay = remaining > 0 && p.status !== 'paid'

              return (
                <div key={p.id} className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm">{p.description || 'Payment'}</div>
                        <div className="text-xs text-white/60">
                          {(p.player as unknown as { first_name: string; last_name: string })
                            ? `${(p.player as unknown as { first_name: string; last_name: string }).first_name} ${(p.player as unknown as { first_name: string; last_name: string }).last_name}`
                            : ''}
                          {p.due_date && ` · Due ${new Date(p.due_date).toLocaleDateString()}`}
                        </div>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">
                        &pound;{paid.toFixed(2)} of &pound;{due.toFixed(2)}
                      </span>
                      <span className="font-medium">
                        {p.status === 'paid' ? 'Paid in full' : `${pct}% paid`}
                      </span>
                    </div>
                    <div className="w-full bg-white/[0.05] rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          p.status === 'paid'
                            ? 'bg-[#4ecde6]'
                            : p.status === 'overdue'
                              ? 'bg-red-400'
                              : 'bg-[#4ecde6]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {canPay && (
                      <div className="pt-1">
                        <PayNowButton paymentId={p.id as string} remaining={remaining} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   ADMIN VIEW
   ═══════════════════════════════════════════════ */
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

  // ─── Subscription Plans ───
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('sort_order')

  const activePlans = (plans || []).filter((p) => p.active)

  // ─── All Subscriptions ───
  const { data: allSubscriptions } = await supabase
    .from('subscriptions')
    .select('*, plan:subscription_plans(*), player:players(first_name, last_name), parent:profiles!subscriptions_parent_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  // ─── Players with parent names for assignment ───
  const { data: playersRaw } = await supabase
    .from('players')
    .select('id, first_name, last_name, parent_id, parent:profiles!players_parent_id_fkey(full_name)')
    .order('first_name')

  const playersForAssign = (playersRaw || []).map((p) => ({
    id: p.id as string,
    first_name: p.first_name as string,
    last_name: p.last_name as string,
    parent_id: p.parent_id as string,
    parent_name: (p.parent as unknown as { full_name: string })?.full_name || '—',
  }))

  // ─── All Payments (for stats + financial breakdown) ───
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount, amount_paid, status, parent_id, created_at, paid_date')

  // ─── Filtered payments for list ───
  let query = supabase
    .from('payments')
    .select('*, parent:profiles!payments_parent_id_fkey(full_name, email), player:players(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (filter === 'overdue') query = query.eq('status', 'overdue')
  else if (filter === 'unpaid') query = query.in('status', ['unpaid', 'partial'])
  else if (filter === 'paid') query = query.eq('status', 'paid')

  const { data: payments } = await query

  // ─── All Parents (with signup dates) ───
  const { data: allParents } = await supabase
    .from('profiles')
    .select('id, full_name, created_at')
    .eq('role', 'parent')
    .order('full_name')

  // ─── All Players ───
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name, parent_id, created_at')
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
  const projectedAnnual = monthlyRecurring * 12 + totalLifetimeRevenue

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
                ? 'bg-white bg-[#4ecde6] text-[#0a0a0a] shadow-sm'
                : 'text-white/60 hover:text-text'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">&pound;{stats.monthlyRevenue.toFixed(0)}</div>
                <div className="text-xs text-white/60 mt-0.5">Monthly Recurring</div>
              </div>
            </div>
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#4ecde6]">{stats.activeSubs}</div>
                <div className="text-xs text-white/60 mt-0.5">Active Subs</div>
              </div>
            </div>
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">&pound;{stats.totalCollected.toFixed(0)}</div>
                <div className="text-xs text-white/60 mt-0.5">Collected</div>
              </div>
            </div>
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
              <div className="text-center">
                <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-red-400' : 'text-[#4ecde6]'}`}>
                  {stats.overdueCount}
                </div>
                <div className="text-xs text-white/60 mt-0.5">Overdue</div>
              </div>
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
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border border-white/[0.08] hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {parent?.full_name || '—'}
                          {player && (
                            <span className="text-white/60 font-normal">
                              {' '}&middot; {player.first_name} {player.last_name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/60">
                          &pound;{plan ? Number(plan.amount).toFixed(0) : '—'}/mo &middot; Next: {periodEnd}
                        </div>
                      </div>
                      <StatusBadge status={sub.status} />
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
                      <tr className="border-b border-white/[0.08]">
                        <th className="text-left py-2 font-medium">Parent</th>
                        <th className="text-left py-2 font-medium">Player</th>
                        <th className="text-left py-2 font-medium hidden md:table-cell">Description</th>
                        <th className="text-left py-2 font-medium">Due</th>
                        <th className="text-left py-2 font-medium">Paid</th>
                        <th className="text-left py-2 font-medium hidden md:table-cell">Due Date</th>
                        <th className="text-left py-2 font-medium">Status</th>
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
                          <td className="py-2.5 font-medium">&pound;{Number(p.amount).toFixed(2)}</td>
                          <td className="py-2.5">
                            <span className={Number(p.amount_paid || 0) >= Number(p.amount) ? 'text-[#4ecde6] font-medium' : ''}>
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
