-- ═══════════════════════════════════════════════════════════════════
-- Migration 077b — remaining tables RLS lockdown
-- ═══════════════════════════════════════════════════════════════════
-- Follow-up to 077a. Locks down the 5 remaining tables the parent JWT
-- can still enumerate cross-tenant:
--
--   training_groups       (10 foreign rows visible to parent)
--   enrolments            (15 foreign rows visible to parent)
--   camps                 (2 foreign rows visible)
--   camp_bookings         (1 foreign row visible)
--   subscription_plans    (65 foreign rows visible)
--
-- Same surgical pattern as 077a:
--   • drop every existing policy via DO block
--   • recreate strict org-scoped policies
--   • preserve anon SELECT on the public booking surface
--     (anon can read published orgs' groups/camps/plans for /book/[slug])
--   • preserve anon INSERT on camp_bookings (booking flow)
-- ═══════════════════════════════════════════════════════════════════

-- ─── TRAINING_GROUPS ───
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'training_groups'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.training_groups', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.training_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_groups_select_own_org"
  ON public.training_groups FOR SELECT
  TO authenticated
  USING (organisation_id = public.get_my_org());

CREATE POLICY "training_groups_select_published_anon"
  ON public.training_groups FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.organisations o
      WHERE o.id = training_groups.organisation_id
        AND COALESCE(o.is_published, false) = true
    )
  );

CREATE POLICY "training_groups_select_super_admin"
  ON public.training_groups FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "training_groups_admin_manage"
  ON public.training_groups FOR ALL
  TO authenticated
  USING (
    organisation_id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY "training_groups_coach_manage_own"
  ON public.training_groups FOR ALL
  TO authenticated
  USING (
    organisation_id = public.get_my_org()
    AND coach_id = auth.uid()
  )
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND coach_id = auth.uid()
  );


-- ─── ENROLMENTS ───
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'enrolments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.enrolments', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.enrolments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrolments_select_parent_own_children"
  ON public.enrolments FOR SELECT
  TO authenticated
  USING (
    organisation_id = public.get_my_org()
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = enrolments.player_id
        AND p.parent_id = auth.uid()
    )
  );

CREATE POLICY "enrolments_select_staff"
  ON public.enrolments FOR SELECT
  TO authenticated
  USING (
    organisation_id = public.get_my_org()
    AND public.get_my_role() IN ('admin', 'coach')
  );

CREATE POLICY "enrolments_parent_insert"
  ON public.enrolments FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = enrolments.player_id
        AND p.parent_id = auth.uid()
    )
  );

CREATE POLICY "enrolments_parent_update"
  ON public.enrolments FOR UPDATE
  TO authenticated
  USING (
    organisation_id = public.get_my_org()
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = enrolments.player_id
        AND p.parent_id = auth.uid()
    )
  );

CREATE POLICY "enrolments_staff_manage"
  ON public.enrolments FOR ALL
  TO authenticated
  USING (
    organisation_id = public.get_my_org()
    AND public.get_my_role() IN ('admin', 'coach')
  )
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND public.get_my_role() IN ('admin', 'coach')
  );


-- ─── CAMPS ───
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'camps'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.camps', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camps_select_own_org"
  ON public.camps FOR SELECT
  TO authenticated
  USING (organisation_id = public.get_my_org());

CREATE POLICY "camps_select_published_anon"
  ON public.camps FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.organisations o
      WHERE o.id = camps.organisation_id
        AND COALESCE(o.is_published, false) = true
    )
  );

CREATE POLICY "camps_admin_manage"
  ON public.camps FOR ALL
  TO authenticated
  USING (
    organisation_id = public.get_my_org()
    AND public.get_my_role() IN ('admin', 'coach')
  )
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND public.get_my_role() IN ('admin', 'coach')
  );


-- ─── CAMP_BOOKINGS ───
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'camp_bookings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.camp_bookings', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.camp_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camp_bookings_select_own_email"
  ON public.camp_bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND lower(me.email) = lower(camp_bookings.parent_email)
    )
  );

CREATE POLICY "camp_bookings_select_staff"
  ON public.camp_bookings FOR SELECT
  TO authenticated
  USING (
    organisation_id = public.get_my_org()
    AND public.get_my_role() IN ('admin', 'coach')
  );

CREATE POLICY "camp_bookings_insert_anon_published"
  ON public.camp_bookings FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organisations o
      WHERE o.id = camp_bookings.organisation_id
        AND COALESCE(o.is_published, false) = true
    )
  );

CREATE POLICY "camp_bookings_insert_authenticated_published"
  ON public.camp_bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organisations o
      WHERE o.id = camp_bookings.organisation_id
        AND COALESCE(o.is_published, false) = true
    )
  );

CREATE POLICY "camp_bookings_staff_manage"
  ON public.camp_bookings FOR ALL
  TO authenticated
  USING (
    organisation_id = public.get_my_org()
    AND public.get_my_role() IN ('admin', 'coach')
  )
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND public.get_my_role() IN ('admin', 'coach')
  );


-- ─── SUBSCRIPTION_PLANS ───
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscription_plans'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.subscription_plans', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_plans_select_own_org"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (organisation_id = public.get_my_org());

CREATE POLICY "subscription_plans_select_published_anon"
  ON public.subscription_plans FOR SELECT
  TO anon
  USING (
    COALESCE(active, false) = true
    AND EXISTS (
      SELECT 1 FROM public.organisations o
      WHERE o.id = subscription_plans.organisation_id
        AND COALESCE(o.is_published, false) = true
    )
  );

CREATE POLICY "subscription_plans_admin_manage"
  ON public.subscription_plans FOR ALL
  TO authenticated
  USING (
    organisation_id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  );


-- ─── Post-migration sanity check ───
SELECT
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='training_groups')    AS training_groups_policies,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='enrolments')         AS enrolments_policies,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='camps')              AS camps_policies,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='camp_bookings')      AS camp_bookings_policies,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='subscription_plans') AS subscription_plans_policies;

-- Expected result row:
--   training_groups_policies     = 5
--   enrolments_policies          = 5
--   camps_policies               = 3
--   camp_bookings_policies       = 5
--   subscription_plans_policies  = 3
