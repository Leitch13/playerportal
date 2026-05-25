-- Add JSONB scores column to progress_reviews for custom scoring categories
-- The original 6 columns remain for backward compat but become nullable
ALTER TABLE public.progress_reviews
  ADD COLUMN IF NOT EXISTS scores jsonb,
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);

-- Make original score columns nullable so custom-only reviews can be saved
ALTER TABLE public.progress_reviews
  ALTER COLUMN attitude DROP NOT NULL,
  ALTER COLUMN effort DROP NOT NULL,
  ALTER COLUMN technical_quality DROP NOT NULL,
  ALTER COLUMN game_understanding DROP NOT NULL,
  ALTER COLUMN confidence DROP NOT NULL,
  ALTER COLUMN physical_movement DROP NOT NULL;
