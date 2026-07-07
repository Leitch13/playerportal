-- ════════════════════════════════════════════════════════════════════════
-- 095 — Flexible Camp Booking Mode: Phase 0 (Foundation)
--
-- Introduces the schema needed to later support per-day booking on camps,
-- WITHOUT changing any existing behaviour. Pure schema: no data backfill,
-- no code-path branching (nothing in the app reads these columns yet),
-- no policy that alters existing surface behaviour.
--
-- Every existing camp implicitly becomes `booking_mode = 'whole_camp'`
-- via the column default. Every existing camp_bookings row implicitly
-- becomes `booking_mode = 'whole_camp'` via the column default. Zero
-- data migration required.
--
-- ─── What this migration adds ───
--   camps.booking_mode           text NOT NULL DEFAULT 'whole_camp'
--   camps.flex_price_per_day     numeric(10,2)   -- flat per-day for flexible mode
--   camps.flex_min_days          integer         -- optional minimum days
--   camp_bookings.booking_mode   text NOT NULL DEFAULT 'whole_camp'
--     (snapshot — never changes even if the camp's mode is later toggled)
--
--   camp_days                    (new table — zero rows for whole-camp camps)
--   camp_booking_days            (new table — zero rows for whole-camp bookings)
--
--   RLS enabled on both new tables, mirroring the parent-table policies
--   (org-scoped admin manage; public read gated to published camps only
--   on camp_days).
--
-- ─── Safety invariants preserved ───
--   * Whole-camp bookings continue to work byte-identically: the two
--     new tables have zero rows and the four new columns are not read
--     by any existing code path (Phase 0 introduces NO code branching).
--   * The additive-safety story documented in `src/lib/camps-edit.ts`
--     remains valid — whole-camp bookings still have a frozen
--     `amount_paid` on `camp_bookings`, still one row per booking.
--   * The Stripe webhook (`webhooks/route.ts`) is byte-identical —
--     nothing about `metadata.camp_booking_id` or the paid-status
--     update changes.
--   * The camp refund path (`charge.refunded` → `camp_bookings.update`)
--     is byte-identical.
--
-- ─── Rollback ───
--   DROP TABLE camp_booking_days, camp_days;
--   ALTER TABLE camp_bookings DROP COLUMN booking_mode;
--   ALTER TABLE camps
--     DROP COLUMN booking_mode,
--     DROP COLUMN flex_price_per_day,
--     DROP COLUMN flex_min_days;
-- (No enum types introduced; CHECK constraints are inline — nothing extra
--  to unpick.)
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. camps: booking_mode + flexible-mode config columns ───

ALTER TABLE public.camps
  ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'whole_camp';

-- Re-assert the CHECK so re-runs converge to the current shape.
ALTER TABLE public.camps
  DROP CONSTRAINT IF EXISTS camps_booking_mode_check;
ALTER TABLE public.camps
  ADD CONSTRAINT camps_booking_mode_check
  CHECK (booking_mode IN ('whole_camp', 'flexible_days'));

-- Flat per-day price for flexible mode. NULL when not applicable
-- (whole_camp). Never read while `booking_mode = 'whole_camp'`.
ALTER TABLE public.camps
  ADD COLUMN IF NOT EXISTS flex_price_per_day numeric(10,2);

-- Optional minimum number of days a flexible booking must include.
-- NULL means no minimum. Never consulted for whole_camp.
ALTER TABLE public.camps
  ADD COLUMN IF NOT EXISTS flex_min_days integer;


-- ─── 2. camp_bookings: booking_mode snapshot ───
--
-- Snapshotted at booking time and NEVER changes, even if the camp's
-- mode is later toggled. Protects paid families against any admin
-- edit that would otherwise retroactively change what they paid for.

ALTER TABLE public.camp_bookings
  ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'whole_camp';

ALTER TABLE public.camp_bookings
  DROP CONSTRAINT IF EXISTS camp_bookings_booking_mode_check;
ALTER TABLE public.camp_bookings
  ADD CONSTRAINT camp_bookings_booking_mode_check
  CHECK (booking_mode IN ('whole_camp', 'flexible_days'));


-- ─── 3. camp_days ───
--
-- Per-day metadata for a flexible camp. Whole-camp camps have zero rows
-- here. Fields:
--   price         Optional per-day override. NULL uses camps.flex_price_per_day.
--   max_capacity  Per-day capacity. NULL = uncapped for this day.
--   is_available  Lets an admin exclude a specific day (e.g. bank holiday)
--                 without deleting or shortening the camp.

CREATE TABLE IF NOT EXISTS public.camp_days (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id      uuid NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  date         date NOT NULL,
  price        numeric(10,2),
  max_capacity integer,
  is_available boolean NOT NULL DEFAULT true,
  sort_order   integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (camp_id, date)
);

CREATE INDEX IF NOT EXISTS idx_camp_days_camp_id ON public.camp_days (camp_id);

ALTER TABLE public.camp_days ENABLE ROW LEVEL SECURITY;

-- Public read: only for published camps. Mirrors the `camps` policy
-- pattern so parents can hydrate the day picker on a public booking
-- page in future Phase 2 without loosening auth anywhere else.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Public read camp_days for published camps'
      AND tablename = 'camp_days'
  ) THEN
    CREATE POLICY "Public read camp_days for published camps"
      ON public.camp_days
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.camps
          WHERE camps.id = camp_days.camp_id
            AND camps.is_published = true
        )
      );
  END IF;
