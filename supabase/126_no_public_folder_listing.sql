-- ═══════════════════════════════════════════════════════════════════
-- Migration 126: nobody can LIST the coaching or branding folders
-- ═══════════════════════════════════════════════════════════════════
-- 6 Nov 2026 security audit. Anyone on the internet could list every file in
-- 'coaching' (class/camp covers and academies' session plans) and 'branding'.
-- Links already on pages keep working (the folders stay public-by-link, like
-- player photos after 125). Whoever uploaded a file can still see it.
-- Safe to run more than once.

DROP POLICY IF EXISTS "Public read coaching files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read branding" ON storage.objects;

DROP POLICY IF EXISTS coaching_owner_select ON storage.objects;
CREATE POLICY coaching_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'coaching' AND owner = auth.uid());

DROP POLICY IF EXISTS branding_owner_select ON storage.objects;
CREATE POLICY branding_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'branding' AND owner = auth.uid());

-- Check: every storage rule that is left.
SELECT policyname, cmd, array_to_string(roles, '/') AS who
FROM pg_policies WHERE schemaname = 'storage' ORDER BY policyname;
