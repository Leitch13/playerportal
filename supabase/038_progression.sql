-- 038: Player Progression Passport — Duolingo-style skill levelling
CREATE TABLE IF NOT EXISTS public.skill_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  current_level integer DEFAULT 1,
  current_xp integer DEFAULT 0,
  xp_to_next integer DEFAULT 100,
  last_assessed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.skill_levels ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own skill levels' AND tablename = 'skill_levels') THEN
    CREATE POLICY "Users read own skill levels" ON public.skill_levels FOR SELECT USING (
      player_id IN (SELECT id FROM public.players WHERE parent_id = auth.uid())
      OR public.get_my_role() IN ('admin', 'coach')
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff manage skill levels' AND tablename = 'skill_levels') THEN
    CREATE POLICY "Staff manage skill levels" ON public.skill_levels FOR ALL USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
  END IF;
END $$;
