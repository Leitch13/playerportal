-- 094: Stop silent wrong-org account creation on signup.
--
-- BUG (closed by this migration):
--   handle_new_user used a hardcoded UUID fallback when org_slug failed to
--   resolve:
--     IF org_id IS NULL THEN
--       org_id := '00000000-0000-0000-0000-000000000001';
--     END IF;
--
--   That sentinel UUID is JSL Sports' real organisation id in production.
--   Every signup with a missing or unresolved org_slug silently created a
--   profile attached to JSL — wrong academy, locked-feeling parent, no
--   error surfaced anywhere.
--
--   Identified during the Parent Account Lockout audit (June 2026) after
--   Steven Beveridge ended up with a duplicate JSL-org account from a
--   typo'd email retry.
--
-- FIX:
--   Replace the silent fallback with a loud RAISE EXCEPTION. Signups with
--   an invalid or missing org_slug now fail at the DB boundary instead of
--   succeeding in the wrong org. The signup page (and every server-side
--   auth.admin.createUser caller) is independently updated to ALWAYS pass
--   a valid org_slug, so legitimate signups are unaffected.
--
-- WHAT'S PRESERVED FROM 091 (verbatim):
--   • role is still hardcoded 'parent' — no metadata role trust
--   • referral / notification logic identical
--   • org_slug lookup logic identical (LOWER(slug) = LOWER(...))
--
-- WHAT'S NOT TOUCHED:
--   • No existing profile rows are modified (CREATE OR REPLACE FUNCTION only)
--   • No RLS, no Stripe, no subscriptions, no payments, no enrolments
--
-- ROLLBACK:
--   Re-run migration 091 (which contains the silent-fallback version) to
--   revert this function. No data has been touched so no data rollback
--   is needed.

-- ─── PRE-CHECK ──────────────────────────────────────────────────────────────
-- Capture the CURRENT function source so we can confirm what we're replacing.
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';

-- ─── THE FIX ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id uuid;
  ref_code text;
  referrer_profile_id uuid;
  new_referral_code text;
BEGIN
  -- Look up the organisation from the slug
  IF new.raw_user_meta_data->>'org_slug' IS NOT NULL THEN
    SELECT id INTO org_id
    FROM public.organisations
    WHERE LOWER(slug) = LOWER(new.raw_user_meta_data->>'org_slug');
  END IF;

  -- Fail loud instead of silently parking the user in a sentinel org.
  -- Legitimate signups always carry a valid org_slug; bad-slug signups
  -- should error so the caller (signup page / API route) can surface a
  -- meaningful message instead of dumping the parent in the wrong academy.
  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Signup org_slug "%" did not resolve to an organisation',
      coalesce(new.raw_user_meta_data->>'org_slug', '(missing)');
  END IF;

  -- Generate a unique referral code for this user
  new_referral_code := UPPER(SUBSTR(MD5(new.id::text || now()::text), 1, 8));

  -- Insert the profile with the auto-generated referral code.
  -- SECURITY (from migration 091): role is hardcoded 'parent' and NEVER taken
  -- from metadata. Staff (coach/admin) are provisioned server-side with the
  -- service-role key only.
  INSERT INTO public.profiles (id, email, full_name, phone, role, organisation_id, referral_code)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'phone',
    'parent'::public.user_role,
    org_id,
    new_referral_code
  );

  -- Check if this user was referred by someone (ref code passed in metadata).
  -- Preserved verbatim from 091.
  ref_code := new.raw_user_meta_data->>'ref_code';
  IF ref_code IS NOT NULL AND ref_code != '' THEN
    -- Find the referrer by their referral code
    SELECT id INTO referrer_profile_id
    FROM public.profiles
    WHERE referral_code = ref_code
    LIMIT 1;

    IF referrer_profile_id IS NOT NULL THEN
      -- Mark who referred this user
      UPDATE public.profiles
      SET referred_by = referrer_profile_id
      WHERE id = new.id;

      -- Create the referral record (auto status = signed_up since they actually signed up)
      INSERT INTO public.referrals (organisation_id, referrer_id, referred_id, referral_code, status)
      VALUES (org_id, referrer_profile_id, new.id, ref_code, 'signed_up');

      -- Create a notification for the referrer
      INSERT INTO public.notifications (profile_id, organisation_id, type, title, message, link)
      VALUES (
        referrer_profile_id,
        org_id,
        'general',
        'New Referral Signup!',
        coalesce(new.raw_user_meta_data->>'full_name', 'Someone') || ' just signed up using your referral link!',
        '/dashboard/referrals'
      );
    END IF;
  END IF;

  RETURN new;
END;
$$;

-- ─── PROOF (paste all three booleans back; all must be TRUE) ────────────────
SELECT
  -- Confirms the fallback line is gone
  (position('00000000-0000-0000-0000-000000000001' in prosrc) = 0) AS fallback_uuid_removed,
  -- Confirms we now raise instead
  (position('RAISE EXCEPTION ''Signup org_slug' in prosrc) > 0)    AS fail_loud_enforced,
  -- Confirms migration 091's role hardening is still in place
  (position('''parent''::public.user_role' in prosrc) > 0)         AS role_still_hardcoded_to_parent
FROM pg_proc
WHERE proname = 'handle_new_user';
