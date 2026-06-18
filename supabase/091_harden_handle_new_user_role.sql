-- 091: Harden handle_new_user against role-escalation via user metadata.
--
-- VULNERABILITY (closed by this migration):
--   The public signup page wrote a URL-supplied role (?role=admin / ?role=coach)
--   into auth user metadata, and handle_new_user trusted it verbatim:
--       coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'parent')
--   Anyone who knew an academy's public slug could therefore self-provision as
--   that academy's admin/coach — a multi-tenant takeover. The frontend fix (always
--   send role='parent') is necessary but NOT sufficient: a direct supabase.auth.signUp
--   call bypassing the page could still pass role=admin in metadata. This migration
--   makes the DB the authoritative boundary: trigger-created profiles are ALWAYS
--   'parent', regardless of metadata.
--
-- WHY THIS BREAKS NOTHING LEGITIMATE:
--   The only path that creates non-parent profiles is the server-side academy
--   onboarding route (api/onboard/signup), which writes role='admin' itself using
--   the service-role key AFTER the trigger runs (explicit UPDATE/INSERT). It does
--   not rely on the trigger honouring metadata. The migration importer likewise
--   upserts role='parent' explicitly. So coercing the trigger to 'parent' leaves
--   every legitimate path intact. Existing admins/coaches are untouched — this is
--   CREATE OR REPLACE on the function only; it contains NO writes to existing rows.
--
-- This function body is migration 010's verbatim, with the SINGLE change being the
-- role expression on the INSERT (referral logic preserved exactly).

-- ─── PRE-CHECK (run first; paste the result back) ───────────────────────────
-- Capture the CURRENT live function source so we can confirm it matches migration
-- 010 before replacing. If the body differs from 010 by anything other than the
-- role line, STOP and review — the live function drifted via a direct DB edit.
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';

-- ─── THE HARDENING ──────────────────────────────────────────────────────────
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

  IF org_id IS NULL THEN
    org_id := '00000000-0000-0000-0000-000000000001';
  END IF;

  -- Generate a unique referral code for this user
  new_referral_code := UPPER(SUBSTR(MD5(new.id::text || now()::text), 1, 8));

  -- Insert the profile with the auto-generated referral code.
  -- SECURITY: role is hardcoded 'parent' and NEVER taken from metadata. Staff
  -- (coach/admin) are provisioned server-side with the service-role key only.
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

  -- Check if this user was referred by someone (ref code passed in metadata)
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

-- ─── PROOF (paste both booleans back; both must be TRUE) ─────────────────────
SELECT
  (position('raw_user_meta_data->>''role''' in prosrc) = 0) AS metadata_role_no_longer_trusted,
  (position('''parent''::public.user_role' in prosrc) > 0)  AS role_hardcoded_to_parent
FROM pg_proc
WHERE proname = 'handle_new_user';
