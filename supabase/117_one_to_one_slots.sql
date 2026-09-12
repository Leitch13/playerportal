-- ═══════════════════════════════════════════════════════════════════
-- Migration 117 — 1-2-1 Slots module (phase 1: schema + engine)
-- ═══════════════════════════════════════════════════════════════════
-- A SEPARATE module for recurring 1-to-1 / 2-to-1 coaching.
--
--   • Additive only. No existing table is altered.
--   • Money in this module is ONE-OFF Connect charges (see coaching_charges).
--     There are no Stripe subscriptions here and there never will be.
--   • Same for every academy: nothing in here is gated per organisation.
--     The module is empty until an academy adds a coach with hours.
--   • Times are local wall-clock (minutes since midnight) + a date, with
--     Europe/London applied in code, so the October clock change cannot
--     move a 16:30 slot.
--
-- RLS floor:
--   admin           manage everything in own org
--   coach           read own org; INSERT own flag/extra exceptions only
--   parent          read own slots / sessions / charges / credits
--   anon            nothing (the public booking page uses server routes)
-- ═══════════════════════════════════════════════════════════════════

-- ─── updated_at touch (self-contained, not shared with other modules) ───
CREATE OR REPLACE FUNCTION public.one_to_one_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- ─── SETTINGS (product config only — never how money moves) ───
CREATE TABLE IF NOT EXISTS public.coaching_settings (
  organisation_id        uuid PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  one_to_one_price_pence integer NOT NULL DEFAULT 3500 CHECK (one_to_one_price_pence >= 0),
  two_to_one_price_pence integer NOT NULL DEFAULT 2500 CHECK (two_to_one_price_pence >= 0),
  session_minutes        integer NOT NULL DEFAULT 30 CHECK (session_minutes BETWEEN 15 AND 120),
  cash_allowed           boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER coaching_settings_touch BEFORE UPDATE ON public.coaching_settings
  FOR EACH ROW EXECUTE FUNCTION public.one_to_one_touch_updated_at();

-- ─── VENUES ───
-- weekly_hours: {"mon":[["16:00","19:30"]],"sat":[["09:00","13:00"]]}
CREATE TABLE IF NOT EXISTS public.coaching_venues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  address         text,
  weekly_hours    jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coaching_venues_org_idx ON public.coaching_venues(organisation_id);
CREATE TRIGGER coaching_venues_touch BEFORE UPDATE ON public.coaching_venues
  FOR EACH ROW EXECUTE FUNCTION public.one_to_one_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.coaching_venue_closures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  venue_id        uuid NOT NULL REFERENCES public.coaching_venues(id) ON DELETE CASCADE,
  closed_on       date NOT NULL,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, closed_on)
);
CREATE INDEX IF NOT EXISTS coaching_venue_closures_org_idx ON public.coaching_venue_closures(organisation_id, closed_on);

