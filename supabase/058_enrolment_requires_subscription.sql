-- Block parents from enrolling without an active subscription.
-- Previously the "Parents enrol own children" policy only checked org membership
-- and player ownership — meaning parents could book unlimited classes from the
-- schedule page without paying. This restores the paywall at the database layer.
--
-- A parent is allowed to enrol IF they have at least one subscription in the
-- same org with status in ('active', 'trialing'). Cancelled / past_due / unpaid
-- subscriptions don't grant new enrolment rights.

DROP POLICY IF EXISTS "Parents enrol own children" ON public.enrolments;
DROP POLICY IF EXISTS "Parents enrol own children with active sub" ON public.enrolments;

CREATE POLICY "Parents enrol own children with active sub"
  ON public.enrolments FOR INSERT
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND player_id IN (SELECT id FROM public.players WHERE parent_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.parent_id = auth.uid()
        AND s.organisation_id = public.get_my_org()
        AND s.status IN ('active', 'trialing')
    )
  );
