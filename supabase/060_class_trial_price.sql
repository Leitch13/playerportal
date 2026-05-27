-- 060: Per-class paid trial price
--
-- Adds an optional trial_price column to training_groups so academies can
-- offer a paid one-off trial session at a price they set per class.
--
-- Behaviour on the booking page:
--   trial_price IS NULL  → "Try Free Session" (current behaviour, group classes)
--   trial_price > 0      → "Try a session — £X" (paid trial, e.g. 1-2-1s)
--   trial_price = 0      → "Try Free Session" (explicit free, same as NULL)
--
-- Idempotent — safe to re-run.

ALTER TABLE public.training_groups
  ADD COLUMN IF NOT EXISTS trial_price numeric(8, 2);

COMMENT ON COLUMN public.training_groups.trial_price IS
  'Optional one-off trial price in GBP. NULL or 0 means free trial. Used for 1-2-1s or high-value classes where free trials are not viable.';