-- ─── COACH HOURS (set by the academy; roll forward by definition) ───
-- weekday is ISO: 1 = Monday … 7 = Sunday. Minutes since local midnight.
CREATE TABLE IF NOT EXISTS public.coach_hours (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  coach_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_id        uuid NOT NULL REFERENCES public.coaching_venues(id) ON DELETE CASCADE,
  weekday         smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_minutes   integer NOT NULL CHECK (start_minutes BETWEEN 0 AND 1439),
  end_minutes     integer NOT NULL CHECK (end_minutes BETWEEN 1 AND 1440),
  effective_from  date NOT NULL DEFAULT CURRENT_DATE,
  effective_to    date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (end_minutes > start_minutes),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS coach_hours_org_coach_idx ON public.coach_hours(organisation_id, coach_id, weekday);

-- ─── COACH EXCEPTIONS ───
-- flag  = coach can't make this date/range   → Needs attention (cover problem)
-- extra = coach adds hours on this date       → goes on sale
-- block = academy blocks time (buffer, admin) → never on sale
CREATE TABLE IF NOT EXISTS public.coach_hour_exceptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  coach_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_id        uuid REFERENCES public.coaching_venues(id) ON DELETE SET NULL,
  exception_date  date NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('flag', 'extra', 'block')),
  start_minutes   integer CHECK (start_minutes IS NULL OR start_minutes BETWEEN 0 AND 1439),
  end_minutes     integer CHECK (end_minutes IS NULL OR end_minutes BETWEEN 1 AND 1440),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  note            text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((start_minutes IS NULL) = (end_minutes IS NULL)),
  CHECK (end_minutes IS NULL OR end_minutes > start_minutes),
  CHECK (kind <> 'extra' OR (venue_id IS NOT NULL AND start_minutes IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS coach_hour_exceptions_org_date_idx ON public.coach_hour_exceptions(organisation_id, exception_date);
CREATE INDEX IF NOT EXISTS coach_hour_exceptions_open_idx ON public.coach_hour_exceptions(organisation_id) WHERE status = 'open';

-- ─── REGULAR SLOTS (the protected thing) ───
CREATE TABLE IF NOT EXISTS public.regular_slots (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id          uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  player_id                uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  parent_id                uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id                 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  venue_id                 uuid NOT NULL REFERENCES public.coaching_venues(id) ON DELETE RESTRICT,
  weekday                  smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_minutes            integer NOT NULL CHECK (start_minutes BETWEEN 0 AND 1439),
  duration_minutes         integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 120),
  session_type             text NOT NULL CHECK (session_type IN ('one_to_one', 'two_to_one')),
  frequency                text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'fortnightly', 'monthly')),
  price_pence              integer NOT NULL CHECK (price_pence >= 0),
  status                   text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'released')),
  partner_slot_id          uuid REFERENCES public.regular_slots(id) ON DELETE SET NULL,
  starts_on                date NOT NULL,
  ends_on                  date,
  stripe_customer_id       text,
  stripe_payment_method_id text,
  note                     text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS regular_slots_org_status_idx ON public.regular_slots(organisation_id, status);
CREATE INDEX IF NOT EXISTS regular_slots_parent_idx ON public.regular_slots(parent_id);
CREATE INDEX IF NOT EXISTS regular_slots_coach_idx ON public.regular_slots(coach_id, weekday, start_minutes);
CREATE TRIGGER regular_slots_touch BEFORE UPDATE ON public.regular_slots
  FOR EACH ROW EXECUTE FUNCTION public.one_to_one_touch_updated_at();

-- ─── SESSIONS (one row per dated session) ───
CREATE TABLE IF NOT EXISTS public.coaching_sessions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id           uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  regular_slot_id           uuid REFERENCES public.regular_slots(id) ON DELETE SET NULL,
  coach_id                  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  venue_id                  uuid NOT NULL REFERENCES public.coaching_venues(id) ON DELETE RESTRICT,
  player_id                 uuid REFERENCES public.players(id) ON DELETE SET NULL,
  parent_id                 uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_date              date NOT NULL,
  start_minutes             integer NOT NULL CHECK (start_minutes BETWEEN 0 AND 1439),
  duration_minutes          integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 120),
  session_type              text NOT NULL CHECK (session_type IN ('one_to_one', 'two_to_one')),
  source                    text NOT NULL CHECK (source IN ('regular', 'adhoc', 'admin')),
  status                    text NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('held', 'scheduled', 'declined', 'cancelled', 'attended', 'no_show')),
  charge_state              text NOT NULL DEFAULT 'unpaid'
                            CHECK (charge_state IN ('unpaid', 'paid_online', 'paid_cash', 'credited', 'charged', 'waived')),
  price_pence               integer NOT NULL CHECK (price_pence >= 0),
  charge_id                 uuid,
  stripe_payment_intent_id  text,
  stripe_checkout_session_id text,
  hold_token                uuid,
  hold_expires_at           timestamptz,
  guest_name                text,
  guest_email               text,
  guest_phone               text,
  guest_child_name          text,
  decline_tier              text CHECK (decline_tier IS NULL OR decline_tier IN ('full', 'half', 'none')),
  declined_at               timestamptz,
  cover_of_session_id       uuid REFERENCES public.coaching_sessions(id) ON DELETE SET NULL,
  note                      text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'held' OR hold_expires_at IS NOT NULL)
);
-- A coach can only be in one place at a time. Declined / cancelled rows free the time.
CREATE UNIQUE INDEX IF NOT EXISTS coaching_sessions_coach_time_uidx
  ON public.coaching_sessions(coach_id, session_date, start_minutes)
  WHERE status IN ('held', 'scheduled', 'attended', 'no_show');
