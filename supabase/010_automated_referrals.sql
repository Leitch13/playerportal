-- 010: Automated Referral System
-- Auto-generates referral codes for all parents
-- Tracks referrals when new users sign up with a ref code
-- Notifies the referrer automatically

-- ─── Step 1: Generate referral codes for existing parents who don't have one ───
UPDATE profiles
SET referral_code = UPPER(SUBSTR(MD5(id::text || now()::text), 1, 8))
WHERE role = 'parent'
  AND (referral_code IS NULL OR referral_code = '');

-- ─── Step 2: Update handle_new_user to auto-generate referral code + track referrals ───
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

  -- Insert the profile with the auto-generated referral code
  INSERT INTO public.profiles (id, email, full_name, phone, role, organisation_id, referral_code)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'parent'),
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
