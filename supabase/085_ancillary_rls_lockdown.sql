-- ============================================================================
-- 085_ancillary_rls_lockdown.sql
-- Batch 2a / Findings #2 + #3 — close two cross-tenant SELECT leaks on
-- ancillary tables the 077a–d lockdown scoped out (it covered the 17 core
-- tables; skill_levels + announcement_reads were never in scope).
--
-- Protected System #10 (RLS). TIGHTEN-ONLY: both changes ADD an org predicate
-- to an existing SELECT policy. No table is opened up; no write policy is
-- touched. The org-scoped write policies ("Staff manage skill levels" FOR ALL,
-- "Users manage own reads") are LEFT INTACT.
--
-- ── Finding #2: skill_levels ────────────────────────────────────────────────
-- Live policy "Users read own skill levels" (from 038_progression.sql):
--     USING ( player_id IN (own children) OR get_my_role() IN ('admin','coach') )
-- The role branch has no org predicate → any staff member of ANY academy can
-- SELECT any player's skill rows. skill_levels HAS an organisation_id column,
-- so the fix is a direct org conjunction on the staff branch.
--
-- ── Finding #3: announcement_reads ──────────────────────────────────────────
-- Live policy "Admins read all reads" (from 014_announcements.sql):
--     USING ( get_my_role() IN ('admin','coach') )
-- announcement_reads has NO organisation_id column, so it is scoped via its
-- parent announcement (announcements HAS organisation_id).
--
-- ── ROLLBACK (re-apply prior policy text) ───────────────────────────────────
--   DROP POLICY IF EXISTS "Users read own skill levels" ON public.skill_levels;
--   CREATE POLICY "Users read own skill levels" ON public.skill_levels FOR SELECT
--     USING ( player_id IN (SELECT id FROM public.players WHERE parent_id = auth.uid())
--             OR public.get_my_role() IN ('admin','coach') );
--   DROP POLICY IF EXISTS "Admins read all reads" ON public.announcement_reads;
--   CREATE POLICY "Admins read all reads" ON public.announcement_reads FOR SELECT
--     USING ( public.get_my_role() IN ('admin','coach') );
-- ============================================================================

-- ── Finding #2: skill_levels ──
DROP POLICY IF EXISTS "Users read own skill levels" ON public.skill_levels;
CREATE POLICY "Users read own skill levels" ON public.skill_levels FOR SELECT
  USING (
    player_id IN (SELECT id FROM public.players WHERE parent_id = auth.uid())
    OR (public.get_my_org() = organisation_id AND public.get_my_role() IN ('admin', 'coach'))
  );

-- ── Finding #3: announcement_reads ──
DROP POLICY IF EXISTS "Admins read all reads" ON public.announcement_reads;
CREATE POLICY "Admins read all reads" ON public.announcement_reads FOR SELECT
  USING (
    public.get_my_role() IN ('admin', 'coach')
    AND announcement_id IN (
      SELECT id FROM public.announcements WHERE organisation_id = public.get_my_org()
    )
  );

-- ── PROOF ROW (paste back the result after applying) ─────────────────────────
-- Expect both policies' `qual` to now contain get_my_org()/organisation_id.
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE (tablename = 'skill_levels'       AND policyname = 'Users read own skill levels')
   OR (tablename = 'announcement_reads' AND policyname = 'Admins read all reads')
ORDER BY tablename, policyname;
