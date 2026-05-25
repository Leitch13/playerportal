-- Academy-configurable quarterly (3-month prepay) discount.
-- Default stays at 10% so existing behaviour is unchanged.
-- Academies can toggle off quarterly billing entirely or change the %.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS quarterly_billing_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS quarterly_discount_percent numeric(5,2) DEFAULT 10;

-- Sanity check
SELECT id, name, quarterly_billing_enabled, quarterly_discount_percent
FROM public.organisations
LIMIT 5;
