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
      .select('id, stripe_subscription_id, status, organisation_id, subscription_plans(name, amount)')
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
  const { data: org } = orgIdForRetention
    ? await supabase
        .from('organisations')
        .select('retention_offer_enabled, retention_offer_percent, retention_offer_months')
        .eq('id', orgIdForRetention)
        .single()
    : { data: null }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <CancelFlow
        subscriptionId={sub.stripe_subscription_id}
        planName={plan?.name || 'Subscription'}
        monthlyAmount={Number(plan?.amount || 0)}
        retentionEnabled={org?.retention_offer_enabled !== false}
        retentionPercent={Number(org?.retention_offer_percent ?? 25)}
        retentionMonths={org?.retention_offer_months == null ? null : Number(org.retention_offer_months)}
      />
    </div>
  )
}
