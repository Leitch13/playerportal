-- 035: Review prompts — automated Google review collection after 10 sessions
CREATE TABLE IF NOT EXISTS public.review_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id),
  organisation_id uuid REFERENCES public.organisations(id),
  player_id uuid REFERENCES public.players(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'happy', 'unhappy', 'reviewed', 'dismissed')),
  rating integer,
  feedback text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.review_prompts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own review prompts' AND tablename = 'review_prompts') THEN
    CREATE POLICY "Users manage own review prompts" ON public.review_prompts FOR ALL USING (profile_id = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins read review prompts' AND tablename = 'review_prompts') THEN
    CREATE POLICY "Admins read review prompts" ON public.review_prompts FOR SELECT USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
  END IF;
END $$;

-- Add Google Review URL to organisations
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS google_review_url text;
