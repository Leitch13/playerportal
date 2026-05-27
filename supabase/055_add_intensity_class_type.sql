-- Add 'intensity' to the valid class_type values.
-- Intensity classes (e.g. JSL's £96/month sessions) sit between standard
-- group sessions and full 1-2-1s — high-intensity small-group training,
-- often technique/finishing/agility focused.

ALTER TABLE public.training_groups
  DROP CONSTRAINT IF EXISTS training_groups_class_type_check;

ALTER TABLE public.training_groups
  ADD CONSTRAINT training_groups_class_type_check
  CHECK (class_type IN (
    'group', 'small_group', '1-2-1', '2-1', 'gk', 'soccer_tots',
    'academy', 'accelerator', 'elite', 'camp', 'trial', 'girls',
    'adults', 'intensity'
  ));
