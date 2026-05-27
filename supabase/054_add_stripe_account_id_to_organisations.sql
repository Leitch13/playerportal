-- Add the missing stripe_account_id column to organisations.
-- The Stripe Connect Standard integration stores each academy's connected
-- Stripe account id here. Without it, Connect Stripe button fails with a
-- disguised "Organisation not found" error (the SELECT errors silently
-- because the column is missing, returning null, which we then check).

ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS stripe_account_id text;

-- Helpful for fast lookups when handling webhook events that reference
-- the connected account.
CREATE INDEX IF NOT EXISTS idx_organisations_stripe_account_id
  ON public.organisations(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;
