-- ═══════════════════════════════════════════════════════════════════
-- Migration 077a — profiles + organisations RLS lockdown
-- ═══════════════════════════════════════════════════════════════════
-- Minimal slice of the original 077. Two tables only:
--   • profiles
--   • organisations
-- If this commits cleanly, the wider 077b sweep (training_groups,
-- enrolments, camps, camp_bookings, subscription_plans, waitlist,
-- attendance) follows in a separate migration.
--
-- This migration is INTENTIONALLY narrow so any error in the SQL
-- editor's results panel pinpoints the failing statement.
--
-- Apply: paste, click Run, watch for green tick.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Helper: super-admin check (idempotent) ───
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ═══════════════════════════════════════════════════════════════════
-- PROFILES — drop every existing policy, recreate the strict set
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1) See own profile
CREATE POLICY "profiles_select_self"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- 2) Staff (admin/coach) see every profile in THEIR own org
CREATE POLICY "profiles_select_staff_view_own_org"
  ON public.profiles FOR SELECT
  USING (
    organisation_id = public.get_my_org()
    AND public.get_my_role() IN ('admin', 'coach')
  );

-- 3) Anyone in an org can see that org's staff (parents need this for
--    the in-app messaging recipient picker — they message coach/admin).
CREATE POLICY "profiles_select_own_org_staff_for_messaging"
  ON public.profiles FOR SELECT
  USING (
    organisation_id = public.get_my_org()
    AND role IN ('admin', 'coach')
  );

-- 4) Super admin global read
CREATE POLICY "profiles_select_super_admin"
  ON public.profiles FOR SELECT
  USING (public.is_super_admin());

-- 5) Update own profile
CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 6) Org admin manages own-org profiles
CREATE POLICY "profiles_admin_manage_own_org"
  ON public.profiles FOR ALL
  USING (
    organisation_id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  );

-- 7) Super admin full
CREATE POLICY "profiles_super_admin_all"
  ON public.profiles FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());


-- ═══════════════════════════════════════════════════════════════════
-- ORGANISATIONS — drop every existing policy, recreate the strict set
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organisations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organisations', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- 1) Authenticated user sees ONLY their own org
CREATE POLICY "organisations_select_own"
  ON public.organisations FOR SELECT
  TO authenticated
  USING (id = public.get_my_org());

-- 2) Anonymous sees PUBLISHED orgs only (for public /book/[slug] pages)
CREATE POLICY "organisations_select_published_anon"
  ON public.organisations FOR SELECT
  TO anon
  USING (COALESCE(is_published, false) = true);

-- 3) Super admin global read
CREATE POLICY "organisations_select_super_admin"
  ON public.organisations FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- 4) Org admin manages own org
CREATE POLICY "organisations_admin_manage_own"
  ON public.organisations FOR ALL
  TO authenticated
  USING (
    id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  );

-- 5) Super admin full
CREATE POLICY "organisations_super_admin_all"
  ON public.organisations FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());


-- ═══════════════════════════════════════════════════════════════════
-- POST-MIGRATION SANITY (visible in the results panel)
-- ═══════════════════════════════════════════════════════════════════
SELECT
  (SELECT 1 FROM pg_proc
     WHERE proname = 'is_super_admin'
       AND pronamespace = 'public'::regnamespace) AS function_created,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='profiles')      AS profiles_policy_count,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='organisations') AS organisations_policy_count;

-- Expected row when this migration commits:
--   function_created = 1
--   profiles_policy_count = 7
--   organisations_policy_count = 5
