-- ═══════════════════════════════════════════════════════════════════
-- Migration 079 — atomic capacity-checked enrolment RPC
-- ═══════════════════════════════════════════════════════════════════
-- Server-side enforcement to make overbooking impossible.
--
-- 078 fixed the public booking-page display, which restored the
-- pre-Stripe "Class Full" gate (parents now see Class Full and the
-- quick-book page short-circuits before checkout). That closes ~99%
-- of overbooking risk.
--
-- This migration closes the last race window: two parents on the same
-- class with one spot left, both pass the gate, both go through Stripe,
-- both webhook events fire concurrently — under the old insert path
-- both would succeed and the class would be at capacity+1.
--
-- Fix: a SECURITY DEFINER RPC that does an atomic
--   FOR UPDATE row-lock → existence check → capacity check → INSERT
-- inside one Postgres transaction. The training_groups row lock
-- serializes concurrent attempts for THE SAME group; different groups
-- proceed in parallel.
--
-- Scope (per the booking-safety brief):
--   • No Stripe / subscription / cancellation / billing logic changed.
--   • No trial-booking or camp-booking code touched.
--   • Messaging + Parent Hub untouched.
--   • Capacity rule unchanged: counts active + pending only. Cancelled,
--     trial_bookings, and waitlist all excluded.
--   • Existing enrolments unchanged.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enrol_if_capacity_available(
  p_player_id    uuid,
  p_group_id     uuid,
  p_org_id       uuid,
  p_status       text DEFAULT 'active',
  p_activates_on date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_capacity  int;
  v_current_count int;
  v_existing_id   uuid;
  v_new_id        uuid;
BEGIN
  -- Status whitelist (matches existing webhook callers).
  IF p_status NOT IN ('active', 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', p_status);
  END IF;

  -- Lock the training_groups row for the duration of this transaction.
  -- Two concurrent calls for the SAME group serialize at this point;
  -- calls for different groups proceed in parallel.
  SELECT max_capacity INTO v_max_capacity
  FROM public.training_groups
  WHERE id = p_group_id AND organisation_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'group_not_found');
  END IF;

  -- Default 20 matches the page's display fallback.
  v_max_capacity := COALESCE(v_max_capacity, 20);

  -- Idempotency: a retried webhook delivery for the same (player, group)
  -- pair is a no-op success. Same shape as the existing
  -- existingEnrolment check the webhook performed before this RPC.
  SELECT id INTO v_existing_id
  FROM public.enrolments
  WHERE player_id = p_player_id AND group_id = p_group_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'enrolment_id', v_existing_id, 'idempotent', true);
  END IF;

  -- Capacity check. Counts active + pending; cancelled excluded.
  SELECT count(*) INTO v_current_count
  FROM public.enrolments
  WHERE group_id = p_group_id
    AND status IN ('active', 'pending');

  IF v_current_count >= v_max_capacity THEN
    RETURN jsonb_build_object(
      'ok',       false,
      'error',    'class_full',
      'count',    v_current_count,
      'capacity', v_max_capacity
    );
  END IF;

  -- Insert (still inside the held lock — no other concurrent caller for
  -- this group can have inserted between count and INSERT).
  INSERT INTO public.enrolments (player_id, group_id, organisation_id, status, activates_on)
  VALUES (p_player_id, p_group_id, p_org_id, p_status, p_activates_on)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'enrolment_id', v_new_id);
END;
$$;

-- Anon never calls this (anon can't book — they have to subscribe
-- first, which requires authentication). Authenticated parents call
-- it via /api/enrolments/book. Service role calls it from the
-- Stripe webhook.
REVOKE ALL ON FUNCTION public.enrol_if_capacity_available(uuid, uuid, uuid, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enrol_if_capacity_available(uuid, uuid, uuid, text, date) TO authenticated, service_role;


-- ─── Sanity check ───
SELECT
  (SELECT 1 FROM pg_proc
     WHERE proname = 'enrol_if_capacity_available'
       AND pronamespace = 'public'::regnamespace) AS function_created,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='enrolments') AS enrolments_policy_count,
  (SELECT count(*) FROM pg_proc
     WHERE proname = 'get_group_seat_counts'
       AND pronamespace = 'public'::regnamespace) AS seat_count_rpc_still_present;

-- Expected: 1, 5, 1
