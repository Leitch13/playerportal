import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgFeatures, FEATURE_LABELS, FEATURE_MIN_TIER, tierLabel, type FeatureKey, type PlanTier } from '@/lib/features'

export const metadata = { title: 'Billing & Plan | Player Portal' }

interface PlanRow {
  id: string
  slug: string
  name: string
  monthly_price: number
  transaction_fee_percent: number
  feature_keys: string[] | null
}

const TIER_FEATURE_GROUPS: { tier: PlanTier; heading: string; features: FeatureKey[] }[] = [
  {
    tier: 'starter',
    heading: 'Core features',
    features: [
      'players', 'booking_page', 'stripe_payments', 'scheduling',
      'attendance', 'parent_portal', 'csv_import', 'basic_announcements',
    ],
  },
  {
    tier: 'pro',
    heading: 'Everything in Starter, plus',
    features: [
      'progress_reviews', 'messaging', 'photo_gallery', 'waitlists',
      'referrals', 'analytics', 'session_plans', 'achievements',
      'parent_digests', 'engagement', 'camps',
    ],
  },
  {
    tier: 'enterprise',
    heading: 'Everything in Pro, plus',
    features: [
      'white_label', 'shop', 'api_access',
      'audit_log', 'cpd_compliance', 'unlimited_coaches', 'priority_support',
    ],
  },
]

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organisation_id) redirect('/dashboard')
  // Only admins can manage billing
  if (profile.role !== 'admin') redirect('/dashboard')

  const [featureCtx, plansResult] = await Promise.all([
    getOrgFeatures(profile.organisation_id),
    supabase
      .from('platform_plans')
      .select('id, slug, name, monthly_price, transaction_fee_percent, feature_keys')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const plans = (plansResult.data || []) as PlanRow[]
  const params = await searchParams
  const blockedFeature = params.feature as FeatureKey | undefined
  const blockedTier = blockedFeature ? FEATURE_MIN_TIER[blockedFeature] : null
  const currentPlanSlug = featureCtx.planSlug

  return (
    <div className="space-y-8">
      {/* Blocked feature banner */}
      {blockedFeature && blockedTier && (
        <div className="bg-gradient-to-r from-[#4ecde6]/10 to-[#4ecde6]/5 border border-[#4ecde6]/30 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#4ecde6]/20 flex items-center justify-center text-2xl flex-shrink-0">
              🔒
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-[#4ecde6]">
                {FEATURE_LABELS[blockedFeature]} requires {tierLabel(blockedTier)}
              </h2>
              <p className="text-sm text-white/60 mt-1">
                Upgrade to <strong className="text-white">{tierLabel(blockedTier)}</strong> to unlock this feature and many others below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Plan</h1>
        <p className="text-sm text-white/50 mt-1">
          {featureCtx.pilot ? (
            <>You&apos;re on a <strong className="text-emerald-400">pilot programme</strong> with full access to all features.</>
          ) : featureCtx.planName ? (
            <>You&apos;re currently on the <strong className="text-white">{featureCtx.planName}</strong> plan.</>
          ) : (
            <>You don&apos;t have an active plan yet.</>
          )}
        </p>
        {/* Sprint 14b.1 (QW3) — explicit no-auto-charge reassurance,
            shown when there is no active plan (trial or expired-trial
            state). Pilot academies and paying plans skip this line. */}
        {!featureCtx.pilot && !featureCtx.planName && (
          <p
            data-testid="billing-page-no-charge"
            className="text-xs text-white/45 mt-2 leading-snug"
          >
            <span className="text-white/70 font-semibold">You won&apos;t be charged unless you choose a plan below.</span>{' '}
            No card on file.
          </p>
        )}
      </div>

      {/* Plan comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan, i) => {
          const isCurrent = plan.slug === currentPlanSlug
          const isFeatured = plan.slug === 'pro'
          const group = TIER_FEATURE_GROUPS.find(g => g.tier === plan.slug)
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 flex flex-col transition-all duration-300 ${
                isFeatured
                  ? 'bg-gradient-to-b from-[#4ecde6]/[0.08] to-[#4ecde6]/[0.02] border-2 border-[#4ecde6]/30 shadow-lg'
                  : 'bg-[#141414] border border-[#1e1e1e]'
              }`}
            >
              {isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#4ecde6] text-[#0a0a0a] text-[10px] font-bold uppercase tracking-wider rounded-full">
                  Most Popular
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4 px-3 py-0.5 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                  Current
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-base font-bold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-extrabold text-white">
                    &pound;{Number(plan.monthly_price).toFixed(0)}
                  </span>
                  <span className="text-white/40 text-sm">/mo</span>
                </div>
                <p className="text-sm text-white/50">
                  {Number(plan.transaction_fee_percent)}% transaction fee
                </p>
                {/* Sprint 14b.1 (QW6) — billing-transparency clarifier
                    on each plan card. Stripe Checkout is mode:'subscription'
                    with no trial_period_days, so the first month is billed
                    immediately on click. Surface that here so the owner is
                    never surprised at Checkout. */}
                <p className="text-[11px] text-white/40 mt-1.5 leading-snug">
                  Billed monthly · charged immediately when you choose this plan
                </p>
              </div>

              {group && (
                <div className="mb-5">
                  <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2.5">
                    {group.heading}
                  </h4>
                  <ul className="space-y-1.5">
                    {group.features.map(fk => (
                      <li key={fk} className="flex items-start gap-2 text-xs text-white/70">
                        <svg className="w-3.5 h-3.5 text-[#4ecde6] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{FEATURE_LABELS[fk]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isCurrent ? (
                <button
                  disabled
                  className="mt-auto block text-center py-2.5 rounded-xl font-semibold text-sm bg-white/5 text-white/40 cursor-not-allowed"
                >
                  Current plan
                </button>
              ) : (
                <Link
                  href={`/dashboard/settings?section=billing&upgrade=${plan.slug}`}
                  className={`mt-auto block text-center py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    isFeatured
                      ? 'bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#7dddf0]'
                      : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  {currentPlanSlug && plans.findIndex(p => p.slug === plan.slug) > plans.findIndex(p => p.slug === currentPlanSlug)
                    ? `Upgrade to ${plan.name}`
                    : currentPlanSlug
                    ? `Switch to ${plan.name}`
                    : `Choose ${plan.name}`}
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* Current plan details */}
      {featureCtx.planName && !featureCtx.pilot && (
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">What you have access to</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {Array.from(featureCtx.features).map(fk => (
              <div key={fk} className="flex items-center gap-2 text-xs text-white/60">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{FEATURE_LABELS[fk as FeatureKey] || fk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings shortcut */}
      <div className="text-center text-sm text-white/40">
        Manage your Stripe subscription and payment method in{' '}
        <Link href="/dashboard/settings" className="text-[#4ecde6] hover:underline">
          Settings
        </Link>
        .
      </div>
    </div>
  )
}