END $$;

-- Admins/coaches manage rows in their own org's camps. Mirrors the
-- existing `Admins manage camps` policy using the same helpers.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Admins manage camp_days'
      AND tablename = 'camp_days'
  ) THEN
    CREATE POLICY "Admins manage camp_days"
      ON public.camp_days
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.camps
          WHERE camps.id = camp_days.camp_id
            AND camps.organisation_id = public.get_my_org()
            AND public.get_my_role() IN ('admin', 'coach')
        )
      );
  END IF;
END $$;


-- ─── 4. camp_booking_days ───
--
-- Which days a flexible booking covers. Whole-camp bookings have zero
-- rows here. `amount_paid` is snapshotted per row at booking time and
-- MUST NEVER be re-derived from `camp_days.price` — same principle as
-- the existing `camp_bookings.amount_paid` snapshot.

CREATE TABLE IF NOT EXISTS public.camp_booking_days (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_booking_id uuid NOT NULL REFERENCES public.camp_bookings(id) ON DELETE CASCADE,
  camp_day_id     uuid NOT NULL REFERENCES public.camp_days(id),
  amount_paid     numeric(10,2) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (camp_booking_id, camp_day_id)
);

CREATE INDEX IF NOT EXISTS idx_camp_booking_days_camp_day
  ON public.camp_booking_days (camp_day_id);
CREATE INDEX IF NOT EXISTS idx_camp_booking_days_booking
  ON public.camp_booking_days (camp_booking_id);

ALTER TABLE public.camp_booking_days ENABLE ROW LEVEL SECURITY;

-- Admins/coaches manage rows on bookings in their own org. Mirrors the
-- existing `Admins manage camp bookings` policy pattern. No public
-- SELECT — parents don't need to read these rows directly (their
-- booking confirmation email / roster is server-rendered).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Admins manage camp_booking_days'
      AND tablename = 'camp_booking_days'
  ) THEN
    CREATE POLICY "Admins manage camp_booking_days"
      ON public.camp_booking_days
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.camp_bookings
          WHERE camp_bookings.id = camp_booking_days.camp_booking_id
            AND camp_bookings.organisation_id = public.get_my_org()
            AND public.get_my_role() IN ('admin', 'coach')
        )
      );
  END IF;
END $$;


-- ─── Sanity SELECT ───
-- Confirms every new column exists with the correct default, both new
-- tables exist with RLS enabled, and every existing row auto-defaulted
-- to the whole_camp mode (i.e. zero implicit data change).

SELECT
  -- New columns + defaults
  (SELECT column_default FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'camps' AND column_name = 'booking_mode')
    AS camps_booking_mode_default,
  (SELECT column_default FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'camp_bookings' AND column_name = 'booking_mode')
    AS camp_bookings_booking_mode_default,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'camps' AND column_name = 'flex_price_per_day')
    AS camps_flex_price_per_day_exists,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'camps' AND column_name = 'flex_min_days')
    AS camps_flex_min_days_exists,

  -- New tables + RLS
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'camp_days')
    AS camp_days_exists,
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'camp_booking_days')
    AS camp_booking_days_exists,
  (SELECT relrowsecurity FROM pg_class
   WHERE relname = 'camp_days' AND relnamespace = 'public'::regnamespace)
    AS camp_days_rls_enabled,
  (SELECT relrowsecurity FROM pg_class
   WHERE relname = 'camp_booking_days' AND relnamespace = 'public'::regnamespace)
    AS camp_booking_days_rls_enabled,

  -- Zero implicit data change: every existing row auto-defaulted to whole_camp
  (SELECT COUNT(*) FROM public.camps WHERE booking_mode <> 'whole_camp')
    AS non_whole_camp_camps_count,
  (SELECT COUNT(*) FROM public.camp_bookings WHERE booking_mode <> 'whole_camp')
    AS non_whole_camp_bookings_count;

-- Expected:
--   camps_booking_mode_default:            'whole_camp'::text
--   camp_bookings_booking_mode_default:    'whole_camp'::text
--   camps_flex_price_per_day_exists:       true
--   camps_flex_min_days_exists:            true
--   camp_days_exists:                      true
--   camp_booking_days_exists:              true
--   camp_days_rls_enabled:                 true
--   camp_booking_days_rls_enabled:         true
--   non_whole_camp_camps_count:            0
--   non_whole_camp_bookings_count:         0
