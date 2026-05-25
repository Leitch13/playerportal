-- Automatic sibling discount for recurring subscriptions.
-- When a parent adds a 2nd+ child with a subscription, the discount is
-- auto-applied via a Stripe coupon. Academy controls the percentage.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS sibling_discount_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sibling_discount_percent numeric(5,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS stripe_sibling_coupon_id text;

-- Sanity check
SELECT id, name, sibling_discount_enabled, sibling_discount_percent, stripe_sibling_coupon_id
FROM public.organisations
LIMIT 5;
