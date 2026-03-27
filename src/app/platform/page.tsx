import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import PlatformDashboard from './PlatformDashboard'

export const metadata = { title: 'Platform Admin' }

/* helper: months ago date as ISO string */
function monthsAgo(n: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfMonth() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfLastMonth() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default async function PlatformPage() {
  /* ── Auth check ── */
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) redirect('/dashboard')

  /* ── Service-role client (bypasses RLS) ── */
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  /* ── Fetch all organisations with plan info ── */
  const { data: orgs } = await admin
    .from('organisations')
    .select('id, name, slug, logo_url, created_at, platform_plan_id, platform_subscription_status, platform_trial_ends_at, platform_stripe_subscription_id')
    .order('created_at', { ascending: false })

  const allOrgs = orgs || []
  const orgIds = allOrgs.map(o => o.id)

  /* ── Platform plans lookup ── */
  const { data: plans } = await admin.from('platform_plans').select('*')
  const planMap: Record<string, { name: string; slug: string; monthly_price: number; transaction_fee_percent: number }> = {}
  for (const p of plans || []) {
    planMap[p.id] = { name: p.name, slug: p.slug, monthly_price: Number(p.monthly_price), transaction_fee_percent: Number(p.transaction_fee_percent) }
  }

  /* ── Player counts per org ── */
  const { data: playerRows } = await admin
    .from('players')
    .select('organisation_id')
  const playerCountMap: Record<string, number> = {}
  let totalPlayers = 0
  for (const r of playerRows || []) {
    playerCountMap[r.organisation_id] = (playerCountMap[r.organisation_id] || 0) + 1
    totalPlayers++
  }

  /* ── Parent counts per org ── */
  const { data: parentRows } = await admin
    .from('profiles')
    .select('organisation_id')
    .eq('role', 'parent')
  const parentCountMap: Record<string, number> = {}
  let totalParents = 0
  for (const r of parentRows || []) {
    parentCountMap[r.organisation_id] = (parentCountMap[r.organisation_id] || 0) + 1
    totalParents++
  }

  /* ── Class counts per org ── */
  const { data: classRows } = await admin
    .from('training_groups')
    .select('organisation_id')
  const classCountMap: Record<string, number> = {}
  for (const r of classRows || []) {
    classCountMap[r.organisation_id] = (classCountMap[r.organisation_id] || 0) + 1
  }

  /* ── Payment totals per org (parent payments this month) ── */
  const som = startOfMonth()
  const { data: paymentRows } = await admin
    .from('payments')
    .select('organisation_id, amount')
    .eq('status', 'paid')
    .gte('created_at', som)
  const paymentMap: Record<string, number> = {}
  let totalPaymentsThisMonth = 0
  for (const r of paymentRows || []) {
    const amt = Number(r.amount) || 0
    paymentMap[r.organisation_id] = (paymentMap[r.organisation_id] || 0) + amt
    totalPaymentsThisMonth += amt
  }

  /* ── MRR from platform subscriptions ── */
  const activeOrgs = allOrgs.filter(o => o.platform_subscription_status === 'active' || o.platform_subscription_status === 'trial')
  let mrr = 0
  for (const o of activeOrgs) {
    const plan = o.platform_plan_id ? planMap[o.platform_plan_id] : null
    if (plan) mrr += plan.monthly_price
  }

  /* ── Transaction fee revenue this month ── */
  let totalTxFees = 0
  for (const o of allOrgs) {
    const plan = o.platform_plan_id ? planMap[o.platform_plan_id] : null
    const orgPayments = paymentMap[o.id] || 0
    if (plan && orgPayments > 0) {
      totalTxFees += orgPayments * (plan.transaction_fee_percent / 100)
    }
  }

  /* ── New signups this month / last month ── */
  const slm = startOfLastMonth()
  const newOrgsThisMonth = allOrgs.filter(o => o.created_at >= som).length
  const newOrgsLastMonth = allOrgs.filter(o => o.created_at >= slm && o.created_at < som).length

  /* ── Churn (cancelled this month) ── */
  const cancelledThisMonth = allOrgs.filter(o => o.platform_subscription_status === 'cancelled').length

  /* ── Monthly revenue data for chart (last 6 months) ── */
  const monthlyRevenue: { month: string; subscriptions: number; fees: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const label = d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
    // Approximate: subscription revenue = MRR for each month (simplified)
    // Transaction fees based on payments in that month
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()

    const { data: mPayments } = await admin
      .from('payments')
      .select('organisation_id, amount')
      .eq('status', 'paid')
      .gte('created_at', mStart)
      .lt('created_at', mEnd)

    let mFees = 0
    for (const p of mPayments || []) {
      const org = allOrgs.find(o => o.id === p.organisation_id)
      const plan = org?.platform_plan_id ? planMap[org.platform_plan_id] : null
      if (plan) mFees += (Number(p.amount) || 0) * (plan.transaction_fee_percent / 100)
    }

    monthlyRevenue.push({ month: label, subscriptions: mrr, fees: Math.round(mFees * 100) / 100 })
  }

  /* ── At-risk academies ── */
  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const trialEndingSoon = allOrgs.filter(o =>
    o.platform_subscription_status === 'trial' &&
    o.platform_trial_ends_at &&
    o.platform_trial_ends_at <= threeDaysFromNow &&
    o.platform_trial_ends_at >= now.toISOString()
  )
  const pastDueOrgs = allOrgs.filter(o => o.platform_subscription_status === 'past_due')
  const inactiveOrgs = allOrgs.filter(o => (playerCountMap[o.id] || 0) === 0)

  /* ── Build org table data ── */
  const academyRows = allOrgs.map(o => {
    const plan = o.platform_plan_id ? planMap[o.platform_plan_id] : null
    const orgPayments = paymentMap[o.id] || 0
    const txFee = plan ? orgPayments * (plan.transaction_fee_percent / 100) : 0
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: plan?.name || 'No plan',
      status: (o.platform_subscription_status || 'trial') as string,
      players: playerCountMap[o.id] || 0,
      parents: parentCountMap[o.id] || 0,
      classes: classCountMap[o.id] || 0,
      monthlyRevenue: Math.round(orgPayments * 100) / 100,
      txFees: Math.round(txFee * 100) / 100,
      trialEnds: o.platform_trial_ends_at || null,
      createdAt: o.created_at,
    }
  })

  /* ── Recent activity ── */
  const recentSignups = allOrgs.slice(0, 10).map(o => ({
    name: o.name,
    date: o.created_at,
    status: o.platform_subscription_status || 'trial',
  }))

  const avgRevenuePerAcademy = activeOrgs.length > 0
    ? Math.round((mrr / activeOrgs.length) * 100) / 100
    : 0

  const churnRate = allOrgs.length > 0
    ? Math.round((cancelledThisMonth / allOrgs.length) * 100 * 10) / 10
    : 0

  return (
    <PlatformDashboard
      mrr={mrr}
      totalAcademies={allOrgs.filter(o => o.platform_subscription_status !== 'cancelled').length}
      totalPlayers={totalPlayers}
      totalParents={totalParents}
      txFeesThisMonth={Math.round(totalTxFees * 100) / 100}
      monthlyRevenue={monthlyRevenue}
      academyRows={academyRows}
      newOrgsThisMonth={newOrgsThisMonth}
      newOrgsLastMonth={newOrgsLastMonth}
      churnRate={churnRate}
      avgRevenuePerAcademy={avgRevenuePerAcademy}
      totalPaymentsThisMonth={Math.round(totalPaymentsThisMonth * 100) / 100}
      recentSignups={recentSignups}
      atRisk={{
        trialEndingSoon: trialEndingSoon.map(o => ({ name: o.name, trialEnds: o.platform_trial_ends_at! })),
        pastDue: pastDueOrgs.map(o => ({ name: o.name })),
        inactive: inactiveOrgs.map(o => ({ name: o.name })),
      }}
    />
  )
}
