-- ════════════════════════════════════════════════════════════════════════
-- 096 — Flexible Camp Booking: atomic booking RPC (Phase 3A)
--
-- Introduces `book_flexible_camp_days(...)` — a single-transaction stored
-- procedure that atomically:
--   1. Locks the selected camp_days rows (FOR UPDATE)
--   2. Verifies every selected day belongs to the target camp
--   3. Verifies every selected day is is_available = true
--   4. Verifies every selected day still has capacity
--      (pending + paid camp_bookings vs camp_days.max_capacity)
--   5. Inserts one camp_bookings row (payment_status='pending',
--      booking_mode='flexible_days')
--   6. Inserts one camp_booking_days row per selected day, snapshotting
--      the GROSS per-day amount (any total-level discount is applied
--      only on the parent camp_bookings.amount_paid — future partial-
--      refund apportioning relies on the gross snapshot staying intact)
--   7. Returns the new camp_bookings.id
--
-- This is the safety-critical primitive for Phase 3A. The route layer
-- (`/api/stripe/flexible-camp-checkout`) does everything else: payload
-- validation, price computation, Stripe session creation, compensating
-- rollback if Stripe fails.
--
-- ─── Design notes ───
--   * FOR UPDATE serialises concurrent bookings against the same day
--     rows. Postgres blocks the second caller until the first commits
--     (or rolls back), preventing the classic "SELECT + INSERT" race
--     that could otherwise oversell a day.
--   * SECURITY INVOKER (default). The route calls this via the
--     service_role client so RLS is bypassed by the connection, not
--     by an elevated function. Keeps the attack surface small.
--   * Whole-camp bookings NEVER call this function. Existing
--     camp_bookings inserts (whole-camp checkout + admin add-player
--     + admin move + duplicate-camp) are completely unaffected.
--   * Additive — no columns changed, no policies changed, no data
--     migrated. Rollback: DROP FUNCTION public.book_flexible_camp_days(...).
-- ════════════════════════════════════════════════════════════════════════

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
      SELECT count(*) INTO v_current_count
      FROM public.camp_booking_days bd
      JOIN public.camp_bookings b ON b.id = bd.camp_booking_id
      WHERE bd.camp_day_id = v_day_id
        AND b.payment_status IN ('pending', 'paid');

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

-- ─── Sanity SELECT ───
-- Confirms the function exists post-migration.
SELECT
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'book_flexible_camp_days'
  ) AS book_flexible_camp_days_installed;
-- Expected: true
