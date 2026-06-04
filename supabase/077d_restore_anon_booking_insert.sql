-- ═══════════════════════════════════════════════════════════════════
-- Migration 077d — restore anon INSERT on booking entry points
-- ═══════════════════════════════════════════════════════════════════
-- 077b dropped pre-existing anon-INSERT policies on trial_bookings +
-- camp_bookings when its DO block enumerated all policies, but the
-- recreate statements were truncated when pasted into the SQL editor.
-- Result: /book/[slug]/trial and /book/[slug]/camps started returning
-- "row violates RLS policy" on submit. This patch restores anon INSERT
-- on the booking entry points, gated on the target org being published.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Public submit trial booking" ON public.trial_bookings;
DROP POLICY IF EXISTS "Anyone can submit a trial booking" ON public.trial_bookings;
DROP POLICY IF EXISTS "trial_bookings_insert_anon_published" ON public.trial_bookings;
DROP POLICY IF EXISTS "trial_bookings_insert_authenticated" ON public.trial_bookings;

CREATE POLICY "trial_bookings_insert_anon_published"
  ON public.trial_bookings FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = trial_bookings.organisation_id AND COALESCE(o.is_published, false) = true));

CREATE POLICY "trial_bookings_insert_authenticated"
  ON public.trial_bookings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = trial_bookings.organisation_id AND COALESCE(o.is_published, false) = true));

DROP POLICY IF EXISTS "camp_bookings_insert_anon_published" ON public.camp_bookings;
DROP POLICY IF EXISTS "camp_bookings_insert_authenticated_published" ON public.camp_bookings;

CREATE POLICY "camp_bookings_insert_anon_published"
  ON public.camp_bookings FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = camp_bookings.organisation_id AND COALESCE(o.is_published, false) = true));

CREATE POLICY "camp_bookings_insert_authenticated_published"
  ON public.camp_bookings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = camp_bookings.organisation_id AND COALESCE(o.is_published, false) = true));
