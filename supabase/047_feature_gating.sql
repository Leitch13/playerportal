-- Feature gating: per-plan feature keys + pilot bypass flag
-- Each plan stores an array of feature keys. Code checks hasFeature(orgId, key).

-- 1. Add feature_keys column (if not exists)
ALTER TABLE public.platform_plans
  ADD COLUMN IF NOT EXISTS feature_keys text[] DEFAULT '{}';

-- 2. Add pilot flag to organisations (bypass gating entirely for pilot academies)
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS pilot boolean DEFAULT false;

-- 3. Seed feature keys per tier
-- Starter: core running of an academy
UPDATE public.platform_plans
SET feature_keys = ARRAY[
  'players',
  'booking_page',
  'stripe_payments',
  'scheduling',
  'attendance',
  'parent_portal',
  'csv_import',
  'basic_announcements'
]
WHERE slug = 'starter';

-- Pro: retention & growth tools (includes everything in Starter)
UPDATE public.platform_plans
SET feature_keys = ARRAY[
  'players',
  'booking_page',
  'stripe_payments',
  'scheduling',
  'attendance',
  'parent_portal',
  'csv_import',
  'basic_announcements',
  -- Pro additions
  'progress_reviews',
  'messaging',
  'photo_gallery',
  'waitlists',
  'referrals',
  'analytics',
  'session_plans',
  'achievements',
  'parent_digests',
  'engagement'
]
WHERE slug = 'pro';

-- Enterprise: branding, scale & compliance (includes everything in Pro)
UPDATE public.platform_plans
SET feature_keys = ARRAY[
  'players',
  'booking_page',
  'stripe_payments',
  'scheduling',
  'attendance',
  'parent_portal',
  'csv_import',
  'basic_announcements',
  'progress_reviews',
  'messaging',
  'photo_gallery',
  'waitlists',
  'referrals',
  'analytics',
  'session_plans',
  'achievements',
  'parent_digests',
  'engagement',
  -- Enterprise additions
  'white_label',
  'camps',
  'shop',
  'api_access',
  'audit_log',
  'cpd_compliance',
  'unlimited_coaches',
  'priority_support'
]
WHERE slug = 'enterprise';

-- 4. Sanity check
SELECT slug, name, monthly_price, transaction_fee_percent, array_length(feature_keys, 1) AS feature_count
FROM public.platform_plans
ORDER BY sort_order;
