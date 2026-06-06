-- Sprint 8b v1 — Move Player audit + future-date linking
--
-- Adds the smallest schema delta that makes class moves auditable:
--
--   • cancellations.moved_to_group_id     — when a cancellation is
--     actually a move, point at the destination class
--   • cancellations.moved_to_enrolment_id — and at the new enrolment row
--   • enrolments.replaces_enrolment_id    — destination of a future-dated
--     move points back at the source it will replace; the
--     process-scheduled-moves cron uses this to atomically swap both rows
--     on the activation date
--
-- All three columns are nullable. Backward compatible: existing
-- cancellation rows (reason != 'moved') and existing enrolment rows have
-- NULL for the new columns and behave unchanged.
--
-- No new tables. No new RPCs. No RLS changes. The audit chain piggybacks
-- on the existing cancellations table (already secured per Sprint P3).

ALTER TABLE public.cancellations
  ADD COLUMN IF NOT EXISTS moved_to_group_id uuid
    REFERENCES public.training_groups(id) ON DELETE SET NULL;

ALTER TABLE public.cancellations
  ADD COLUMN IF NOT EXISTS moved_to_enrolment_id uuid
    REFERENCES public.enrolments(id) ON DELETE SET NULL;

ALTER TABLE public.enrolments
  ADD COLUMN IF NOT EXISTS replaces_enrolment_id uuid
    REFERENCES public.enrolments(id) ON DELETE SET NULL;

-- Index used by the daily process-scheduled-moves cron to find pending
-- destination enrolments that are due to activate.
CREATE INDEX IF NOT EXISTS enrolments_replaces_activates_idx
  ON public.enrolments (activates_on)
  WHERE replaces_enrolment_id IS NOT NULL AND status = 'pending';

-- ─── Sanity check ───
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='cancellations'
       AND column_name IN ('moved_to_group_id','moved_to_enrolment_id'))
    AS cancellations_columns_added,  -- expect 2
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='enrolments'
       AND column_name='replaces_enrolment_id')
    AS replaces_enrolment_id_added,  -- expect 1
  (SELECT count(*) FROM pg_indexes
     WHERE schemaname='public' AND indexname='enrolments_replaces_activates_idx')
    AS scheduled_move_index;          -- expect 1
