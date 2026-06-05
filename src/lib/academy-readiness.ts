/**
 * Sprint 14 — Academy Readiness state.
 *
 * Single source of truth for "is this academy ready to go live?". Pure
 * READ path: composes existing data (organisations row, training_groups
 * count, subscription_plans rows, Stripe account.charges_enabled) into
 * a structured ReadinessState that the dashboard widget renders.
 *
 * Does NOT mutate anything. Does NOT touch Stripe checkout, billing,
 * webhooks, RLS, or schema.
 *
 * Reuses the existing /api/stripe/connect/status pattern for the
 * charges_enabled fetch — same call shape, same error handling.
 *
 * If the Stripe API errors or times out, the readiness state degrades
 * gracefully: the verification step is marked unknown rather than
 * blocking the whole widget. The dashboard still renders.
 */

import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export type ReadinessItem = {
  key: string
  label: string
  done: boolean
  // Optional sub-status text shown under the label — e.g. for the
  // "Stripe verification" item we surface the three Stripe sub-flags
  // (charges_enabled, payouts_enabled, details_submitted) here.
  detail?: string
  // Optional CTA target. When the item is incomplete, the widget
  // renders the label as a link to this href.
  cta?: { label: string; href: string }
}

export type StripeReadiness = 'not_connected' | 'verification_pending' | 'ready_to_take_payments' | 'unknown'

export type ReadinessState = {
  isLive: boolean
  items: ReadinessItem[]
  doneCount: number
  totalCount: number
  // The first incomplete item — the widget renders this as the
  // "Next step: ___" persistent banner.
  nextStep: ReadinessItem | null
  stripeReadiness: StripeReadiness
  // True for pilot academies, which bypass the platform-plan and
  // is_published gates by design.
  isPilot: boolean
  // Trial countdown info (or null if not on trial). Used so the
  // widget can echo the platform-trial state alongside the other
  // signals — purely informational, no behaviour change.
  trialDaysRemaining: number | null
}

// The default subscription plans seeded at /api/onboard signup. If the
// org's plans still match these exactly (count, names, amounts), we
// treat the "subscription plans reviewed" step as NOT done — the
// owner hasn't customised pricing yet.
const SEEDED_DEFAULT_PLANS: Array<{ name: string; amount: number }> = [
  { name: '1 Session / Week', amount: 30 },
  { name: '2 Sessions / Week', amount: 50 },
  { name: 'Unlimited', amount: 70 },
]

function plansAreUntouchedDefaults(
  plans: Array<{ name: string | null; amount: number | string | null }>
): boolean {
  if (plans.length !== SEEDED_DEFAULT_PLANS.length) return false
  // Match each seeded default to a row by (name, amount) — order
  // independent. If every default has a row, treat as untouched.
  for (const seed of SEEDED_DEFAULT_PLANS) {
    const match = plans.find(
      (p) =>
        (p.name ?? '').trim().toLowerCase() === seed.name.toLowerCase() &&
        Math.round(Number(p.amount ?? 0)) === seed.amount
    )
    if (!match) return false
  }
  return true
}

/**
 * Compute the readiness state for an academy. Server-side only.
 * Safe to call from a Server Component on every dashboard render.
 */
