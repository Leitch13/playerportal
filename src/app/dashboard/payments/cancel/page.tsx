import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CancelFlow from './CancelFlow'

export default async function CancelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // Get active subscriptions + the academy's retention settings
  const [{ data: subscriptions }, { data: profile }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id, status, organisation_id, current_period_end, subscription_plans(name, amount)')
      .eq('parent_id', user.id)
      .in('status', ['active', 'trialing']),
    supabase
      .from('profiles')
      .select('organisation_id')
      .eq('id', user.id)
      .single(),
  ])

  if (!subscriptions || subscriptions.length === 0) {
    redirect('/dashboard/payments')
  }

  const sub = subscriptions[0]
  const plan = sub.subscription_plans as unknown as { name: string; amount: number } | null

  const orgIdForRetention = (sub as { organisation_id?: string }).organisation_id || profile?.organisation_id

  // Try the post-075 column set first; gracefully fall back to legacy if the
  // migration hasn't been applied yet (mirrors migration-074 pattern so the
  // page renders cleanly during the rollout window).
  type OrgRow = {
    retention_offer_enabled?: boolean
    retention_offer_percent?: number
    retention_offer_months?: number | null
    cancellation_policy?: string | null
    cancellation_notice_days?: number
    name?: string
  }
  let org: OrgRow | null = null
  if (orgIdForRetention) {
    const fullSelect = 'retention_offer_enabled, retention_offer_percent, retention_offer_months, cancellation_policy, cancellation_notice_days, name'
    const fallbackSelect = 'retention_offer_enabled, retention_offer_percent, retention_offer_months, cancellation_notice_days, name'
    const first = await supabase
      .from('organisations')
      .select(fullSelect)
      .eq('id', orgIdForRetention)
      .single()
    if (first.error && first.error.code === '42703') {
      const fallback = await supabase
        .from('organisations')
        .select(fallbackSelect)
        .eq('id', orgIdForRetention)
        .single()
      org = (fallback.data ?? null) as unknown as OrgRow | null
    } else {
      org = (first.data ?? null) as unknown as OrgRow | null
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <CancelFlow
        subscriptionId={sub.stripe_subscription_id}
        planName={plan?.name || 'Subscription'}
        monthlyAmount={Number(plan?.amount || 0)}
        retentionEnabled={org?.retention_offer_enabled !== false}
        retentionPercent={Number(org?.retention_offer_percent ?? 50)}
        retentionMonths={
          org?.retention_offer_months === undefined
            ? 1
            : org.retention_offer_months == null
              ? null
              : Number(org.retention_offer_months)
        }
        cancellationPolicy={org?.cancellation_policy ?? null}
        cancellationNoticeDays={Number(org?.cancellation_notice_days ?? 0)}
        academyName={org?.name || 'your academy'}
        currentPeriodEnd={(sub as { current_period_end?: string | null }).current_period_end ?? null}
      />
    </div>
  )
}
