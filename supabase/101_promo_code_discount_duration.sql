-- Promo codes: how long the discount lasts once a code is redeemed.
--
-- The original promo_codes table (009) had valid_from/valid_until (when the code
-- can be USED) and max_uses, but nothing for how long the resulting discount
-- applies to a subscription. Without this, a redeemed code would default to a
-- FOREVER discount — a silent, permanent revenue leak. This column lets the
-- academy choose per code, defaulting to the safe 'once' (first payment only).
--
-- Maps to the Stripe coupon `duration`:
--   once         -> duration: 'once'
--   repeating_3  -> duration: 'repeating', duration_in_months: 3
--   repeating_6  -> duration: 'repeating', duration_in_months: 6
--   forever      -> duration: 'forever'
--
-- Additive only. Existing rows (there are none in prod) default to 'once'.

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS discount_duration TEXT NOT NULL DEFAULT 'once'
  CHECK (discount_duration IN ('once', 'repeating_3', 'repeating_6', 'forever'));
