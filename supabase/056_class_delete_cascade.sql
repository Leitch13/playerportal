-- Fix foreign key constraints so deleting a class no longer fails with
-- "violates foreign key constraint" errors. Several tables reference
-- training_groups without ON DELETE clauses (defaulting to NO ACTION which
-- blocks deletes). This migration:
--   1. Drops each problematic FK
--   2. Re-adds it with ON DELETE SET NULL (preserves the row, unlinks it)
--      OR ON DELETE CASCADE where the row makes no sense without the class.

-- 1. subscription_plans.training_group_id — class-specific plan unlinks
ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_training_group_id_fkey;
ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_training_group_id_fkey
  FOREIGN KEY (training_group_id) REFERENCES public.training_groups(id) ON DELETE SET NULL;

-- 2. gallery_photos.group_id — photo stays but loses class link
ALTER TABLE public.gallery_photos
  DROP CONSTRAINT IF EXISTS gallery_photos_group_id_fkey;
ALTER TABLE public.gallery_photos
  ADD CONSTRAINT gallery_photos_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.training_groups(id) ON DELETE SET NULL;

-- 3. coach_hours.group_id — preserve coach hours for payroll history
ALTER TABLE public.coach_hours
  DROP CONSTRAINT IF EXISTS coach_hours_group_id_fkey;
ALTER TABLE public.coach_hours
  ADD CONSTRAINT coach_hours_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.training_groups(id) ON DELETE SET NULL;

-- 4. makeup_bookings — missed_group_id is NOT NULL, so cascade delete the row.
--    The makeup booking history loses meaning if the missed class is gone.
ALTER TABLE public.makeup_bookings
  DROP CONSTRAINT IF EXISTS makeup_bookings_missed_group_id_fkey;
ALTER TABLE public.makeup_bookings
  ADD CONSTRAINT makeup_bookings_missed_group_id_fkey
  FOREIGN KEY (missed_group_id) REFERENCES public.training_groups(id) ON DELETE CASCADE;

ALTER TABLE public.makeup_bookings
  DROP CONSTRAINT IF EXISTS makeup_bookings_makeup_group_id_fkey;
ALTER TABLE public.makeup_bookings
  ADD CONSTRAINT makeup_bookings_makeup_group_id_fkey
  FOREIGN KEY (makeup_group_id) REFERENCES public.training_groups(id) ON DELETE SET NULL;

-- 5. camps.training_group_id — camp persists but loses class link
ALTER TABLE public.camps
  DROP CONSTRAINT IF EXISTS camps_training_group_id_fkey;
ALTER TABLE public.camps
  ADD CONSTRAINT camps_training_group_id_fkey
  FOREIGN KEY (training_group_id) REFERENCES public.training_groups(id) ON DELETE SET NULL;

-- 6. trial_bookings.training_group_id — keep the trial record for analytics
ALTER TABLE public.trial_bookings
  DROP CONSTRAINT IF EXISTS trial_bookings_training_group_id_fkey;
ALTER TABLE public.trial_bookings
  ADD CONSTRAINT trial_bookings_training_group_id_fkey
  FOREIGN KEY (training_group_id) REFERENCES public.training_groups(id) ON DELETE SET NULL;

-- 7. session_plans.group_id — keep the plan template, unlink it
ALTER TABLE public.session_plans
  DROP CONSTRAINT IF EXISTS session_plans_group_id_fkey;
ALTER TABLE public.session_plans
  ADD CONSTRAINT session_plans_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.training_groups(id) ON DELETE SET NULL;
