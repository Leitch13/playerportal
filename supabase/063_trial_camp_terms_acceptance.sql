-- 063: Audit trail of T&C acceptance for anonymous flows
--
-- The academy_terms_acceptances table requires a profile_id (auth user).
-- Trial bookings and camp bookings can come from parents who don't have
-- an account yet — so we log the acceptance directly on the booking row.
--
-- For logged-in quick-book + main signup, we still use academy_terms_acceptances.

ALTER TABLE public.trial_bookings
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version_hash text;

ALTER TABLE public.camp_bookings
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version_hash text;

COMMENT ON COLUMN public.trial_bookings.terms_accepted_at IS
  'Timestamp when the parent ticked the T&C box on the trial booking form. NULL for legacy rows.';
COMMENT ON COLUMN public.trial_bookings.terms_version_hash IS
  'djb2 hash + length of the academy''s terms_text at acceptance time. Proves which version they agreed to.';
COMMENT ON COLUMN public.camp_bookings.terms_accepted_at IS
  'Timestamp when the parent ticked the T&C box on the camp booking form. NULL for legacy rows.';
COMMENT ON COLUMN public.camp_bookings.terms_version_hash IS
  'djb2 hash + length of the academy''s terms_text at acceptance time.';
