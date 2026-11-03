import { createClient } from '@supabase/supabase-js'
import EmailLoginLink from '@/components/EmailLoginLink'
import ConfirmClient from './ConfirmClient'
import { isQuarterlyEnabledForOrg } from '@/lib/quarterly-billing'

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
      id, status, invite_token, invite_confirmed_at, migration_billing_starts_at,
      parent:profiles!subscriptions_parent_id_fkey(email),
      player:players(id, first_name, last_name, enrolments(status, training_groups(day_of_week))),
      plan:subscription_plans(id, name, amount, sessions_per_week),
      org:organisations(id, name, slug, primary_color, logo_url, quarterly_billing_enabled, quarterly_discount_percent, contact_email, contact_phone)
    `)
    .eq('invite_token', token)
    .maybeSingle()

  if (!sub) {
    return <ErrorScreen message="This invitation link is invalid or has expired." />
  }

  // Already done: never bounce to /dashboard (a parent with no password lands on sign-in and goes
  // round in circles, No.1 GK 29 Oct 2026). Offer the emailed login link instead.
  const parentEmail = ((sub.parent as unknown as { email: string | null } | null)?.email) || ''
  // The academy removed the child and withdrew this invite (src/lib/never-confirmed.ts removeInvitedChild).
  // Say so, and if the months the child came are still owed, offer that bill's pay link.
  if (!sub.invite_confirmed_at && (sub.status === 'canceled' || sub.status === 'cancelled')) {
    const { openBackMonthsBill } = await import('@/lib/never-confirmed')
    const bill = await openBackMonthsBill(admin, sub.id as string)
    const o = sub.org as unknown as { name: string; contact_email?: string | null; contact_phone?: string | null } | null
    const p = sub.player as unknown as { first_name: string } | null
    return <WithdrawnScreen academy={o?.name || 'The academy'} child={p?.first_name || 'Your child'} contact={[o?.contact_email, o?.contact_phone].filter(Boolean).join(' · ')} bill={bill} />
  }
  if (sub.invite_confirmed_at || sub.status !== 'pending_migration') {
    return <AlreadyConfirmedScreen email={parentEmail} />
  }

  const player = (sub.player as unknown as { id: string; first_name: string; last_name: string | null } | null)
  const plan = (sub.plan as unknown as { id: string; name: string; amount: number; sessions_per_week: number } | null)
  const org = (sub.org as unknown as { id: string; name: string; slug: string; primary_color: string | null; logo_url: string | null; quarterly_billing_enabled: boolean | null; quarterly_discount_percent: number | null } | null)

  if (!player || !plan || !org) {
    return <ErrorScreen message="This invitation is missing some details. Please contact your academy." />
  }

  // Preview of today's charge from THE ONE RULE (same function the checkout
  // route uses), so the parent is shown the number they will be charged.
  const { firstChargeFor, firstChargeLabel } = await import('@/lib/billing/sessions')
  const { firstOfNextMonthUnix } = await import('@/lib/billing/anchor')
  const deferredStart = (sub as { migration_billing_starts_at?: string | null }).migration_billing_starts_at
  const deferred = !!deferredStart && new Date(deferredStart).getTime() > Date.now() + 3600 * 1000
  const enrolments = ((player as unknown as { enrolments?: { status: string; training_groups: { day_of_week: string | null } | null }[] }).enrolments) || []
  const classDayOfWeek = enrolments.find((e) => e.status === 'active' || e.status === 'pending')?.training_groups?.day_of_week ?? null
  const todayIso = new Date().toISOString().slice(0, 10)
  const anchorUnix = firstOfNextMonthUnix(new Date())
  const anchorIso = new Date(anchorUnix * 1000).toISOString().slice(0, 10)
  const fc = firstChargeFor(Number(plan.amount), todayIso, anchorIso, classDayOfWeek)
  // A deferred first charge IS the first monthly charge, so the monthly price runs from that
  // date, not from next month. UK time: a 23:00 UTC charge on 30 Sep lands on 1 October here.
  const deferredLabel = deferred ? new Date(deferredStart as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/London' }) : null
  const anchorLabel = deferredLabel ?? new Date(anchorUnix * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })

  return (
    <ConfirmClient
      token={token}
      todayAmount={deferred ? 0 : fc.pence / 100}
      todayLabel={deferred ? `Nothing today — first charge ${deferredLabel}` : firstChargeLabel(fc)}
      anchorLabel={anchorLabel}
      childName={`${player.first_name} ${player.last_name || ''}`.trim()}
      planName={plan.name}
      planAmount={Number(plan.amount)}
      sessionsPerWeek={plan.sessions_per_week}
      academyName={org.name}
      primaryColor={org.primary_color || '#4ecde6'}
      academySlug={org.slug}
      logoUrl={org.logo_url || null}
      quarterlyEnabled={isQuarterlyEnabledForOrg(org.id, org.quarterly_billing_enabled)}
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

function AlreadyConfirmedScreen({ email }: { email: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#141414] border border-[#1e1e1e] rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-white mb-2">Already confirmed</h1>
        <p className="text-sm text-white/60 mb-6">
          You&apos;ve already done this, nothing more to do. To open your account, we&apos;ll email you a login link.
        </p>
        <EmailLoginLink email={email} />
      </div>
    </div>
  )
}

function WithdrawnScreen({ academy, child, contact, bill }: { academy: string; child: string; contact: string; bill: { id: string; amount: number; description: string } | null }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#141414] border border-[#1e1e1e] rounded-2xl p-8 text-center" data-testid="invite-withdrawn">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#4ecde6]">{academy}</p>
        <h1 className="mt-2 text-xl font-bold text-white">This invite has been withdrawn</h1>
        <p className="mt-2 text-sm text-white/60">{child}&apos;s place is no longer being held. To come back, contact the academy.</p>
        {bill && bill.amount > 0 && (
          <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-left">
            <p className="text-sm font-semibold text-white">£{bill.amount.toFixed(2)} still to pay</p>
            <p className="mt-0.5 text-xs text-white/60">{bill.description}</p>
            <a href={`/pay/${bill.id}`} className="mt-3 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black">Pay £{bill.amount.toFixed(2)} now</a>
          </div>
        )}
        {contact && <p className="mt-5 text-xs text-white/40">{contact}</p>}
      </div>
    </div>
  )
}
