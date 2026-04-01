-- Leads pipeline: track enquiries from initial contact through to enrolment
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  source TEXT NOT NULL DEFAULT 'manual', -- 'facebook', 'website', 'phone', 'walk_in', 'referral', 'manual'
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  child_name TEXT,
  child_age INTEGER,
  interested_in TEXT, -- class type or group name
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'trial_booked', 'trial_attended', 'enrolled', 'lost'
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  follow_up_date DATE,
  lost_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Org members read leads' AND tablename = 'leads') THEN
    CREATE POLICY "Org members read leads" ON public.leads FOR SELECT USING (organisation_id = public.get_my_org());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage leads' AND tablename = 'leads') THEN
    CREATE POLICY "Admins manage leads" ON public.leads FOR ALL USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_org ON public.leads(organisation_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON public.leads(created_at DESC);
