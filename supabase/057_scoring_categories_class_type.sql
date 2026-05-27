-- Per-class-type scoring categories.
-- Different class types need different scoring sheets — a 2-year-old in
-- Soccer Tots shouldn't be scored on "tactical awareness".
--
-- class_type semantics:
--   NULL  → universal category, applies to ALL class types (e.g. "Effort", "Attitude")
--   set   → only used when scoring players in classes of that type

ALTER TABLE public.scoring_categories
  ADD COLUMN IF NOT EXISTS class_type text;

-- Constraint must match the training_groups class_type list (kept in sync via migrations).
ALTER TABLE public.scoring_categories
  DROP CONSTRAINT IF EXISTS scoring_categories_class_type_check;
ALTER TABLE public.scoring_categories
  ADD CONSTRAINT scoring_categories_class_type_check
  CHECK (
    class_type IS NULL OR class_type IN (
      'group', 'small_group', '1-2-1', '2-1', 'gk', 'soccer_tots',
      'academy', 'accelerator', 'elite', 'camp', 'trial', 'girls',
      'adults', 'intensity'
    )
  );

CREATE INDEX IF NOT EXISTS idx_scoring_categories_class_type
  ON public.scoring_categories(organisation_id, class_type)
  WHERE is_active = true;
