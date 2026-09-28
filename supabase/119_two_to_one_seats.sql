-- ═══════════════════════════════════════════════════════════════════
-- 119 · 2-to-1 pairs: two keepers can share one coach's time
--
-- Until now coaching_sessions allowed ONE live session per coach per time
-- (coaching_sessions_coach_time_uidx). A 2-to-1 is two keepers, each with
-- their own session row (their own parent, their own £ charge), at the same
-- coach and time, so a pair could never exist. Trying it (28 Sep 2026) made
-- the month roll collide and create nothing for the whole academy.
--
-- New rule, enforced by the database:
--   • every session sits in a SEAT: 1-to-1 = seat 0, 2-to-1 keepers = seat 1 or 2
--   • one live row per coach · date · time · seat   → at most one 1-to-1,
--                                                      at most two 2-to-1 keepers
--   • a 1-to-1 and a 2-to-1 can never share a coach · date · time
-- regular_slots carries the seat too, so the roll knows which seat each
-- keeper's dates go in.
--
-- Safe to run twice. Run in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── seats on regular slots ──
ALTER TABLE public.regular_slots ADD COLUMN IF NOT EXISTS pair_seat smallint NOT NULL DEFAULT 0;
UPDATE public.regular_slots SET pair_seat = 1 WHERE session_type = 'two_to_one' AND pair_seat = 0;
ALTER TABLE public.regular_slots DROP CONSTRAINT IF EXISTS regular_slots_pair_seat_chk;
ALTER TABLE public.regular_slots ADD CONSTRAINT regular_slots_pair_seat_chk CHECK (
  (session_type = 'one_to_one' AND pair_seat = 0) OR (session_type = 'two_to_one' AND pair_seat IN (1, 2))
);

-- ── seats on sessions ──
ALTER TABLE public.coaching_sessions ADD COLUMN IF NOT EXISTS pair_seat smallint NOT NULL DEFAULT 0;
UPDATE public.coaching_sessions SET pair_seat = 1 WHERE session_type = 'two_to_one' AND pair_seat = 0;
ALTER TABLE public.coaching_sessions DROP CONSTRAINT IF EXISTS coaching_sessions_pair_seat_chk;
ALTER TABLE public.coaching_sessions ADD CONSTRAINT coaching_sessions_pair_seat_chk CHECK (
  (session_type = 'one_to_one' AND pair_seat = 0) OR (session_type = 'two_to_one' AND pair_seat IN (1, 2))
);

-- One live row per coach · date · time · seat (replaces one-per-time).
DROP INDEX IF EXISTS public.coaching_sessions_coach_time_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS coaching_sessions_coach_time_seat_uidx
  ON public.coaching_sessions(coach_id, session_date, start_minutes, pair_seat)
  WHERE status IN ('held', 'scheduled', 'attended', 'no_show');

-- Never a 1-to-1 and a 2-to-1 on the same coach · date · time.
ALTER TABLE public.coaching_sessions DROP CONSTRAINT IF EXISTS coaching_sessions_no_mixed_types;
ALTER TABLE public.coaching_sessions ADD CONSTRAINT coaching_sessions_no_mixed_types
  EXCLUDE USING gist (coach_id WITH =, session_date WITH =, start_minutes WITH =, session_type WITH <>)
  WHERE (status IN ('held', 'scheduled', 'attended', 'no_show'));

-- ── the public hold: same behaviour as before (a one-off 2-to-1 booking takes
-- seat 1, so it still can't land on a time that already has a keeper) ──
CREATE OR REPLACE FUNCTION public.hold_session(
  p_org uuid, p_coach uuid, p_venue uuid, p_date date, p_start integer, p_duration integer,
  p_type text, p_price integer,
  p_guest_name text DEFAULT NULL, p_guest_email text DEFAULT NULL, p_guest_phone text DEFAULT NULL,
  p_guest_child_name text DEFAULT NULL, p_parent uuid DEFAULT NULL, p_player uuid DEFAULT NULL
)
RETURNS TABLE (session_id uuid, hold_token uuid, hold_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id  uuid;
  v_tok uuid := gen_random_uuid();
  v_exp timestamptz := now() + interval '12 minutes';
BEGIN
  DELETE FROM public.coaching_sessions
   WHERE coach_id = p_coach AND session_date = p_date AND start_minutes = p_start
     AND status = 'held' AND coaching_sessions.hold_expires_at < now();

  INSERT INTO public.coaching_sessions (
    organisation_id, coach_id, venue_id, session_date, start_minutes, duration_minutes,
    session_type, pair_seat, source, status, charge_state, price_pence, hold_token, hold_expires_at,
    guest_name, guest_email, guest_phone, guest_child_name, parent_id, player_id
  ) VALUES (
    p_org, p_coach, p_venue, p_date, p_start, p_duration,
    p_type, CASE WHEN p_type = 'two_to_one' THEN 1 ELSE 0 END, 'adhoc', 'held', 'unpaid', p_price, v_tok, v_exp,
    p_guest_name, p_guest_email, p_guest_phone, p_guest_child_name, p_parent, p_player
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_tok, v_exp;
EXCEPTION WHEN unique_violation OR exclusion_violation THEN
  RAISE EXCEPTION 'SESSION_TAKEN' USING ERRCODE = 'P0001';
END $$;
REVOKE ALL ON FUNCTION public.hold_session(uuid, uuid, uuid, date, integer, integer, text, integer, text, text, text, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hold_session(uuid, uuid, uuid, date, integer, integer, text, integer, text, text, text, text, uuid, uuid) TO service_role;
