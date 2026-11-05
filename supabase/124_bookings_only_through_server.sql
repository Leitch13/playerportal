-- ═══════════════════════════════════════════════════════════════════
-- Migration 124 — public bookings only through the server's door check
-- ═══════════════════════════════════════════════════════════════════
-- 5 Nov 2026: a fake trial ("A", a@gmail.com, no phone) reached Pro Football
-- Coaching. The same pattern hit Talent (7 Sep, 4 trials + a camp) and WLFA
-- (7 Oct). The booking forms saved straight from the browser using the
-- public key, so nothing checked them.
--
-- From release 5 Nov 2026 every public trial goes through /api/trials/book and
-- every camp booking through the camp checkout routes; both use the service
-- key and run src/lib/booking-guard.ts first. This removes the public INSERT
-- rights, so the checks cannot be skipped by calling the database directly.
--
-- Academy staff keep adding trials from the dashboard (Leads page) through
-- the staff policy below. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Public can book trials" ON public.trial_bookings;
DROP POLICY IF EXISTS "Public submit trial booking" ON public.trial_bookings;
DROP POLICY IF EXISTS "Anyone can submit a trial booking" ON public.trial_bookings;
DROP POLICY IF EXISTS "trial_bookings_insert_anon_published" ON public.trial_bookings;
DROP POLICY IF EXISTS "trial_bookings_insert_authenticated" ON public.trial_bookings;

DROP POLICY IF EXISTS "camp_bookings_insert_anon_published" ON public.camp_bookings;
DROP POLICY IF EXISTS "camp_bookings_insert_authenticated_published" ON public.camp_bookings;
DROP POLICY IF EXISTS "Public book camps" ON public.camp_bookings;

-- Staff can still add a trial for their own academy from the dashboard.
DROP POLICY IF EXISTS "trial_bookings_insert_staff" ON public.trial_bookings;
CREATE POLICY "trial_bookings_insert_staff"
  ON public.trial_bookings FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- What is left (check: no INSERT policy for anon on either table).
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('trial_bookings', 'camp_bookings')
ORDER BY tablename, cmd, policyname;
