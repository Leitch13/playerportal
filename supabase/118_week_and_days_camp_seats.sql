-- 118: a whole-camp camp can ALSO sell single days (Talent FA, 22 Sep 2026).
--
-- No new columns. Such a camp keeps booking_mode = 'whole_camp' and gains
-- flex_price_per_day plus its camp_days rows (created from the camp edit
-- form). The only database change: the day-booking function must count
-- FULL-WEEK bookings as taking a seat on every day, so a week seat and a
-- day seat can never oversell the same place. Everything else about the
-- function is identical to migration 096.
--
-- Safe to run at any time; the checkout route makes the same check before
-- calling this, so nothing is exposed while this waits to be applied.

CREATE OR REPLACE FUNCTION public.book_flexible_camp_days(
  p_camp_id             uuid,
  p_organisation_id     uuid,
  p_parent_name         text,
  p_parent_email        text,
  p_parent_phone        text,
  p_child_name          text,
  p_child_age           integer,
  p_child_dob           date,
  p_medical_info        text,
  p_consent_given       boolean,
  p_terms_accepted_at   timestamptz,
  p_terms_version_hash  text,
  p_amount_total        numeric,
  p_selected_day_ids    uuid[],
  p_per_day_amounts     numeric[],
  p_booking_source      text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking_id     uuid;
  v_actual_count   int;
  v_day_id         uuid;
  v_capacity       int;
  v_current_count  int;
  i                int;
BEGIN
  -- 1. Sanity: parallel arrays match; non-empty selection.
  IF p_selected_day_ids IS NULL OR cardinality(p_selected_day_ids) = 0 THEN
    RAISE EXCEPTION 'no_days_selected';
  END IF;
  IF cardinality(p_selected_day_ids) <> cardinality(p_per_day_amounts) THEN
    RAISE EXCEPTION 'array_length_mismatch';
  END IF;

  -- 2. Lock the selected camp_days rows FOR UPDATE. Any concurrent
  --    transaction attempting to lock these rows waits until we commit
  --    or roll back. Restricted to this camp so we can't accidentally
  --    lock rows in another org's camps via a mislabelled id.
  PERFORM 1
  FROM public.camp_days
  WHERE id = ANY(p_selected_day_ids)
    AND camp_id = p_camp_id
  FOR UPDATE;

  -- 3. Verify every requested id was found AND belongs to this camp.
  --    Guards against a client that hand-crafted a payload with day ids
  --    from a different camp.
  SELECT count(*) INTO v_actual_count
  FROM public.camp_days
  WHERE id = ANY(p_selected_day_ids)
    AND camp_id = p_camp_id;

  IF v_actual_count <> cardinality(p_selected_day_ids) THEN
    RAISE EXCEPTION 'invalid_day_ids';
  END IF;

  -- 4. Verify every selected day is is_available = true. (The route
  --    layer also checks this pre-lock, but the check is re-done inside
  --    the lock to close the race window where an admin flips
  --    is_available=false between the route's fetch and the RPC.)
  IF EXISTS (
    SELECT 1
    FROM public.camp_days
    WHERE id = ANY(p_selected_day_ids)
      AND is_available = false
  ) THEN
    RAISE EXCEPTION 'day_unavailable';
  END IF;

  -- 5. Per-day capacity check. NULL max_capacity ⇒ uncapped. Counts
  --    both 'pending' and 'paid' bookings so an in-flight checkout
  --    holds the seat until it completes or is rolled back.
  FOREACH v_day_id IN ARRAY p_selected_day_ids LOOP
    SELECT max_capacity INTO v_capacity
    FROM public.camp_days
    WHERE id = v_day_id;

    IF v_capacity IS NOT NULL THEN
      -- Day bookings on this day PLUS full-week bookings on the camp (a week
      -- booking takes a seat on every day). Migration 118.
      SELECT count(*) INTO v_current_count
      FROM public.camp_booking_days bd
      JOIN public.camp_bookings b ON b.id = bd.camp_booking_id
      WHERE bd.camp_day_id = v_day_id
        AND b.payment_status IN ('pending', 'paid');
      v_current_count := v_current_count + (
        SELECT count(*) FROM public.camp_bookings w
        WHERE w.camp_id = p_camp_id
          AND w.booking_mode = 'whole_camp'
          AND w.payment_status IN ('pending', 'paid')
      );

      IF v_current_count >= v_capacity THEN
        RAISE EXCEPTION 'day_full:%', v_day_id::text;
      END IF;
    END IF;
  END LOOP;

  -- 6. Insert the pending booking row. booking_mode is set explicitly
  --    to 'flexible_days' (the DB default is 'whole_camp' from Phase 0).
  INSERT INTO public.camp_bookings (
    camp_id, organisation_id,
    parent_name, parent_email, parent_phone,
    child_name, child_age, child_dob,
    medical_info, consent_given, amount_paid, payment_status,
    terms_accepted_at, terms_version_hash,
    booking_source, booking_mode
  ) VALUES (
    p_camp_id, p_organisation_id,
    p_parent_name, p_parent_email, p_parent_phone,
    p_child_name, p_child_age, p_child_dob,
    p_medical_info, p_consent_given, p_amount_total, 'pending',
    p_terms_accepted_at, p_terms_version_hash,
    p_booking_source, 'flexible_days'
  )
  RETURNING id INTO v_booking_id;

  -- 7. Insert one camp_booking_days row per selected day. Parallel
  --    arrays: p_selected_day_ids[i] pairs with p_per_day_amounts[i].
  --    amount_paid is the GROSS per-day price at booking time.
  FOR i IN 1..cardinality(p_selected_day_ids) LOOP
    INSERT INTO public.camp_booking_days (camp_booking_id, camp_day_id, amount_paid)
    VALUES (v_booking_id, p_selected_day_ids[i], p_per_day_amounts[i]);
  END LOOP;

  RETURN v_booking_id;
END;
$$;

-- Grant execute to service_role (the flexible-camp-checkout route runs
-- under a service-role client, mirroring the existing whole-camp route).
-- Not granted to anon — flexible checkout does not run under an anon
-- connection.
GRANT EXECUTE ON FUNCTION public.book_flexible_camp_days(
  uuid, uuid,
  text, text, text,
  text, integer, date,
  text, boolean, timestamptz, text,
  numeric, uuid[], numeric[], text
) TO service_role;