export async function getAcademyReadiness(orgId: string): Promise<ReadinessState> {
  const supabase = await createClient()

  // Fetch in parallel — three cheap reads.
  const [orgResult, classCountResult, plansResult] = await Promise.all([
    supabase
      .from('organisations')
      .select(
        'id, stripe_account_id, is_published, platform_subscription_status, platform_trial_ends_at, pilot'
      )
      .eq('id', orgId)
      .single(),
    supabase
      .from('training_groups')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', orgId),
    supabase
      .from('subscription_plans')
      .select('name, amount')
      .eq('organisation_id', orgId)
      .eq('active', true),
  ])

  const org = (orgResult.data ?? null) as
    | {
        id: string
        stripe_account_id: string | null
        is_published: boolean | null
        platform_subscription_status: string | null
        platform_trial_ends_at: string | null
        pilot: boolean | null
      }
    | null
  const classCount = classCountResult.count ?? 0
  const plans = (plansResult.data ?? []) as Array<{ name: string | null; amount: number | string | null }>

  // ── derive each readiness signal ───────────────────────────────────
  const accountCreated = true // by virtue of reaching the dashboard
  const academyCreated = !!org // if the org row exists
  const hasClasses = classCount > 0
  // "Reviewed" = either the org has more/fewer than the 3 seeded
  // defaults, or one of the seeded rows has been edited away from
  // its default name/amount. Hardcoded values match the seed in
  // /api/onboard/route.ts. No new column needed.
  const plansReviewed = plans.length > 0 && !plansAreUntouchedDefaults(plans)
  const stripeConnected = !!org?.stripe_account_id
  const isPilot = !!org?.pilot

  // Stripe verification — only fetch if Connect was started AND the
  // academy isn't already published (when published, charges must
  // have been enabled at some point — skipping the fetch shaves
  // ~300ms off every dashboard load for live academies).
  let stripeReadiness: StripeReadiness = 'not_connected'
  let stripeDetail: string | undefined
  if (stripeConnected) {
    if (org?.is_published) {
      // Already live → assume verification clear. Cheap optimisation.
      stripeReadiness = 'ready_to_take_payments'
    } else {
      try {
        const acct = await stripe.accounts.retrieve(org!.stripe_account_id as string)
        if (acct.charges_enabled) {
          stripeReadiness = 'ready_to_take_payments'
        } else {
          stripeReadiness = 'verification_pending'
          const parts: string[] = []
          if (!acct.details_submitted) parts.push('details not yet submitted')
          if (acct.requirements?.currently_due && acct.requirements.currently_due.length > 0) {
            parts.push(`${acct.requirements.currently_due.length} item(s) outstanding`)
          }
          if (!acct.charges_enabled) parts.push('charges not yet enabled')
          if (!acct.payouts_enabled) parts.push('payouts not yet enabled')
          stripeDetail = parts.length > 0 ? parts.join(' · ') : 'Stripe is still verifying your account'
        }
      } catch {
        // Stripe API hiccup — don't block the dashboard. Surface a
        // soft "unknown" state and let the owner refresh.
        stripeReadiness = 'unknown'
        stripeDetail = 'Could not check Stripe status right now — try refreshing.'
      }
    }
  }

  const stripeVerified = stripeReadiness === 'ready_to_take_payments'

  // Platform plan active. Pilot academies bypass.
  const platformPlanActive =
    isPilot || org?.platform_subscription_status === 'active'

  // Academy published — pilot academies are flipped published by
  // migration 064, so they always pass this gate too.
  const academyPublished = !!org?.is_published || isPilot

  // Trial countdown (informational only).
  let trialDaysRemaining: number | null = null
  if (org?.platform_subscription_status === 'trial' && org.platform_trial_ends_at) {
    const ms = new Date(org.platform_trial_ends_at).getTime() - Date.now()
    if (Number.isFinite(ms)) {
      trialDaysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
    }
  }

  // ── build the 8 readiness items in spec order ──────────────────────
  const items: ReadinessItem[] = [
    {
      key: 'account-created',
      label: 'Account created',
      done: accountCreated,
    },
    {
      key: 'academy-created',
      label: 'Academy created',
      done: academyCreated,
    },
    {
      key: 'at-least-one-class',
      label: 'At least one class created',
      done: hasClasses,
      cta: hasClasses ? undefined : { label: 'Create your first class', href: '/dashboard/groups' },
    },
    {
      key: 'plans-reviewed',
      label: 'Subscription plans reviewed',
      done: plansReviewed,
      detail: plansReviewed
        ? undefined
        : plans.length === 0
          ? 'No plans yet'
          : 'Default prices not yet customised — open Plans to confirm or edit',
      cta: plansReviewed ? undefined : { label: 'Review your plans', href: '/dashboard/plans' },
    },
    {
      key: 'stripe-connected',
      label: 'Stripe connected',
      done: stripeConnected,
      cta: stripeConnected ? undefined : { label: 'Connect Stripe', href: '/dashboard/settings?tab=billing' },
    },
    {
      key: 'stripe-verified',
      label: 'Ready to take payments',
      done: stripeVerified,
      detail: stripeReadiness === 'verification_pending'
        ? stripeDetail || 'Stripe is still verifying your account'
        : stripeReadiness === 'unknown'
          ? stripeDetail
          : stripeReadiness === 'not_connected'
            ? 'Connect Stripe first'
            : undefined,
      cta: stripeReadiness === 'verification_pending' || stripeReadiness === 'unknown'
        ? { label: 'Open Stripe setup', href: '/dashboard/settings?tab=billing' }
        : undefined,
    },
    {
      key: 'platform-plan-active',
      label: isPilot ? 'Platform plan (pilot bypass)' : 'Platform plan active',
      done: !!platformPlanActive,
      detail: isPilot
        ? 'Pilot academy — platform plan not required'
        : platformPlanActive
          ? undefined
          : trialDaysRemaining != null
            ? `On trial · ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} remaining`
            : 'No active platform plan',
      cta: !isPilot && !platformPlanActive
        ? { label: 'Choose a plan', href: '/dashboard/billing' }
        : undefined,
    },
    {
      key: 'academy-published',
      label: 'Academy published',
      done: academyPublished,
      detail: academyPublished
        ? undefined
        : 'Subscribing to a platform plan publishes your academy automatically',
      cta: academyPublished
        ? undefined
        : { label: 'Go live', href: '/dashboard/billing' },
    },
  ]

  const doneCount = items.filter((i) => i.done).length
  const totalCount = items.length

  // "LIVE" means every readiness item is green. For pilot academies
  // the platform-plan and published items auto-pass.
  const isLive = items.every((i) => i.done)

  // Next step = first incomplete item. When LIVE, null.
  const nextStep = items.find((i) => !i.done) ?? null

  return {
    isLive,
    items,
    doneCount,
    totalCount,
    nextStep,
    stripeReadiness,
    isPilot,
    trialDaysRemaining,
  }
}
