import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import ConfirmClient from './ConfirmClient'

export const dynamic = 'force-dynamic'

/**
 * Parent-facing confirmation page for migration invitations.
 * Validates the token, shows the subscription details, and hands off to
 * Stripe Checkout.
 */
export default async function ConfirmSubscriptionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  if (!token || token.length < 10) {
    return <ErrorScreen message="Invalid invitation link." />
  }

  // Use service role — parent isn't logged in yet
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: sub } = await admin
    .from('subscriptions')
    .select(`
      id, status, invite_token, invite_confirmed_at,
      player:players(id, first_name, last_name),
      plan:subscription_plans(id, name, amount, sessions_per_week),
      org:organisations(id, name, slug, primary_color, logo_url, quarterly_billing_enabled, quarterly_discount_percent)
    `)
    .eq('invite_token', token)
    .maybeSingle()

  if (!sub) {
    return <ErrorScreen message="This invitation link is invalid or has expired." />
  }

  if (sub.invite_confirmed_at) {
    return <AlreadyConfirmedScreen />
  }

  if (sub.status !== 'pending_migration') {
    // Subscription was already activated — send them to their dashboard
    redirect('/dashboard')
  }

  const player = (sub.player as unknown as { id: string; first_name: string; last_name: string | null } | null)
  const plan = (sub.plan as unknown as { id: string; name: string; amount: number; sessions_per_week: number } | null)
  const org = (sub.org as unknown as { id: string; name: string; slug: string; primary_color: string | null; logo_url: string | null; quarterly_billing_enabled: boolean | null; quarterly_discount_percent: number | null } | null)

  if (!player || !plan || !org) {
    return <ErrorScreen message="This invitation is missing some details. Please contact your academy." />
  }

  return (
    <ConfirmClient
      token={token}
      childName={`${player.first_name} ${player.last_name || ''}`.trim()}
      planName={plan.name}
      planAmount={Number(plan.amount)}
      sessionsPerWeek={plan.sessions_per_week}
      academyName={org.name}
      primaryColor={org.primary_color || '#4ecde6'}
      logoUrl={org.logo_url || null}
      quarterlyEnabled={org.quarterly_billing_enabled !== false}
      quarterlyDiscountPercent={Number(org.quarterly_discount_percent ?? 10)}
    />
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#141414] border border-[#1e1e1e] rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-xl font-bold text-white mb-2">Something&apos;s not right</h1>
        <p className="text-sm text-white/60">{message}</p>
      </div>
    </div>
  )
}

function AlreadyConfirmedScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#141414] border border-[#1e1e1e] rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-white mb-2">Already confirmed</h1>
        <p className="text-sm text-white/60 mb-6">
          This subscription has already been activated. You can manage it from your dashboard.
        </p>
        <a
          href="/dashboard"
          className="inline-block px-6 py-3 rounded-full bg-[#4ecde6] text-[#0a0a0a] font-bold text-sm"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}
