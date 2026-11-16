-- 129: how many free trial sessions a parent can book per child per class (16 Nov 2026, John: "a").
-- One setting for every academy, starting on 1 (exactly as before). An academy can choose 2
-- in Settings → General (Jamie Allan, for his "2 free trials" Mini Ballers post).
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS free_trial_sessions smallint NOT NULL DEFAULT 1;
ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS organisations_free_trial_sessions_check;
ALTER TABLE public.organisations
  ADD CONSTRAINT organisations_free_trial_sessions_check CHECK (free_trial_sessions IN (1, 2));
