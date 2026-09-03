-- ─────────────────────────────────────────────────────────────────────
-- 106 — One child, one record
-- ─────────────────────────────────────────────────────────────────────
--
-- Why
-- ---
-- On 1 Sep 2026 there were 24 sets of duplicate children across three
-- academies. One family was minutes away from being charged £192 twice in a
-- single morning for one boy, because he existed on two accounts whose emails
-- differed by a single full stop. Another child had his class on one record
-- and his payment on the other, so his mother could not complete payment at
-- all — there was no screen on which both existed.
--
-- 28 empty duplicates were archived that morning. This stops them coming back.
--
-- Root cause was two application paths, both since fixed:
--   • the class booking form defaulted its child dropdown to "add a new child",
--     so a parent booking a second class retyped a name they already had
--   • the parent's own "add a child" form had no existence check whatsoever
--
-- This index is the backstop for those two fixes, and for any path not yet
-- found. Application code should still fail *kindly* — a clean message beats a
-- database error — but the database is what makes it impossible rather than
-- merely unlikely.
--
-- Scope
-- -----
--   • Archived rows are excluded. Archiving is how an academy retires a
--     duplicate or a child who left; a retired record must never block a
--     genuine re-registration later.
--   • Rows with no date of birth are excluded. DOB is optional across the
--     platform, and two children can legitimately share a name within one
--     academy. Without a DOB there is no honest way to tell a duplicate from
--     two different kids, and a false block is worse than a duplicate.
--   • Names are compared case- and whitespace-insensitively, because
--     "Lucas ", "lucas" and "Lucas" are the same boy.
--
-- Safety
-- ------
-- CREATE UNIQUE INDEX fails loudly if duplicates still exist rather than
-- silently dropping data. Run the SELECT below FIRST; it must return zero rows.
-- Known outstanding at time of writing: one set (both copies live, needs a
-- human to decide which survives) — resolve that before applying this.
--
-- Reversible: DROP INDEX IF EXISTS players_one_record_per_child.

-- ── STEP 1 — must return ZERO rows before you continue ────────────────
-- SELECT organisation_id,
--        lower(btrim(first_name)) AS first,
--        lower(btrim(last_name))  AS last,
--        date_of_birth,
--        count(*)
--   FROM public.players
--  WHERE archived_at IS NULL
--    AND date_of_birth IS NOT NULL
--    AND (first_name IS NOT NULL OR last_name IS NOT NULL)
--  GROUP BY 1, 2, 3, 4
-- HAVING count(*) > 1;

-- ── STEP 2 — the constraint ───────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS players_one_record_per_child
  ON public.players (
    organisation_id,
    lower(btrim(first_name)),
    lower(btrim(last_name)),
    date_of_birth
  )
  WHERE archived_at IS NULL
    AND date_of_birth IS NOT NULL;

COMMENT ON INDEX public.players_one_record_per_child IS
  'One live record per child per academy (name + DOB, case-insensitive). Added 2026-09-01 after 28 duplicates were archived; two were about to double-bill a family. Excludes archived rows so a retired record never blocks a genuine re-registration, and rows without a DOB so two same-named children are never wrongly blocked.';

-- ── STEP 3 — proof it took ────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'players_one_record_per_child') AS index_created,
  (SELECT count(*) FROM public.players WHERE archived_at IS NOT NULL
     AND archive_reason = 'duplicate_record') AS duplicates_archived_to_date;
