-- Update platform_plans pricing to match new tier structure
-- (Starter unchanged, Pro £30 -> £35 / 2% -> 2.5%, Enterprise £50 -> £60 / 1% -> 2%)
-- Features are left as-is for now — feature gating will ship post-pilot.

UPDATE public.platform_plans
SET monthly_price = 20.00,
    transaction_fee_percent = 3.5
WHERE slug = 'starter';

UPDATE public.platform_plans
SET monthly_price = 35.00,
    transaction_fee_percent = 2.5
WHERE slug = 'pro';

UPDATE public.platform_plans
SET monthly_price = 60.00,
    transaction_fee_percent = 2.0
WHERE slug = 'enterprise';

-- Sanity check
SELECT slug, name, monthly_price, transaction_fee_percent
FROM public.platform_plans
WHERE slug IN ('starter', 'pro', 'enterprise')
ORDER BY sort_order;
