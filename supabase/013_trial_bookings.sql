-- 013: Trial bookings
CREATE TABLE IF NOT EXISTS public.trial_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  training_group_id uuid REFERENCES public.training_groups(id),
  parent_name text NOT NULL,
  parent_email text NOT NULL,
  parent_phone text,
  child_name text NOT NULL,
  child_age integer,
  preferred_date date,
  notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'attended', 'no_show', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz
);

ALTER TABLE public.trial_bookings ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public booking form)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can book trials' AND tablename = 'trial_bookings') THEN
    CREATE POLICY "Public can book trials" ON public.trial_bookings
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Admins can read and manage their org's trials
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage trials' AND tablename = 'trial_bookings') THEN
    CREATE POLICY "Admins manage trials" ON public.trial_bookings
      FOR ALL USING (
        organisation_id = public.get_my_org()
        AND public.get_my_role() IN ('admin', 'coach')
      );
  END IF;
END $$;
