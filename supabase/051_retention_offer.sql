-- Academy-configurable cancellation retention offer.
-- Shown to parents who try to cancel their subscription — aims to save the churn.
-- Default stays at 25% forever (the current hardcoded behaviour).

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS retention_offer_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS retention_offer_percent numeric(5,2) DEFAULT 25,
  ADD COLUMN IF NOT EXISTS retention_offer_months integer DEFAULT NULL, -- NULL = forever
  ADD COLUMN IF NOT EXISTS stripe_retention_coupon_id text;

-- Note: retention_offer_months = NULL means the discount lasts forever.
-- Otherwise it's a repeating coupon for that many months.

-- Sanity check
SELECT id, name,
  retention_offer_enabled,
  retention_offer_percent,
  retention_offer_months,
  stripe_retention_coupon_id
FROM public.organisations
LIMIT 5;
