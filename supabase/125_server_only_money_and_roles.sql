-- ═══════════════════════════════════════════════════════════════════
-- Migration 125: only the server can change who is an admin, what an
-- academy pays, membership status and discount codes
-- ═══════════════════════════════════════════════════════════════════
-- 6 Nov 2026 security audit. The browser talks to the database with the
-- public key, and these rules checked WHOSE row was changed but not WHICH
-- boxes. A signed-in parent could:
--   - make themselves admin of any academy, or platform admin (profiles)
--   - mark their own membership 'active' without paying (subscriptions)
--   - create a 100%-off code (promo_codes)
--   - enrol their child free through the enrolment function
--   - read the academy's leads, list every child's photo, overwrite photos
-- and an academy admin could switch their own plan / fee / £35 status.
--
-- Normal edits keep working: names, phones, colours, policies, staff screens.
-- Safe to run more than once. Ends with a check you can read.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Profiles: role, academy, platform admin, email and Stripe customer are
--    changed only by the server. An academy admin may still change the role
--    of, or remove, OTHER people in their own academy (Settings → Team).
CREATE OR REPLACE FUNCTION public.guard_profile_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Server (service key), SQL editor and auth system have no signed-in user.
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'Not allowed to change this' USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
    IF NEW.id = auth.uid()
       OR COALESCE(public.get_my_role(), '') <> 'admin'
       OR OLD.organisation_id IS NULL
       OR OLD.organisation_id IS DISTINCT FROM public.get_my_org()
       OR (NEW.organisation_id IS NOT NULL AND NEW.organisation_id <> public.get_my_org()) THEN
      RAISE EXCEPTION 'Not allowed to change role or academy' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_columns ON public.profiles;
CREATE TRIGGER guard_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_columns();

-- 2. Organisations: plan, fee, £35 status, pilot, Stripe account and coupons
--    are changed only by the server or the platform admin.
CREATE OR REPLACE FUNCTION public.guard_organisation_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.platform_plan_id IS DISTINCT FROM OLD.platform_plan_id
     OR NEW.platform_subscription_status IS DISTINCT FROM OLD.platform_subscription_status
     OR NEW.platform_trial_ends_at IS DISTINCT FROM OLD.platform_trial_ends_at
     OR NEW.platform_stripe_subscription_id IS DISTINCT FROM OLD.platform_stripe_subscription_id
     OR NEW.pilot IS DISTINCT FROM OLD.pilot
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_retention_coupon_id IS DISTINCT FROM OLD.stripe_retention_coupon_id
     OR NEW.stripe_sibling_coupon_id IS DISTINCT FROM OLD.stripe_sibling_coupon_id
     OR NEW.bridge_billing_mode IS DISTINCT FROM OLD.bridge_billing_mode
     OR NEW.referred_by_org_id IS DISTINCT FROM OLD.referred_by_org_id THEN
    RAISE EXCEPTION 'Billing settings are changed by Player Portal only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_organisation_columns ON public.organisations;
CREATE TRIGGER guard_organisation_columns
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.guard_organisation_columns();

-- An academy admin can no longer create or delete whole academies from the browser.
DROP POLICY IF EXISTS organisations_admin_manage_own ON public.organisations;
DROP POLICY IF EXISTS organisations_admin_update_own ON public.organisations;
CREATE POLICY organisations_admin_update_own ON public.organisations
  FOR UPDATE TO authenticated
  USING (id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (id = public.get_my_org() AND public.get_my_role() = 'admin');

-- 3. Memberships: parents can SEE their own; only academy admins (and the
--    server) can create or change them.
DROP POLICY IF EXISTS "Org members manage org subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_admin_manage ON public.subscriptions;
CREATE POLICY subscriptions_admin_manage ON public.subscriptions
  FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');

-- 4. Discount codes: academy admins create and change them; coaches can see
--    them; parents can't see or touch them (the server checks codes at checkout).
DROP POLICY IF EXISTS promo_codes_select ON public.promo_codes;
DROP POLICY IF EXISTS promo_codes_insert ON public.promo_codes;
DROP POLICY IF EXISTS promo_codes_update ON public.promo_codes;
DROP POLICY IF EXISTS promo_codes_delete ON public.promo_codes;
DROP POLICY IF EXISTS promo_codes_staff_select ON public.promo_codes;
DROP POLICY IF EXISTS promo_codes_admin_manage ON public.promo_codes;
CREATE POLICY promo_codes_staff_select ON public.promo_codes
  FOR SELECT TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
CREATE POLICY promo_codes_admin_manage ON public.promo_codes
  FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');

-- 5. Enrolments: parents no longer edit enrolment rows directly (they could
--    reactivate a cancelled place or switch class). Booking and cancelling go
--    through the server, which checks payment.
DROP POLICY IF EXISTS enrolments_parent_update ON public.enrolments;

-- 6. Leads: staff only (any parent could read the academy's prospect list).
DROP POLICY IF EXISTS "Org members read leads" ON public.leads;

-- 7. Camp bookings: no public insert (repeat of 124, in case it wasn't run).
DROP POLICY IF EXISTS "Public book camps" ON public.camp_bookings;

-- 8. Children's photos: nobody can LIST the folder any more (photo links
--    already on pages keep working). Only whoever uploaded a file can
--    replace or delete it.
DROP POLICY IF EXISTS "Anyone can view player photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update player photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete player photos" ON storage.objects;
DROP POLICY IF EXISTS player_photos_owner_select ON storage.objects;
DROP POLICY IF EXISTS player_photos_owner_update ON storage.objects;
DROP POLICY IF EXISTS player_photos_owner_delete ON storage.objects;
CREATE POLICY player_photos_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-photos' AND owner = auth.uid());
CREATE POLICY player_photos_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'player-photos' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'player-photos' AND owner = auth.uid());
CREATE POLICY player_photos_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'player-photos' AND owner = auth.uid());

