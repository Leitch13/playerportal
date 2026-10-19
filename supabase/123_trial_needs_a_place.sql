-- 123: a free trial booked from the public form can't go into a full day.
--
-- CFCoaching, 19 Oct 2026: CFC INTRO (6 places) had 6 paid members and a free trial
-- on top. Sign-ups already stop at the limit; trials never looked. The app now checks
-- in the form and on the server (src/lib/class-places.ts). This makes it definite: the
-- free-trial form saves straight from the parent's browser, so the database itself
-- refuses a trial for a day where members + trials already fill the class.
--
-- Only bookings made by the public / a parent are checked. Academy staff adding a trial
-- themselves, and the payment webhook saving a paid trial the parent has already paid
-- for, are let through (the academy is emailed "7 for 6 places" instead).
-- Counts members exactly as the sign-up limit does (get_group_seat_counts, migration 078).
-- A class with no limit set is 20, as everywhere else.

CREATE OR REPLACE FUNCTION public.trial_booking_needs_a_place()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_cap int;
  v_members bigint;
  v_trials bigint;
BEGIN
  IF NEW.training_group_id IS NULL OR NEW.preferred_date IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('pending', 'confirmed') THEN RETURN NEW; END IF;
  IF coalesce(auth.role(), '') = 'service_role' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach') AND p.organisation_id = NEW.organisation_id) THEN RETURN NEW; END IF;

  SELECT g.organisation_id, CASE WHEN coalesce(g.max_capacity, 0) > 0 THEN g.max_capacity ELSE 20 END
    INTO v_org, v_cap FROM training_groups g WHERE g.id = NEW.training_group_id;
  IF v_org IS NULL THEN RETURN NEW; END IF;

  SELECT coalesce(sum(s.seat_count), 0) INTO v_members FROM get_group_seat_counts(v_org) s WHERE s.group_id = NEW.training_group_id;
  -- A trial child who has since joined is already counted as a member.
  SELECT count(*) INTO v_trials FROM trial_bookings t
    WHERE t.training_group_id = NEW.training_group_id AND t.preferred_date = NEW.preferred_date AND t.status IN ('pending', 'confirmed')
      AND NOT EXISTS (
        SELECT 1 FROM enrolments e JOIN players pl ON pl.id = e.player_id
        WHERE e.group_id = t.training_group_id AND e.status IN ('active', 'pending')
          AND lower(regexp_replace(trim(coalesce(pl.first_name, '') || ' ' || coalesce(pl.last_name, '')), '\s+', ' ', 'g'))
            = lower(regexp_replace(trim(coalesce(t.child_name, '')), '\s+', ' ', 'g')));

  IF v_members + v_trials >= v_cap THEN
    RAISE EXCEPTION 'class_full: that day is full' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trial_booking_needs_a_place ON public.trial_bookings;
CREATE TRIGGER trial_booking_needs_a_place
  BEFORE INSERT ON public.trial_bookings
  FOR EACH ROW EXECUTE FUNCTION public.trial_booking_needs_a_place();

-- Check (returns one row, trigger_created = 1):
SELECT (SELECT count(*) FROM pg_trigger WHERE tgname = 'trial_booking_needs_a_place') AS trigger_created;
