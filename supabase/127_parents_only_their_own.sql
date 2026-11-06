-- ═══════════════════════════════════════════════════════════════════
-- Migration 127: on the smaller tables, parents only touch their own
-- ═══════════════════════════════════════════════════════════════════
-- 6 Nov 2026 security audit. Early tables (008/009/043) checked only "same
-- academy", so any parent could edit the academy's events and waivers, delete
-- gallery photos, mark referrals rewarded, read coach hours and every family's
-- waiver signatures and documents, offer waiting-list places, send in-app
-- notifications to anyone, or add themselves to another family's messages.
--
-- What parents still do (unchanged): see events and book their own child (a
-- paid event stays unpaid until they pay), sign a waiver for their own child,
-- see their own documents, join a waiting list, message staff, read and clear
-- their own notifications. Staff screens are unchanged.
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

-- Events: staff manage, everyone in the academy sees.
DROP POLICY IF EXISTS events_insert ON public.events;
DROP POLICY IF EXISTS events_update ON public.events;
DROP POLICY IF EXISTS events_delete ON public.events;
DROP POLICY IF EXISTS events_staff_manage ON public.events;
CREATE POLICY events_staff_manage ON public.events FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'))
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- Event bookings: parents book their own child, unpaid unless the event is free.
DROP POLICY IF EXISTS event_bookings_insert ON public.event_bookings;
DROP POLICY IF EXISTS event_bookings_update ON public.event_bookings;
DROP POLICY IF EXISTS event_bookings_select ON public.event_bookings;
DROP POLICY IF EXISTS event_bookings_staff_manage ON public.event_bookings;
DROP POLICY IF EXISTS event_bookings_parent_insert ON public.event_bookings;
DROP POLICY IF EXISTS event_bookings_parent_select ON public.event_bookings;
CREATE POLICY event_bookings_staff_manage ON public.event_bookings FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'))
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
CREATE POLICY event_bookings_parent_select ON public.event_bookings FOR SELECT TO authenticated
  USING (parent_id = auth.uid());
CREATE POLICY event_bookings_parent_insert ON public.event_bookings FOR INSERT TO authenticated
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND parent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.parent_id = auth.uid())
    AND COALESCE(amount_paid, 0) = 0
    AND (payment_status IS DISTINCT FROM 'paid'
         OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND COALESCE(e.price, 0) = 0))
  );

-- Waivers: staff write the text; everyone in the academy reads it.
DROP POLICY IF EXISTS waivers_insert ON public.waivers;
DROP POLICY IF EXISTS waivers_update ON public.waivers;
DROP POLICY IF EXISTS waivers_staff_manage ON public.waivers;
CREATE POLICY waivers_staff_manage ON public.waivers FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'))
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- Waiver signatures: a parent signs for their own child and sees their own.
DROP POLICY IF EXISTS waiver_signatures_insert ON public.waiver_signatures;
DROP POLICY IF EXISTS waiver_signatures_select ON public.waiver_signatures;
DROP POLICY IF EXISTS waiver_signatures_staff_select ON public.waiver_signatures;
DROP POLICY IF EXISTS waiver_signatures_parent_select ON public.waiver_signatures;
DROP POLICY IF EXISTS waiver_signatures_parent_insert ON public.waiver_signatures;
CREATE POLICY waiver_signatures_staff_select ON public.waiver_signatures FOR SELECT TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
CREATE POLICY waiver_signatures_parent_select ON public.waiver_signatures FOR SELECT TO authenticated
  USING (parent_id = auth.uid());
CREATE POLICY waiver_signatures_parent_insert ON public.waiver_signatures FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_my_org() AND parent_id = auth.uid()
    AND (player_id IS NULL OR EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.parent_id = auth.uid())));

