-- Allow parents to enrol their own children in classes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents enrol own children' AND tablename = 'enrolments') THEN
    CREATE POLICY "Parents enrol own children"
      ON public.enrolments FOR INSERT
      WITH CHECK (
        organisation_id = public.get_my_org()
        AND player_id IN (SELECT id FROM public.players WHERE parent_id = auth.uid())
      );
  END IF;
END $$;
