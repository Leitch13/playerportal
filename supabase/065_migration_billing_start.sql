-- 065: Deferred first-charge date for bulk migrations
--
-- When an academy bulk-migrates members who've already prepaid elsewhere
-- (e.g. paid via ClassForKids for the current term), we must not charge them
-- again on confirm. This stores the date their existing payment runs out;
-- confirm-checkout uses it as the Stripe subscription trial_end so the first
-- real charge lands then — no double-charge.
--
-- NULL = current behaviour (prorate from confirm date to the 1st of next month).

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS migration_billing_starts_at timestamptz;

COMMENT ON COLUMN public.subscriptions.migration_billing_starts_at IS
  'For migrated members who prepaid elsewhere: the date their existing payment runs out. confirm-checkout sets Stripe trial_end to this so the first charge is deferred. NULL = charge prorated immediately.';
