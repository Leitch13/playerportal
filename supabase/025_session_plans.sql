CREATE TABLE IF NOT EXISTS public.session_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  coach_id uuid REFERENCES public.profiles(id),
  training_group_id uuid REFERENCES public.training_groups(id),
  title text NOT NULL,
  session_date date,
  duration_minutes integer DEFAULT 60,
  objectives text,
  warm_up text,
  main_activity text,
  cool_down text,
  equipment text,
  notes text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'completed')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  created_by uuid REFERENCES public.profiles(id),
  name text NOT NULL,
  category text CHECK (category IN ('warm_up', 'technical', 'tactical', 'physical', 'game', 'cool_down')),
  description text,
  duration_minutes integer DEFAULT 15,
  equipment text,
  min_players integer DEFAULT 2,
  max_players integer,
  age_group text,
  difficulty text DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  image_url text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drills ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Coaches manage session plans' AND tablename = 'session_plans') THEN
    CREATE POLICY "Coaches manage session plans" ON public.session_plans
      FOR ALL USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Coaches manage drills' AND tablename = 'drills') THEN
    CREATE POLICY "Coaches manage drills" ON public.drills
      FOR ALL USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
  END IF;
END $$;

-- Add attachments support to session plans and drills
ALTER TABLE public.session_plans ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';
ALTER TABLE public.drills ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';

-- Create storage bucket for coaching attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('coaching', 'coaching', true) ON CONFLICT DO NOTHING;

-- Allow authenticated users to upload to coaching bucket
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users upload coaching files' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users upload coaching files" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'coaching' AND auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read coaching files' AND tablename = 'objects') THEN
    CREATE POLICY "Public read coaching files" ON storage.objects
      FOR SELECT USING (bucket_id = 'coaching');
  END IF;
END $$;
