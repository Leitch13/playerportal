-- Coach CPD (Continuing Professional Development) & Certification Tracker
-- Migration: 036_coach_cpd.sql

CREATE TABLE IF NOT EXISTS public.coach_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  organisation_id uuid REFERENCES public.organisations(id),
  name text NOT NULL,
  type text CHECK (type IN ('fa_coaching', 'dbs', 'first_aid', 'safeguarding', 'other')),
  issued_date date,
  expiry_date date,
  certificate_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'expiring', 'expired')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cpd_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  organisation_id uuid REFERENCES public.organisations(id),
  title text NOT NULL,
  description text,
  hours numeric(5,1) NOT NULL,
  date date NOT NULL,
  evidence_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.coach_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpd_hours ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Coaches manage own certs' AND tablename = 'coach_certifications') THEN
    CREATE POLICY "Coaches manage own certs" ON public.coach_certifications FOR ALL USING (profile_id = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins read all certs' AND tablename = 'coach_certifications') THEN
    CREATE POLICY "Admins read all certs" ON public.coach_certifications FOR SELECT USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Coaches manage own cpd' AND tablename = 'cpd_hours') THEN
    CREATE POLICY "Coaches manage own cpd" ON public.cpd_hours FOR ALL USING (profile_id = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins read all cpd' AND tablename = 'cpd_hours') THEN
    CREATE POLICY "Admins read all cpd" ON public.cpd_hours FOR SELECT USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
  END IF;
END $$;
