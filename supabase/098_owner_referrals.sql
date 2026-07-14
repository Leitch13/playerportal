-- 098 — Academy-owner referrals (owner → owner platform referrals).
--
-- Distinct from the existing parent-level `referrals` table (parents
-- referring parents WITHIN an academy). This records which academy, if any,
-- referred a NEW academy to the platform: /onboard?ref=<slug> is captured by
-- the onboarding wizard and stamped here at org creation.
--
-- Rewards are manual at MVP ("give a month, get a month", applied by John as
-- a Stripe coupon on the platform subscription when the referred academy
-- pays its first invoice) — so no reward/state columns yet. Additive only;
-- nullable; nothing existing changes.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS referred_by_org_id uuid REFERENCES public.organisations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organisations_referred_by
  ON public.organisations (referred_by_org_id)
  WHERE referred_by_org_id IS NOT NULL;

-- Sanity: column exists, no rows affected
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'organisations'
       AND column_name = 'referred_by_org_id') AS column_present,
  (SELECT count(*) FROM public.organisations WHERE referred_by_org_id IS NOT NULL) AS attributed_orgs;
-- Expected: column_present = 1, attributed_orgs = 0
