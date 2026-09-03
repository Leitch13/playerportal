-- ─────────────────────────────────────────────────────────────────────
-- 108 — Indexes on the hot paths
-- ─────────────────────────────────────────────────────────────────────
--
-- Confirmed missing against the live database on 2026-09-03 (pg_indexes,
-- matching each column as the FIRST column of an index — an index on
-- (organisation_id, status) does not serve a query filtering status alone,
-- and was not counted).
--
-- Postgres creates indexes for primary keys and unique constraints but NOT
-- for foreign keys, which is why subscriptions.player_id has never had one
-- despite being a foreign key.
--
-- WHY NOW
-- -------
-- The largest tenant holds ~180 subscriptions and ~180 enrolments, where a
-- sequential scan costs nothing. WLFA is onboarding ~400 recurring players,
-- roughly 4x that, and attendance grows per session rather than per player —
-- 400 players x 40 weeks is ~16,000 rows a year for one academy.
--
-- CONCURRENTLY, so no table is locked against writes while these build. That
-- has three consequences worth knowing:
--   • it CANNOT run inside a transaction block, so run these ONE AT A TIME
--     rather than pasting the file in as a single batch
--   • a failed build leaves an INVALID index behind; drop it and retry
--   • it is slower than a normal build, which is the trade for not locking
--
-- Each is reversible: DROP INDEX CONCURRENTLY IF EXISTS <name>;

-- ── 1. FIRST. The booking hot path. ──────────────────────────────────
-- Every subscribe attempt now checks "does this child already have a live
-- subscription" (the double-subscription guard, f8bcaf4), and every admin
-- payment request checks the same thing. Both filter player_id. This is the
-- one index that sits between a parent and a completed booking.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_player
  ON public.subscriptions (player_id);

-- ── 2. Price changes and plan reads ──────────────────────────────────
-- /api/plans/[planId]/price walks every live subscription on a plan to move
-- them to a new Stripe price. Also the plan-delete guard, which counts live
-- subscriptions before allowing a delete.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_plan
  ON public.subscriptions (plan_id);

-- ── 3. Enrolments by status, within an academy ───────────────────────
-- Composite rather than status alone: every caller already filters by
-- organisation_id, so (organisation_id, status) serves both that pair AND an
-- organisation_id-only query. It supersedes idx_enrolments_org, which can be
-- dropped afterwards if you want the write cost back.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrolments_org_status
  ON public.enrolments (organisation_id, status);

-- ── 4. Live players, within an academy ───────────────────────────────
-- Partial: every read wants the unarchived ones, so the index only holds
-- those. Smaller, and archived rows cost nothing to maintain.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_org_live
  ON public.players (organisation_id)
  WHERE archived_at IS NULL;

-- ── 5. Published classes, within an academy ──────────────────────────
-- Every public booking page load. Partial for the same reason — nothing reads
-- the unpublished ones in bulk.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_groups_org_published
  ON public.training_groups (organisation_id)
  WHERE is_published = true;

-- ── 6. Camp rosters ──────────────────────────────────────────────────
-- camp_days is indexed; camp_bookings never was, and it is the one the roster
-- page and every capacity check read.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_camp_bookings_camp
  ON public.camp_bookings (camp_id);

-- ── 7. The register ──────────────────────────────────────────────────
-- (group_id, session_date) rather than group_id alone: the register always
-- asks for one class on one date, and this is the table that grows fastest
-- with tenant size.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_group_date
  ON public.attendance (group_id, session_date);

-- ── PROOF ────────────────────────────────────────────────────────────
-- Run after all seven. Every row should name an index, and none should be
-- INVALID.
--
-- select i.indexname, i.tablename, ix.indisvalid
--   from pg_indexes i
--   join pg_class c on c.relname = i.indexname
--   join pg_index ix on ix.indexrelid = c.oid
--  where i.schemaname = 'public'
--    and i.indexname in (
--      'idx_subscriptions_player','idx_subscriptions_plan',
--      'idx_enrolments_org_status','idx_players_org_live',
--      'idx_training_groups_org_published','idx_camp_bookings_camp',
--      'idx_attendance_group_date')
--  order by 1;
