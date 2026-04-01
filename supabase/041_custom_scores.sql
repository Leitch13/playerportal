-- Custom scoring categories per organisation
CREATE TABLE IF NOT EXISTS public.scoring_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  name text NOT NULL,
  description text,
  icon text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.scoring_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Org users read scoring categories' AND tablename = 'scoring_categories') THEN
    CREATE POLICY "Org users read scoring categories" ON public.scoring_categories FOR SELECT USING (organisation_id = public.get_my_org());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage scoring categories' AND tablename = 'scoring_categories') THEN
    CREATE POLICY "Admins manage scoring categories" ON public.scoring_categories FOR ALL USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
  END IF;
END $$;
