import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CancelFlow from './CancelFlow'

export default async function CancelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // Get active subscriptions
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, stripe_subscription_id, status, subscription_plans(name, amount)')
    .eq('parent_id', user.id)
    .in('status', ['active', 'trialing'])

  if (!subscriptions || subscriptions.length === 0) {
    redirect('/dashboard/payments')
  }

  const sub = subscriptions[0]
  const plan = sub.subscription_plans as unknown as { name: string; amount: number } | null

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <CancelFlow
        subscriptionId={sub.stripe_subscription_id}
        planName={plan?.name || 'Subscription'}
        monthlyAmount={Number(plan?.amount || 0)}
      />
    </div>
  )
}
