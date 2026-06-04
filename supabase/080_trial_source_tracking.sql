-- ═══════════════════════════════════════════════════════════════════
-- Migration 080 — Trial source tracking (Revenue Sprint 5)
-- ═══════════════════════════════════════════════════════════════════
-- Adds three nullable text columns to trial_bookings so that the public
-- trial booking form can capture where the parent came from:
--
--   trial_source   — canonical channel ('facebook', 'instagram',
--                    'google', 'whatsapp', 'website', 'referral',
--                    'school_visit', 'flyer', 'other', 'unknown', ...).
--                    Application-layer validated (no DB CHECK) so
--                    marketing can add channels without a migration.
--   source_detail  — free text for "Other" detail OR auto-captured
--                    UTM campaign name (e.g. 'spring_2026_campaign').
--   referrer_url   — full HTTP Referer header for forensic analysis
--                    when UTM/dropdown are missing.
--
-- No constraints. No indexes. No backfill needed (existing 8 rows
-- become NULL, treated as 'unknown' by future analytics consumers).
-- No RLS change. No new tables.
--
-- Per Phase 0 approval: this migration only modifies the
-- "Trial booking insert path" protected system (#5). The columns are
-- additive — the Stripe webhook auto-link (#13) and reminder/followup
-- crons continue to work unchanged because they don't reference these
-- columns.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.trial_bookings
  ADD COLUMN IF NOT EXISTS trial_source  TEXT,
  ADD COLUMN IF NOT EXISTS source_detail TEXT,
  ADD COLUMN IF NOT EXISTS referrer_url  TEXT;


-- ─── Sanity check (returns one row) ───
SELECT
  -- All three columns must exist for the form to write them.
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'trial_bookings'
       AND column_name IN ('trial_source', 'source_detail', 'referrer_url')) AS columns_present,
  -- No backfill — existing rows show NULL, treated as 'unknown' downstream.
  (SELECT count(*) FROM public.trial_bookings) AS existing_rows,
  (SELECT count(*) FROM public.trial_bookings WHERE trial_source IS NULL) AS rows_with_null_source;

-- Expected row:
--   columns_present       = 3
--   existing_rows         = whatever count is there now (8 at time of writing)
--   rows_with_null_source = same as existing_rows (every row is NULL — correct)
