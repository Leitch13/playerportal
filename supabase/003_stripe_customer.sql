-- Add Stripe customer ID to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Add Stripe checkout session ID to payments for webhook reconciliation
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session_id ON public.payments(stripe_session_id);
