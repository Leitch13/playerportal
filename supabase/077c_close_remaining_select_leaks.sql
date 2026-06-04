-- ═══════════════════════════════════════════════════════════════════
-- Migration 077c — close the 3 remaining cross-tenant SELECT leaks
-- ═══════════════════════════════════════════════════════════════════
-- Targeted patch over 077b. Diagnostic showed these three permissive
-- policies survived:
--   camps               "Public read camps"               USING (is_published=true)
--   camp_bookings       "Public read camp bookings"       USING (true)
--   subscription_plans  "subscription_plans_public_read"  USING (true)
-- All three allowed cross-tenant SELECT to authenticated users.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Public read camps" ON public.camps;
CREATE POLICY "camps_select_own_org_authenticated" ON public.camps FOR SELECT TO authenticated USING (organisation_id = public.get_my_org());
CREATE POLICY "camps_select_published_anon" ON public.camps FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = camps.organisation_id AND COALESCE(o.is_published, false) = true));

DROP POLICY IF EXISTS "Public read camp bookings" ON public.camp_bookings;
CREATE POLICY "camp_bookings_select_own_email" ON public.camp_bookings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND lower(me.email) = lower(camp_bookings.parent_email)));
CREATE POLICY "camp_bookings_select_staff_own_org" ON public.camp_bookings FOR SELECT TO authenticated USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

DROP POLICY IF EXISTS "subscription_plans_public_read" ON public.subscription_plans;
CREATE POLICY "subscription_plans_select_published_anon" ON public.subscription_plans FOR SELECT TO anon USING (COALESCE(active, false) = true AND EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = subscription_plans.organisation_id AND COALESCE(o.is_published, false) = true));
