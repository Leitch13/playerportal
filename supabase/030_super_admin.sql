-- ============================================================
-- 030: Super Admin — Platform-level admin flag & RLS
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- Add super_admin flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;

-- Set the platform owner as super admin
UPDATE public.profiles SET is_super_admin = true WHERE email = 'johnleitch970@gmail.com';

-- RLS policy for super admin access to all orgs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Super admins read all orgs' AND tablename = 'organisations') THEN
    CREATE POLICY "Super admins read all orgs" ON public.organisations
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
      );
  END IF;
END $$;