-- The month roll is idempotent: one live row per slot per date.
CREATE UNIQUE INDEX IF NOT EXISTS coaching_sessions_slot_date_uidx
  ON public.coaching_sessions(regular_slot_id, session_date)
  WHERE regular_slot_id IS NOT NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS coaching_sessions_org_date_idx ON public.coaching_sessions(organisation_id, session_date);
CREATE INDEX IF NOT EXISTS coaching_sessions_parent_idx ON public.coaching_sessions(parent_id, session_date);
CREATE INDEX IF NOT EXISTS coaching_sessions_holds_idx ON public.coaching_sessions(hold_expires_at) WHERE status = 'held';
CREATE TRIGGER coaching_sessions_touch BEFORE UPDATE ON public.coaching_sessions
  FOR EACH ROW EXECUTE FUNCTION public.one_to_one_touch_updated_at();

-- ─── CHARGES (one row per parent per month — ONE-OFF, never a subscription) ───
CREATE TABLE IF NOT EXISTS public.coaching_charges (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id           uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  parent_id                 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  billing_month             date NOT NULL,                       -- always the 1st
  sessions_pence            integer NOT NULL CHECK (sessions_pence >= 0),
  credit_applied_pence      integer NOT NULL DEFAULT 0 CHECK (credit_applied_pence >= 0),
  amount_pence              integer NOT NULL CHECK (amount_pence >= 0),
  status                    text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'paid_online', 'paid_cash', 'failed', 'refunded', 'waived')),
  stripe_payment_intent_id  text,
  stripe_checkout_session_id text,
  attempt_count             integer NOT NULL DEFAULT 0,
  last_attempt_at           timestamptz,
  next_attempt_on           date,
  failure_message           text,
  breakdown                 jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{session_id, date, price_pence}]
  cash_received_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cash_received_at          timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, billing_month),
  CHECK (EXTRACT(DAY FROM billing_month) = 1)
);
CREATE INDEX IF NOT EXISTS coaching_charges_org_month_idx ON public.coaching_charges(organisation_id, billing_month, status);
CREATE TRIGGER coaching_charges_touch BEFORE UPDATE ON public.coaching_charges
  FOR EACH ROW EXECUTE FUNCTION public.one_to_one_touch_updated_at();
ALTER TABLE public.coaching_sessions
  ADD CONSTRAINT coaching_sessions_charge_fk FOREIGN KEY (charge_id) REFERENCES public.coaching_charges(id) ON DELETE SET NULL;

-- ─── CREDITS (signed ledger; balance = sum) ───
CREATE TABLE IF NOT EXISTS public.coaching_credits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  parent_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_pence    integer NOT NULL CHECK (amount_pence <> 0),   -- + credit, − applied
  reason          text NOT NULL CHECK (reason IN ('parent_decline', 'academy_cancel', 'admin_adjust', 'applied_to_charge', 'refund_offset')),
  session_id      uuid REFERENCES public.coaching_sessions(id) ON DELETE SET NULL,
  charge_id       uuid REFERENCES public.coaching_charges(id) ON DELETE SET NULL,
  note            text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coaching_credits_parent_idx ON public.coaching_credits(parent_id);
CREATE INDEX IF NOT EXISTS coaching_credits_org_idx ON public.coaching_credits(organisation_id);

-- ─── SESSION REQUESTS (public "nothing fits" → lead + demand record) ───
CREATE TABLE IF NOT EXISTS public.session_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  contact_name    text NOT NULL,
  contact_email   text NOT NULL,
  contact_phone   text,
  child_name      text,
  child_age_group text,
  venue_ids       uuid[] NOT NULL DEFAULT '{}',
  weekdays        smallint[] NOT NULL DEFAULT '{}',
  after_minutes   integer CHECK (after_minutes IS NULL OR after_minutes BETWEEN 0 AND 1439),
  notes           text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'offered', 'closed')),
  resolved_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_requests_org_status_idx ON public.session_requests(organisation_id, status);

