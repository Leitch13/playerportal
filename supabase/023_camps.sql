CREATE TABLE IF NOT EXISTS public.camps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  training_group_id uuid REFERENCES public.training_groups(id),
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  daily_start_time text DEFAULT '09:00',
  daily_end_time text DEFAULT '15:00',
  location text,
  age_group text,
  price decimal(10,2),
  max_capacity integer DEFAULT 30,
  image_url text,
  what_to_bring text,
  schedule jsonb DEFAULT '[]',
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read camps' AND tablename = 'camps') THEN
    CREATE POLICY "Public read camps" ON public.camps FOR SELECT USING (is_published = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage camps' AND tablename = 'camps') THEN
    CREATE POLICY "Admins manage camps" ON public.camps
      FOR ALL USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
  END IF;
END $$;