-- Gallery: staff upload and delete; everyone in the academy sees.
DROP POLICY IF EXISTS gallery_photos_insert ON public.gallery_photos;
DROP POLICY IF EXISTS gallery_photos_update ON public.gallery_photos;
DROP POLICY IF EXISTS gallery_photos_delete ON public.gallery_photos;
DROP POLICY IF EXISTS gallery_photos_staff_manage ON public.gallery_photos;
CREATE POLICY gallery_photos_staff_manage ON public.gallery_photos FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'))
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- Coach hours (pay): staff only.
DROP POLICY IF EXISTS coach_hours_insert ON public.coach_hours;
DROP POLICY IF EXISTS coach_hours_update ON public.coach_hours;
DROP POLICY IF EXISTS coach_hours_select ON public.coach_hours;
DROP POLICY IF EXISTS coach_hours_staff_manage ON public.coach_hours;
CREATE POLICY coach_hours_staff_manage ON public.coach_hours FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'))
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- Referrals: only an academy admin marks one rewarded.
DROP POLICY IF EXISTS referrals_update ON public.referrals;
DROP POLICY IF EXISTS referrals_admin_update ON public.referrals;
CREATE POLICY referrals_admin_update ON public.referrals FOR UPDATE TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');

-- Achievements: staff create and award.
DROP POLICY IF EXISTS achievements_insert ON public.achievements;
DROP POLICY IF EXISTS achievements_update ON public.achievements;
DROP POLICY IF EXISTS achievements_staff_manage ON public.achievements;
CREATE POLICY achievements_staff_manage ON public.achievements FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'))
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
DROP POLICY IF EXISTS player_achievements_insert ON public.player_achievements;
DROP POLICY IF EXISTS player_achievements_staff_insert ON public.player_achievements;
CREATE POLICY player_achievements_staff_insert ON public.player_achievements FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- Make-up bookings: no browser writes exist; staff only (the server is unaffected).
DROP POLICY IF EXISTS makeup_bookings_insert ON public.makeup_bookings;
DROP POLICY IF EXISTS makeup_bookings_update ON public.makeup_bookings;
DROP POLICY IF EXISTS makeup_bookings_select ON public.makeup_bookings;
DROP POLICY IF EXISTS makeup_bookings_staff_manage ON public.makeup_bookings;
DROP POLICY IF EXISTS makeup_bookings_parent_select ON public.makeup_bookings;
CREATE POLICY makeup_bookings_staff_manage ON public.makeup_bookings FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'))
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
CREATE POLICY makeup_bookings_parent_select ON public.makeup_bookings FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

-- Waiting list: the old 008 rules let any parent read, change or delete every
-- family's entry. The 012 rules (staff manage, parents their own) stay.
DROP POLICY IF EXISTS waitlist_select ON public.waitlist;
DROP POLICY IF EXISTS waitlist_insert ON public.waitlist;
DROP POLICY IF EXISTS waitlist_update ON public.waitlist;
DROP POLICY IF EXISTS waitlist_delete ON public.waitlist;

-- Documents: parents see academy-wide documents and their own family's only.
DROP POLICY IF EXISTS "Org members view org documents" ON public.documents;
DROP POLICY IF EXISTS documents_member_select ON public.documents;
CREATE POLICY documents_member_select ON public.documents FOR SELECT TO authenticated
  USING (organisation_id = public.get_my_org() AND (
    public.get_my_role() IN ('admin', 'coach')
    OR parent_id = auth.uid()
    OR (parent_id IS NULL AND player_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.players p WHERE p.id = documents.player_id AND p.parent_id = auth.uid())
  ));

-- In-app notifications: a parent can only make one for themselves; staff for
-- anyone in their academy.
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_own_or_staff ON public.notifications;
CREATE POLICY notifications_insert_own_or_staff ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    (organisation_id IS NULL OR organisation_id = public.get_my_org())
    AND (user_id = auth.uid() OR public.get_my_role() IN ('admin', 'coach'))
  );

-- Messages: you can add people to a conversation only if it is brand new (you
-- are starting it) or you are already in it. Nobody can add themselves to
-- someone else's conversation.
CREATE OR REPLACE FUNCTION public.conversation_open_to_me(p_conv uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = p_conv)
      OR EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = p_conv AND user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.conversation_open_to_me(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_open_to_me(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users join conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS conversation_participants_add ON public.conversation_participants;
CREATE POLICY conversation_participants_add ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (SELECT id FROM public.conversations WHERE organisation_id = public.get_my_org())
    AND (public.get_my_role() IN ('admin', 'coach') OR public.conversation_open_to_me(conversation_id))
  );

-- Check: rules now on these tables.
SELECT tablename, string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname) AS rules
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('events','event_bookings','waivers','waiver_signatures','gallery_photos',
  'coach_hours','referrals','achievements','player_achievements','makeup_bookings','waitlist','documents','notifications','conversation_participants')
GROUP BY tablename ORDER BY tablename;