-- ═══════════════════════════════════════════════════════════════════
-- HOLD (12 minutes, atomic). The partial unique index above makes a
-- double hold impossible; the second caller gets SESSION_TAKEN.
-- Availability (hours / closures / flags) is checked in code before
-- this is called. This function only guarantees "one coach, one time".
-- ═══════════════════════════════════════════════════════════════════
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
  -- A stale hold on this exact time must not block a live booking.
  DELETE FROM public.coaching_sessions
   WHERE coach_id = p_coach AND session_date = p_date AND start_minutes = p_start
     AND status = 'held' AND coaching_sessions.hold_expires_at < now();

  INSERT INTO public.coaching_sessions (
    organisation_id, coach_id, venue_id, session_date, start_minutes, duration_minutes,
    session_type, source, status, charge_state, price_pence, hold_token, hold_expires_at,
    guest_name, guest_email, guest_phone, guest_child_name, parent_id, player_id
  ) VALUES (
    p_org, p_coach, p_venue, p_date, p_start, p_duration,
    p_type, 'adhoc', 'held', 'unpaid', p_price, v_tok, v_exp,
    p_guest_name, p_guest_email, p_guest_phone, p_guest_child_name, p_parent, p_player
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_tok, v_exp;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'SESSION_TAKEN' USING ERRCODE = 'P0001';
END $$;
REVOKE ALL ON FUNCTION public.hold_session(uuid, uuid, uuid, date, integer, integer, text, integer, text, text, text, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hold_session(uuid, uuid, uuid, date, integer, integer, text, integer, text, text, text, text, uuid, uuid) TO service_role;

-- Hourly cron: anything still held after 12 minutes is gone.
CREATE OR REPLACE FUNCTION public.release_expired_session_holds()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.coaching_sessions WHERE status = 'held' AND hold_expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.release_expired_session_holds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_expired_session_holds() TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.coaching_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_venues         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_venue_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_hours             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_hour_exceptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regular_slots           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_charges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_credits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_requests        ENABLE ROW LEVEL SECURITY;

-- Admin manages everything in own org.
CREATE POLICY coaching_settings_admin_manage ON public.coaching_settings FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
CREATE POLICY coaching_venues_admin_manage ON public.coaching_venues FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
CREATE POLICY coaching_venue_closures_admin_manage ON public.coaching_venue_closures FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
CREATE POLICY coach_hours_admin_manage ON public.coach_hours FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
CREATE POLICY coach_hour_exceptions_admin_manage ON public.coach_hour_exceptions FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
CREATE POLICY regular_slots_admin_manage ON public.regular_slots FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
CREATE POLICY coaching_sessions_admin_manage ON public.coaching_sessions FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
CREATE POLICY coaching_charges_admin_manage ON public.coaching_charges FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
CREATE POLICY coaching_credits_admin_manage ON public.coaching_credits FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
CREATE POLICY session_requests_admin_manage ON public.session_requests FOR ALL TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');

-- Coach reads own org; may only ADD a flag or extra hours for themself.
-- (Marking attended / no-show goes through a server route in phase 5.)
CREATE POLICY coaching_settings_coach_read ON public.coaching_settings FOR SELECT TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'coach');
CREATE POLICY coaching_venues_coach_read ON public.coaching_venues FOR SELECT TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'coach');
CREATE POLICY coaching_venue_closures_coach_read ON public.coaching_venue_closures FOR SELECT TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'coach');
CREATE POLICY coach_hours_coach_read ON public.coach_hours FOR SELECT TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'coach');
CREATE POLICY coach_hour_exceptions_coach_read ON public.coach_hour_exceptions FOR SELECT TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'coach');
CREATE POLICY coach_hour_exceptions_coach_flag_or_extra ON public.coach_hour_exceptions FOR INSERT TO authenticated
  WITH CHECK (
    organisation_id = public.get_my_org()
    AND public.get_my_role() = 'coach'
    AND coach_id = auth.uid()
    AND kind IN ('flag', 'extra')
  );
CREATE POLICY regular_slots_coach_read ON public.regular_slots FOR SELECT TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'coach');
CREATE POLICY coaching_sessions_coach_read ON public.coaching_sessions FOR SELECT TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'coach');

-- Parent reads their own.
CREATE POLICY coaching_venues_parent_read ON public.coaching_venues FOR SELECT TO authenticated
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'parent');
CREATE POLICY regular_slots_parent_read ON public.regular_slots FOR SELECT TO authenticated
  USING (parent_id = auth.uid());
CREATE POLICY coaching_sessions_parent_read ON public.coaching_sessions FOR SELECT TO authenticated
  USING (parent_id = auth.uid());
CREATE POLICY coaching_charges_parent_read ON public.coaching_charges FOR SELECT TO authenticated
  USING (parent_id = auth.uid());
CREATE POLICY coaching_credits_parent_read ON public.coaching_credits FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

-- anon: no policies. The public booking page reads and holds through server routes.
