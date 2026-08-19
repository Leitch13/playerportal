-- Migration 105 — reactivate cancelled enrolments instead of false-idempotency
--
-- BUG (reported by Emma/G&G + silently corrupting moves): the UNIQUE
-- (player_id, group_id) constraint means a player who was EVER in a class
-- keeps a cancelled row forever. Two failure modes:
--   1. Raw INSERT paths (add-enrolment form) explode with 23505.
--   2. enrol_if_capacity_available's idempotency check matched ANY existing
--      row — including cancelled — and returned it as "success" WITHOUT
--      reactivating it. The move flow then cancelled the source enrolment,
--      leaving the player enrolled in NOTHING while still paying (the
--      "paying but not enrolled" states canary 3 keeps catching).
--
-- FIX: active/pending rows keep idempotent behaviour; a CANCELLED row is now
-- REACTIVATED (capacity-checked, inside the same group lock) and returned
-- with reactivated=true.
--
-- Rollback: re-run supabase/079_atomic_enrol_capacity_check.sql

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
  v_max_capacity    int;
  v_current_count   int;
  v_existing_id     uuid;
  v_existing_status text;
  v_new_id          uuid;
BEGIN
  IF p_status NOT IN ('active', 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', p_status);
  END IF;

  SELECT max_capacity INTO v_max_capacity
  FROM public.training_groups
  WHERE id = p_group_id AND organisation_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'group_not_found');
  END IF;

  v_max_capacity := COALESCE(v_max_capacity, 20);

  SELECT id, status INTO v_existing_id, v_existing_status
  FROM public.enrolments
  WHERE player_id = p_player_id AND group_id = p_group_id
  LIMIT 1;

  -- Live row → same idempotent no-op as before.
  IF v_existing_id IS NOT NULL AND v_existing_status IN ('active', 'pending') THEN
    RETURN jsonb_build_object('ok', true, 'enrolment_id', v_existing_id, 'idempotent', true);
  END IF;

  -- Capacity check (active + pending only; cancelled excluded).
  SELECT count(*) INTO v_current_count
  FROM public.enrolments
  WHERE group_id = p_group_id
    AND status IN ('active', 'pending');

  IF v_current_count >= v_max_capacity THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'class_full',
      'count', v_current_count, 'capacity', v_max_capacity
    );
  END IF;

  -- Cancelled row exists → REACTIVATE it (this was the silent-vanish bug).
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.enrolments
    SET status = p_status,
        activates_on = p_activates_on,
        enrolled_at = now(),
        is_trial = false,          -- clear stale trial state from the row''s past life;
        trial_expires_at = NULL    -- the move flow re-applies trial fields when appropriate
    WHERE id = v_existing_id;
    RETURN jsonb_build_object('ok', true, 'enrolment_id', v_existing_id, 'reactivated', true);
  END IF;

  -- No row at all → fresh insert (unchanged).
  INSERT INTO public.enrolments (player_id, group_id, organisation_id, status, activates_on)
  VALUES (p_player_id, p_group_id, p_org_id, p_status, p_activates_on)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'enrolment_id', v_new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.enrol_if_capacity_available(uuid, uuid, uuid, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enrol_if_capacity_available(uuid, uuid, uuid, text, date) TO authenticated, service_role;
