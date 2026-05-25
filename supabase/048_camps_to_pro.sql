-- Move 'camps' feature from Enterprise-only to also being included in Pro tier.
-- Rationale: camps are a big revenue driver for most academies (holiday periods),
-- so gating them behind Enterprise pushes too many to upgrade for one feature.

-- Add 'camps' to Pro's feature set (array_append is idempotent if already present)
UPDATE public.platform_plans
SET feature_keys = CASE
  WHEN 'camps' = ANY(feature_keys) THEN feature_keys
  ELSE array_append(feature_keys, 'camps')
END
WHERE slug = 'pro';

-- Sanity check
SELECT slug, name, array_length(feature_keys, 1) AS feature_count,
       'camps' = ANY(feature_keys) AS has_camps
FROM public.platform_plans
ORDER BY sort_order;
