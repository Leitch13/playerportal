-- Fix scoring_categories RLS so custom fields actually insert.
-- Original policy used USING only (covers SELECT/UPDATE/DELETE on existing rows).
-- INSERT needs WITH CHECK to authorise NEW rows — without it, the row is silently rejected.

DROP POLICY IF EXISTS "Admins manage scoring categories" ON public.scoring_categories;

CREATE POLICY "Admins manage scoring categories"
  ON public.scoring_categories
  FOR ALL
  USING (
    organisation_id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  );

-- Sanity check
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'scoring_categories'
ORDER BY policyname;