-- Logos and banners: no uploads without signing in; only the uploader can
-- replace or delete a file (a parent could overwrite another academy's logo).
DROP POLICY IF EXISTS "Anyone can upload branding" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update branding" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete branding" ON storage.objects;
DROP POLICY IF EXISTS branding_owner_update ON storage.objects;
DROP POLICY IF EXISTS branding_owner_delete ON storage.objects;
CREATE POLICY branding_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'branding' AND owner = auth.uid());
CREATE POLICY branding_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND owner = auth.uid());

-- 9. Enrolment function: signed-in callers must be staff of that academy.
CREATE OR REPLACE FUNCTION public.enrol_if_capacity_available(
  p_player_id    uuid,
  p_group_id     uuid,
  p_org_id       uuid,
  p_status       text DEFAULT 'active',
  p_activates_on date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_capacity    int;
  v_current_count   int;
  v_existing_id     uuid;
  v_existing_status text;
  v_new_id          uuid;
BEGIN
  -- 125: a signed-in caller must be staff of this academy (or platform admin).
  -- The server (service key, no auth.uid()) is unchanged. Parents book through
  -- /api/enrolments/book, which checks payment first and calls with the service key.
  IF auth.uid() IS NOT NULL
     AND NOT public.is_super_admin()
     AND NOT (public.get_my_role() IN ('admin', 'coach') AND public.get_my_org() = p_org_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_allowed');
  END IF;

  IF p_status NOT IN ('active', 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', p_status);
  END IF;

  SELECT max_capacity INTO v_max_capacity
  FROM public.training_groups
  WHERE id = p_group_id AND organisation_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'group_not_found');
  END IF;

  v_max_capacity := COALESCE(v_max_capacity, 20);

  SELECT id, status::text INTO v_existing_id, v_existing_status
  FROM public.enrolments
  WHERE player_id = p_player_id AND group_id = p_group_id
  LIMIT 1;

  -- Live row → same idempotent no-op as before.
  IF v_existing_id IS NOT NULL AND v_existing_status IN ('active', 'pending') THEN
    RETURN jsonb_build_object('ok', true, 'enrolment_id', v_existing_id, 'idempotent', true);
  END IF;

  -- Capacity check (active + pending only; cancelled excluded).
  SELECT count(*) INTO v_current_count
  FROM public.enrolments
  WHERE group_id = p_group_id
    AND status IN ('active', 'pending');

  IF v_current_count >= v_max_capacity THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'class_full',
      'count', v_current_count, 'capacity', v_max_capacity
    );
  END IF;

  -- Cancelled row exists → REACTIVATE it (this was the silent-vanish bug).
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.enrolments
    SET status = p_status::enrolment_status,
        activates_on = p_activates_on,
        enrolled_at = now(),
        is_trial = false,          -- clear stale trial state from the row''s past life;
        trial_expires_at = NULL    -- the move flow re-applies trial fields when appropriate
    WHERE id = v_existing_id;
    RETURN jsonb_build_object('ok', true, 'enrolment_id', v_existing_id, 'reactivated', true);
  END IF;

  -- No row at all → fresh insert (unchanged).
  INSERT INTO public.enrolments (player_id, group_id, organisation_id, status, activates_on)
  VALUES (p_player_id, p_group_id, p_org_id, p_status::enrolment_status, p_activates_on)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'enrolment_id', v_new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.enrol_if_capacity_available(uuid, uuid, uuid, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enrol_if_capacity_available(uuid, uuid, uuid, text, date) TO authenticated, service_role;

-- Check (read the result): triggers present, parent write rules gone.
SELECT 'triggers' AS what, string_agg(tgname, ', ') AS result FROM pg_trigger
  WHERE tgname IN ('guard_profile_columns', 'guard_organisation_columns')
UNION ALL
SELECT 'subscription write rules', string_agg(policyname, ', ') FROM pg_policies
  WHERE tablename = 'subscriptions' AND cmd <> 'SELECT'
UNION ALL
SELECT 'promo rules', string_agg(policyname, ', ') FROM pg_policies WHERE tablename = 'promo_codes'
UNION ALL
SELECT 'leads rules', string_agg(policyname, ', ') FROM pg_policies WHERE tablename = 'leads'
UNION ALL
SELECT 'photo rules', string_agg(policyname || ':' || cmd, ', ') FROM pg_policies
  WHERE schemaname = 'storage' AND (policyname ILIKE '%player%' OR policyname ILIKE '%branding%');
