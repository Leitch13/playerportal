-- 088_progress_reviews_visibility_cols.sql
-- Player Reports Visibility MVP — Slice B (viewed_at) + Slice C (emailed_at).
-- Additive, nullable. NO RLS change, NO scoring change, NO data dependency.
--
-- Slice B: viewed_at  — set when the owning parent opens the report (service-
--          role behind an ownership check). NULL = "not yet viewed".
-- Slice C: emailed_at — set on a successful report email send (on-create +
--          cron). The cron only emails reviews where emailed_at IS NULL.
--
-- The emailed_at BACKFILL below treats every PRE-EXISTING review as already
-- emailed, so flipping REPORT_EMAIL_IDEMPOTENCY_ENABLED can never cause the
-- cron to re-email historical reviews (those were emailed on-create under the
-- old fire-and-forget path). viewed_at is left NULL for existing rows.

ALTER TABLE public.progress_reviews
  ADD COLUMN IF NOT EXISTS viewed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS emailed_at timestamptz;

-- Safety backfill (Slice C): mark all existing reviews as already emailed.
UPDATE public.progress_reviews
   SET emailed_at = created_at
 WHERE emailed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Sanity SELECT — paste-back proof (per CLAUDE.md failure-mode rule).
-- Expected after apply:
--   has_viewed_at  = 1
--   has_emailed_at = 1
--   unemailed_rows = 0           (every existing row backfilled)
--   unviewed_rows  = total_rows  (viewed_at intentionally left NULL)
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='progress_reviews' AND column_name='viewed_at')  AS has_viewed_at,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='progress_reviews' AND column_name='emailed_at') AS has_emailed_at,
  (SELECT count(*) FROM public.progress_reviews WHERE emailed_at IS NULL) AS unemailed_rows,
  (SELECT count(*) FROM public.progress_reviews WHERE viewed_at  IS NULL) AS unviewed_rows,
  (SELECT count(*) FROM public.progress_reviews)                          AS total_rows;

-- ---------------------------------------------------------------------------
-- ROLLBACK (run only after both flags are OFF and the flag-off build is live):
--   ALTER TABLE public.progress_reviews
--     DROP COLUMN IF EXISTS viewed_at,
--     DROP COLUMN IF EXISTS emailed_at;
-- Additive + nullable + no data dependency when flags off ⇒ safe & reversible.
-- ---------------------------------------------------------------------------
