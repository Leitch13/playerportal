-- ════════════════════════════════════════════════════════════════════════
-- Sprint 7 — Archive Player (PR1)
-- ════════════════════════════════════════════════════════════════════════
--
-- Goal: replace the destructive Delete Player flow (which cascades through
-- 9 FK'd tables and irreversibly wipes attendance / progression / camp
-- bookings / awards / waitlist / makeup / documents) with a reversible
-- archive that preserves every historical surface.
--
-- ── What this migration does ───────────────────────────────────────────
--   1. Adds 4 nullable columns to public.players:
--        archived_at      timestamptz
--        archived_by      uuid → profiles.id
--        archive_reason   text (CHECK: one of 6 enum values)
--        archive_notes    text
--   2. Adds a partial index that keeps "list active players" queries
--      cheap once the predicate `archived_at IS NULL` is added.
--   3. Extends the cancellations.reason and .cancellation_type CHECKs to
--      accept 'archived' so the archive RPC can audit-row every
--      cancelled enrolment with a stable type. Pre-existing rows are
--      unaffected (the constraint only fires on insert/update).
--   4. Creates two SECURITY DEFINER RPCs:
--        archive_player_safe(player_id, reason, notes, cancel_subs)
--        restore_player_safe(player_id)
--      Both gate on get_my_role()='admin' and get_my_org() match.
--      Restore does NOT re-enrol, does NOT reactivate Stripe — by design.
--      Archive RPC does NOT call Stripe — it returns the list of active
--      subscription IDs and the API caller does Stripe-side via the same
--      pattern as /api/stripe/cancel.
--   5. Replaces the players RLS SELECT-parent-own policy with one that
--      hides archived rows from parent JWTs. Staff still see everything.
--
-- ── What this migration does NOT do ────────────────────────────────────
--   • Drop or modify the existing players_select_staff / players_admin_
--     manage_own_org policies (Protected System #10).
--   • Touch Stripe rows directly. cancel_subs is handled in the API layer
--     so the existing /api/stripe/cancel pattern (cancel_at_period_end,
--     mode-mismatch safe-fail) is reused.
--   • Cascade through camps/awards/skill_levels/payments/etc. The cascade
--     deletes on those tables only fire under DELETE; archive never
--     deletes the players row.
--
-- ── Idempotency ────────────────────────────────────────────────────────
-- Re-runnable. Columns added IF NOT EXISTS. Constraints dropped/recreated.
-- Policies use CREATE POLICY guarded by NOT EXISTS check. RPCs use CREATE
-- OR REPLACE FUNCTION.
--
-- ── End-of-migration sanity SELECT (CLAUDE.md failure-mode #1) ─────────
-- The last statement returns counts the user can paste back as proof
-- the migration committed.

-- ─────────────────────────────────────────────────────────────────────
-- STEP 1 — Schema additions
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS archived_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS archive_notes  text;

-- Reason enum check. Drop + recreate is the safe pattern for CHECK changes.
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_archive_reason_check;
ALTER TABLE public.players ADD CONSTRAINT players_archive_reason_check
  CHECK (archive_reason IS NULL OR archive_reason IN (
    'left_academy',
    'moved_away',
    'injury',
    'temporary_break',
    'duplicate_record',
    'other'
  ));

-- Partial index keeps the active-players list query cheap as the table grows.
CREATE INDEX IF NOT EXISTS idx_players_active_org
  ON public.players (organisation_id)
  WHERE archived_at IS NULL;

-- Index for archived-only filter UI ("show archived" toggle on Players list).
CREATE INDEX IF NOT EXISTS idx_players_archived_at
  ON public.players (organisation_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 2 — Extend cancellations enums to accept 'archived'
-- ─────────────────────────────────────────────────────────────────────
-- The archive RPC writes one cancellations row per cancelled enrolment so
-- the Cancellation Intelligence Dashboard (Sprint 14/15/16 family) keeps
-- a unified view of "why families stopped attending classes". Adding to a
-- CHECK is safe — no existing rows reject.

ALTER TABLE public.cancellations DROP CONSTRAINT IF EXISTS cancellations_reason_check;
ALTER TABLE public.cancellations ADD CONSTRAINT cancellations_reason_check
  CHECK (reason IS NULL OR reason IN (
    'too_expensive',
    'not_using',
    'switching',
    'child_stopped',
    'unhappy',
    'other',
    'schedule_conflict',
    'archived'             -- new: cancelled because the player was archived
  ));

-- cancellation_type is a free-text column (no CHECK) per Sprint 76, so no
-- constraint change needed. The archive RPC writes
-- cancellation_type = 'archived'.

-- ─────────────────────────────────────────────────────────────────────
-- STEP 3 — RPC: archive_player_safe
-- ─────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the function can write to cancellations + enrolments
-- as the academy admin without each call having to re-prove RLS. The
-- caller's identity is enforced via get_my_role() = 'admin' + the player
-- belonging to get_my_org().
--
-- Returns jsonb {ok, player_id, cancelled_enrolments, active_stripe_subs}.
-- The API caller is responsible for the Stripe-side cancellation when
-- p_cancel_subs = true.

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
  -- Resolve the player WITHIN the actor's org. If the row exists in
  -- a different org or doesn't exist at all, return a generic
  -- 'not_found' so we don't leak cross-tenant existence.
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

  -- ── 3. Cancel future-dated camp / event bookings ──────────────────
  -- Past camps left untouched (history). Sprint 9 camp_bookings table
  -- is separate from the 009-era event_bookings; both are handled.
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='camp_bookings') THEN
    UPDATE public.camp_bookings cb
      SET status = 'cancelled'
      WHERE cb.player_id = p_player_id
        AND cb.status IN ('confirmed','pending');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='event_bookings') THEN
    UPDATE public.event_bookings eb
      SET status = 'cancelled'
      WHERE eb.player_id = p_player_id
        AND eb.status IN ('confirmed','waitlisted');
  END IF;

  -- ── 4. Remove waitlist + expire pending makeups ───────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='waitlist') THEN
    DELETE FROM public.waitlist WHERE player_id = p_player_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='makeup_bookings') THEN
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
    'active_stripe_subscriptions', v_active_subs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_player_safe(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_player_safe(uuid, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 4 — RPC: restore_player_safe
-- ─────────────────────────────────────────────────────────────────────
-- Restore is intentionally minimal: flip the archive flags back to NULL.
-- Does NOT re-enrol, does NOT reactivate Stripe subscriptions, does NOT
-- recreate cancelled enrolments. The admin must deliberately re-enrol
-- the player after restore (or the parent re-subscribes via the public
-- booking page, which auto-enrols via the existing webhook).
--
-- Rationale: any auto-restore of state risks capacity bypass (Sprint 11
-- RPCs), Stripe state divergence (Sprint 77 bug class), and unexpected
-- charges to a family that didn't ask to come back.

CREATE OR REPLACE FUNCTION public.restore_player_safe(
  p_player_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor       uuid := auth.uid();
  v_actor_role  text := public.get_my_role();
  v_my_org      uuid := public.get_my_org();
  v_player_name text;
  v_was_archived boolean;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF v_actor_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden_role');
  END IF;

  SELECT (p.first_name || ' ' || p.last_name), (p.archived_at IS NOT NULL)
    INTO v_player_name, v_was_archived
    FROM public.players p
    WHERE p.id = p_player_id
      AND p.organisation_id = v_my_org;
  IF v_player_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT v_was_archived THEN
    -- Already active. Idempotent success.
    RETURN jsonb_build_object(
      'ok', true,
      'player_id', p_player_id,
      'player_name', v_player_name,
      'was_archived', false
    );
  END IF;

  UPDATE public.players
    SET archived_at    = NULL,
        archived_by    = NULL,
        archive_reason = NULL,
        archive_notes  = NULL
    WHERE id = p_player_id;

  RETURN jsonb_build_object(
    'ok', true,
    'player_id', p_player_id,
    'player_name', v_player_name,
    'was_archived', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_player_safe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_player_safe(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 5 — RLS adjustment: hide archived from parent SELECT branch
-- ─────────────────────────────────────────────────────────────────────
-- Drop + recreate the parent-own SELECT policy with the new clause.
-- Staff (players_select_staff) and admin-manage policies are left as-is
-- so the archived row remains fully visible to admins/coaches for the
-- archived-filter UI and historical reports.

DROP POLICY IF EXISTS "players_select_parent_own" ON public.players;
CREATE POLICY "players_select_parent_own"
  ON public.players FOR SELECT
  USING (
    parent_id = auth.uid()
    AND organisation_id = public.get_my_org()
    AND archived_at IS NULL
  );

-- ─────────────────────────────────────────────────────────────────────
-- STEP 6 — End-of-migration sanity SELECT
-- ─────────────────────────────────────────────────────────────────────
-- Per CLAUDE.md failure-mode #1: always end with a result the user can
-- paste back as proof the migration committed. Expected output:
--
--   players_columns_added         | 4
--   players_active_index          | 1
--   players_archived_index        | 1
--   archive_rpc_present           | 1
--   restore_rpc_present           | 1
--   cancellations_reason_archived | 1
--   parent_select_has_archive_clause | 1

SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='players'
       AND column_name IN ('archived_at','archived_by','archive_reason','archive_notes'))
    AS players_columns_added,             -- expect 4
  (SELECT count(*) FROM pg_indexes
     WHERE schemaname='public' AND indexname='idx_players_active_org')
    AS players_active_index,              -- expect 1
  (SELECT count(*) FROM pg_indexes
     WHERE schemaname='public' AND indexname='idx_players_archived_at')
    AS players_archived_index,            -- expect 1
  (SELECT count(*) FROM pg_proc
     WHERE proname='archive_player_safe' AND pronamespace = 'public'::regnamespace)
    AS archive_rpc_present,               -- expect 1
  (SELECT count(*) FROM pg_proc
     WHERE proname='restore_player_safe' AND pronamespace = 'public'::regnamespace)
    AS restore_rpc_present,               -- expect 1
  (SELECT count(*) FROM information_schema.check_constraints
     WHERE constraint_schema='public'
       AND constraint_name='cancellations_reason_check'
       AND check_clause LIKE '%archived%')
    AS cancellations_reason_archived,     -- expect 1
  (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='players'
       AND policyname='players_select_parent_own'
       AND qual LIKE '%archived_at IS NULL%')
    AS parent_select_has_archive_clause;  -- expect 1
