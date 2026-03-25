-- Allow parents to cancel their own children's enrolments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents cancel own enrolments' AND tablename = 'enrolments') THEN
    CREATE POLICY "Parents cancel own enrolments"
      ON public.enrolments FOR UPDATE
      USING (
        organisation_id = public.get_my_org()
        AND player_id IN (SELECT id FROM public.players WHERE parent_id = auth.uid())
      )
      WITH CHECK (
        organisation_id = public.get_my_org()
        AND player_id IN (SELECT id FROM public.players WHERE parent_id = auth.uid())
      );
  END IF;
END $$;
