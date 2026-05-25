/**
 * Feature gating — keys, metadata, helpers.
 *
 * Feature keys are the single source of truth for what's unlocked at each tier.
 * The database `platform_plans.feature_keys` column stores an array of these keys
 * per plan. Code checks `hasFeature(orgId, key)` to decide whether to show UI
 * or allow access to a route.
 *
 * Pilot academies bypass gating: set `organisations.pilot = true` to give
 * full access regardless of plan.
 */

import { createClient as createServerClient } from '@/lib/supabase/server'

export type FeatureKey =
  // Starter (core)
  | 'players'
  | 'booking_page'
  | 'stripe_payments'
  | 'scheduling'
  | 'attendance'
  | 'parent_portal'
  | 'csv_import'
  | 'basic_announcements'
  // Pro
  | 'progress_reviews'
  | 'messaging'
  | 'photo_gallery'
  | 'waitlists'
  | 'referrals'
  | 'analytics'
  | 'session_plans'
  | 'achievements'
  | 'parent_digests'
  | 'engagement'
  // Enterprise
  | 'white_label'
  | 'camps'
  | 'shop'
  | 'api_access'
  | 'audit_log'
  | 'cpd_compliance'
  | 'unlimited_coaches'
  | 'priority_support'

export type PlanTier = 'starter' | 'pro' | 'enterprise'

/** Which plan tier first unlocks each feature (for upgrade copy). */
export const FEATURE_MIN_TIER: Record<FeatureKey, PlanTier> = {
  players: 'starter',
  booking_page: 'starter',
  stripe_payments: 'starter',
  scheduling: 'starter',
  attendance: 'starter',
  parent_portal: 'starter',
  csv_import: 'starter',
  basic_announcements: 'starter',
  progress_reviews: 'pro',
  messaging: 'pro',
  photo_gallery: 'pro',
  waitlists: 'pro',
  referrals: 'pro',
  analytics: 'pro',
  session_plans: 'pro',
  achievements: 'pro',
  parent_digests: 'pro',
  engagement: 'pro',
  camps: 'pro',
  white_label: 'enterprise',
  shop: 'enterprise',
  api_access: 'enterprise',
  audit_log: 'enterprise',
  cpd_compliance: 'enterprise',
  unlimited_coaches: 'enterprise',
  priority_support: 'enterprise',
}

/** Human-readable feature names for upgrade copy. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  players: 'Player management',
  booking_page: 'Booking page',
  stripe_payments: 'Automated payments',
  scheduling: 'Class scheduling',
  attendance: 'Attendance tracking',
  parent_portal: 'Parent portal',
  csv_import: 'CSV player import',
  basic_announcements: 'Announcements',
  progress_reviews: 'Progress reviews',
  messaging: 'Parent messaging',
  photo_gallery: 'Photo gallery',
  waitlists: 'Waitlists & win-back',
  referrals: 'Referral engine',
  analytics: 'Analytics & reports',
  session_plans: 'Session planner & drill library',
  achievements: 'Achievements & badges',
  parent_digests: 'Weekly parent digests',
  engagement: 'Engagement scoring',
  white_label: 'White-label branding',
  camps: 'Camps & events',
  shop: 'Merch shop',
  api_access: 'API access',
  audit_log: 'Audit log',
  cpd_compliance: 'CPD & compliance tracking',
  unlimited_coaches: 'Unlimited coach accounts',
  priority_support: 'Priority support',
}

const TIER_LABELS: Record<PlanTier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export function tierLabel(tier: PlanTier): string {
  return TIER_LABELS[tier]
}

/* ─── Server-side helpers ───────────────────────────────────────────── */

export interface OrgFeatureContext {
  orgId: string
  planSlug: PlanTier | null
  planName: string | null
  features: Set<FeatureKey>
  pilot: boolean
}

/**
 * Load an organisation's feature context (plan + feature set + pilot flag).
 *
 * Returns an empty context if the org has no plan yet (pre-signup, shouldn't
 * happen in practice). Callers should treat "no plan" as Starter for safety.
 */
export async function getOrgFeatures(orgId: string): Promise<OrgFeatureContext> {
  const supabase = await createServerClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('id, pilot, platform_plan_id')
    .eq('id', orgId)
    .single()

  if (!org) {
    return { orgId, planSlug: null, planName: null, features: new Set(), pilot: false }
  }

  const pilot = !!org.pilot

  if (!org.platform_plan_id) {
    // No plan yet — default to Starter-like access so nothing breaks pre-signup
    return { orgId, planSlug: null, planName: null, features: new Set(), pilot }
  }

  const { data: plan } = await supabase
    .from('platform_plans')
    .select('slug, name, feature_keys')
    .eq('id', org.platform_plan_id)
    .single()

  if (!plan) {
    return { orgId, planSlug: null, planName: null, features: new Set(), pilot }
  }

  const features = new Set<FeatureKey>((plan.feature_keys || []) as FeatureKey[])

  return {
    orgId,
    planSlug: plan.slug as PlanTier,
    planName: plan.name,
    features,
    pilot,
  }
}

/**
 * Quick check: does this org have access to a given feature?
 *
 * Pilot academies always return true (bypass).
 * Orgs without a plan return false (lock everything except the truly-core bits).
 */
export async function hasFeature(orgId: string, key: FeatureKey): Promise<boolean> {
  const ctx = await getOrgFeatures(orgId)
  return ctx.pilot || ctx.features.has(key)
}

/**
 * Route guard helper for server components. Redirects to /dashboard/billing
 * if the current user's org doesn't have the feature.
 *
 * Usage in a page.tsx:
 *   await requireFeature('messaging')
 */
export async function requireFeature(key: FeatureKey): Promise<void> {
  const { redirect } = await import('next/navigation')
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/signin')
    return
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organisation_id
  if (!orgId) {
    redirect('/dashboard')
    return
  }

  const allowed = await hasFeature(orgId, key)
  if (!allowed) {
    redirect(`/dashboard/billing?feature=${key}`)
  }
}

/**
 * Convert a Set<FeatureKey> to an array for passing to client components.
 * (Sets don't serialise across the server/client boundary.)
 */
export function featuresToArray(ctx: OrgFeatureContext): FeatureKey[] {
  return Array.from(ctx.features)
}
