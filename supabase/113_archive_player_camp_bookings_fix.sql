-- ─────────────────────────────────────────────────────────────────────
-- 113 — archive_player_safe: the camp_bookings block has never worked
-- ─────────────────────────────────────────────────────────────────────
--
-- Reported 2026-09-08 by an academy owner: "Archive player still doesn't
-- work." It has not worked for any real player since it shipped.
--
-- Step 3 of the RPC (migration 084) does:
--
--     UPDATE public.camp_bookings cb
--       SET status = 'cancelled'
--       WHERE cb.player_id = p_player_id
--         AND cb.status IN ('confirmed','pending');
--
-- camp_bookings has no `status` column — it is `payment_status`, with
-- values pending / paid / refunded / cancelled. Until 2026-09-04 it had no
-- `player_id` either (migration 112 added it). The block is guarded only
-- by "does the table exist", so it always runs, and PL/pgSQL raises
-- `column cb.status does not exist` the moment it is reached. Every
-- archive attempt aborted there, after flagging nothing — the function is
-- atomic, so no player was ever half-archived.
--
-- The 66 archived players in the table were written directly by a
-- de-duplication script in July, not by this function.
--
-- Fix: same function, step 3 corrected and guarded on the COLUMNS it
-- needs, not just the table. Only UNPAID camp bookings are cancelled — a
-- paid camp place is money already taken and is a refund decision, not a
-- side-effect of tidying the players list. Everything else in the function
-- is byte-identical to 084.
--
-- Reversible: re-run STEP 3 of supabase/084_archive_player.sql.

CREATE OR REPLACE FUNCTION public.archive_player_safe(
  p_player_id    uuid,
  p_reason       text,
  p_notes        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org             uuid;
  v_parent_id       uuid;
  v_actor           uuid := auth.uid();
  v_actor_role      text := public.get_my_role();
  v_my_org          uuid := public.get_my_org();
  v_player_name     text;
  v_cancelled_count int := 0;
  v_camp_cancelled  int := 0;
  v_active_subs     jsonb;
  v_was_already     boolean;
BEGIN
  -- ── Auth gate ──────────────────────────────────────────────────────
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF v_actor_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden_role');
  END IF;

  -- ── Cross-tenant guard ────────────────────────────────────────────
  SELECT p.organisation_id, p.parent_id,
         (p.first_name || ' ' || p.last_name),
         (p.archived_at IS NOT NULL)
    INTO v_org, v_parent_id, v_player_name, v_was_already
    FROM public.players p
    WHERE p.id = p_player_id
      AND p.organisation_id = v_my_org;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- ── Idempotent: already archived returns success with details ─────
  IF v_was_already THEN
    SELECT coalesce(jsonb_agg(s.stripe_subscription_id), '[]'::jsonb) INTO v_active_subs
      FROM public.subscriptions s
      WHERE s.player_id = p_player_id
        AND s.status = 'active'
        AND s.stripe_subscription_id IS NOT NULL;
    RETURN jsonb_build_object(
      'ok', true,
      'player_id', p_player_id,
      'player_name', v_player_name,
      'already_archived', true,
      'cancelled_enrolments', 0,
      'cancelled_camp_bookings', 0,
      'active_stripe_subscriptions', v_active_subs
    );
  END IF;

  -- ── 1. Flag the player row ────────────────────────────────────────
  UPDATE public.players
    SET archived_at    = now(),
        archived_by    = v_actor,
        archive_reason = p_reason,
        archive_notes  = p_notes
    WHERE id = p_player_id;

  -- ── 2. Cancel active + pending class enrolments + audit each one ──
  WITH cancelled AS (
    UPDATE public.enrolments
      SET status = 'cancelled'
      WHERE player_id = p_player_id
        AND status IN ('active', 'pending')
      RETURNING id
  ),
  audited AS (
    INSERT INTO public.cancellations (
      profile_id, organisation_id, enrolment_id, cancellation_type,
      reason, reason_detail, final_status, cancelled_at, created_at
    )
    SELECT
      v_parent_id, v_org, c.id, 'archived',
      'archived',
      coalesce(p_notes, p_reason),
      'cancelled', now(), now()
    FROM cancelled c
    RETURNING 1
  )
  SELECT count(*) INTO v_cancelled_count FROM audited;

  -- ── 3. Release UNPAID camp bookings; leave paid ones alone ─────────
  -- Guarded on the columns actually used (player_id arrived in 112;
  -- payment_status is the real status column). A paid camp place is not
  -- cancelled by archiving — that is a refund decision made on purpose.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='camp_bookings' AND column_name='player_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='camp_bookings' AND column_name='payment_status') THEN
    WITH released AS (
      UPDATE public.camp_bookings cb
        SET payment_status = 'cancelled'
        WHERE cb.player_id = p_player_id
          AND cb.payment_status = 'pending'
        RETURNING 1
    )
    SELECT count(*) INTO v_camp_cancelled FROM released;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='event_bookings' AND column_name='player_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='event_bookings' AND column_name='status') THEN
    UPDATE public.event_bookings eb
      SET status = 'cancelled'
      WHERE eb.player_id = p_player_id
        AND eb.status IN ('confirmed','waitlisted');
  END IF;

  -- ── 4. Remove waitlist + expire pending makeups ───────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='waitlist' AND column_name='player_id') THEN
    DELETE FROM public.waitlist WHERE player_id = p_player_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='makeup_bookings' AND column_name='player_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='makeup_bookings' AND column_name='status') THEN
    UPDATE public.makeup_bookings
      SET status = 'expired'
      WHERE player_id = p_player_id
        AND status IN ('pending','booked');
  END IF;

  -- ── 5. Return active Stripe subscription IDs for API-side cancel ──
  SELECT coalesce(jsonb_agg(s.stripe_subscription_id), '[]'::jsonb) INTO v_active_subs
    FROM public.subscriptions s
    WHERE s.player_id = p_player_id
      AND s.status = 'active'
      AND s.stripe_subscription_id IS NOT NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'player_id', p_player_id,
    'player_name', v_player_name,
    'already_archived', false,
    'cancelled_enrolments', v_cancelled_count,
    'cancelled_camp_bookings', v_camp_cancelled,
    'active_stripe_subscriptions', v_active_subs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_player_safe(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_player_safe(uuid, text, text) TO authenticated;

-- ── PROOF ─────────────────────────────────────────────────────────────
-- Expect: body_fixed = 1 (the new function text references payment_status
-- and no longer references "cb.status").
SELECT
  (SELECT count(*) FROM pg_proc
     WHERE proname='archive_player_safe' AND pronamespace='public'::regnamespace
       AND prosrc LIKE '%cb.payment_status%'
       AND prosrc NOT LIKE '%cb.status%')
    AS body_fixed;
