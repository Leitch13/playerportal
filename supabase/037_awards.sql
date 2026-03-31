-- Academy Awards: termly/annual leaderboards, digital trophies, shareable certificates
CREATE TABLE IF NOT EXISTS public.academy_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  player_id uuid REFERENCES public.players(id),
  profile_id uuid REFERENCES public.profiles(id),
  award_type text NOT NULL CHECK (award_type IN ('player_of_term', 'most_improved', 'best_attendance', 'coaches_award', 'golden_boot', 'team_player', 'rising_star', 'custom')),
  custom_title text,
  term_id uuid REFERENCES public.terms(id),
  notes text,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.academy_awards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Everyone reads awards' AND tablename = 'academy_awards') THEN
    CREATE POLICY "Everyone reads awards" ON public.academy_awards FOR SELECT USING (organisation_id = public.get_my_org());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage awards' AND tablename = 'academy_awards') THEN
    CREATE POLICY "Admins manage awards" ON public.academy_awards FOR ALL USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
  END IF;
END $$;
