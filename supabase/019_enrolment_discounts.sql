-- Track retention discounts applied to enrolments
CREATE TABLE IF NOT EXISTS public.enrolment_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id uuid REFERENCES public.enrolments(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id),
  profile_id uuid REFERENCES public.profiles(id),
  organisation_id uuid REFERENCES public.organisations(id),
  discount_percent integer NOT NULL DEFAULT 50,
  months_remaining integer NOT NULL DEFAULT 2,
  reason text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used_up', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.enrolment_discounts ENABLE ROW LEVEL SECURITY;

-- Parents can see their own discounts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents see own discounts' AND tablename = 'enrolment_discounts') THEN
    CREATE POLICY "Parents see own discounts" ON public.enrolment_discounts
      FOR SELECT USING (profile_id = auth.uid());
  END IF;
END $$;

-- Parents can insert (via retention flow)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents create own discounts' AND tablename = 'enrolment_discounts') THEN
    CREATE POLICY "Parents create own discounts" ON public.enrolment_discounts
      FOR INSERT WITH CHECK (profile_id = auth.uid());
  END IF;
END $$;

-- Admins can see all for their org
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage discounts' AND tablename = 'enrolment_discounts') THEN
    CREATE POLICY "Admins manage discounts" ON public.enrolment_discounts
      FOR ALL USING (
        organisation_id = public.get_my_org()
        AND public.get_my_role() IN ('admin')
      );
  END IF;
END $$;
