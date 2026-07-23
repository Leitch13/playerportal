-- Migration 100 — restore the enrolment subscription paywall (RLS)
--
-- WHAT WENT WRONG
-- Migration 058 added a WITH CHECK requiring an active/trialing subscription
-- before a parent could self-insert an enrolment — "restores the paywall at the
-- database layer." Migration 077b (a tenant-isolation lockdown) later dropped
-- EVERY enrolments policy and recreated `enrolments_parent_insert` WITHOUT the
-- subscription clause — silently reverting the paywall. Nobody noticed; 078's
-- own comment even describes the policy as "authenticated-only."
--
-- IMPACT (confirmed live 2026-07-23)
-- Any logged-in parent could self-enrol their own child into unlimited classes
-- for free, straight past the subscription paywall the product is built on. Two
-- throwaway accounts at Gold & Gray each enrolled a child into ~40 classes with
-- zero subscriptions — impossible if this check had been in place.
--
-- FIX
-- Recreate `enrolments_parent_insert` with BOTH 077b's org + ownership checks
-- AND 058's active-subscription requirement. Legitimate enrolment paths are
-- unaffected because they do not go through this policy:
--   • Stripe webhook + enrol_if_capacity_available RPC → SECURITY DEFINER, bypass RLS
--   • admin add-player / migration import → service-role, bypass RLS
-- Only the parent client-side "book a class" insert (BookClassButton) is gated —
-- exactly the surface that must require payment.
--
-- NOTE on scope of "active": mirrors 058 — only 'active'/'trialing' grant new
-- enrolment rights. 'pending_migration', 'past_due', 'cancelled', 'unpaid' do
-- NOT. (Relevant to G&G: imported members sit 'pending_migration' with their
-- classes ALREADY enrolled via the service-role import, so they are unaffected;
-- they simply can't self-add NEW classes until their subscription goes active.)

DROP POLICY IF EXISTS "enrolments_parent_insert" ON public.enrolments;

CREATE POLICY "enrolments_parent_insert"
  ON public.enrolments FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = enrolments.player_id
        AND p.parent_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.parent_id = auth.uid()
        AND s.organisation_id = public.get_my_org()
        AND s.status IN ('active', 'trialing')
    )
  );

-- Rollback (paste into SQL editor to revert to the open 077b policy):
--   DROP POLICY IF EXISTS "enrolments_parent_insert" ON public.enrolments;
--   CREATE POLICY "enrolments_parent_insert" ON public.enrolments FOR INSERT TO authenticated
--     WITH CHECK (organisation_id = public.get_my_org()
--       AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = enrolments.player_id AND p.parent_id = auth.uid()));
