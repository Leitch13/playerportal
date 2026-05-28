-- 066: Capture child date of birth on camp bookings (more accurate than age).
-- The form now collects DOB; the API also derives child_age from it so any
-- age-based logic keeps working.

ALTER TABLE public.camp_bookings
  ADD COLUMN IF NOT EXISTS child_dob date;

COMMENT ON COLUMN public.camp_bookings.child_dob IS
  'Child date of birth captured on the camp booking form. child_age is derived from this.';
