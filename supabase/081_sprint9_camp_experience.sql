-- ════════════════════════════════════════════════════════════════════════
-- 081 — Sprint 9: Camp Experience & Roster Management
--
-- Two minimal schema changes:
--
-- 1. payments.parent_id → nullable
--    Camps are publicly bookable without a Player Portal profile in the
--    academy's org. Today the webhook camp-branch silently SKIPS the
--    payments insert when the parent has no matching profile, which is
--    why Alisha Molloy paid £20 on the 1 June Holiday Camp but never
--    appeared on Jamie Allan's Payments dashboard. Relaxing this lets
--    anon camp payments land on the dashboard via the academy's normal
--    /dashboard/payments route. Existing rows are unaffected (every
--    existing row already has a non-null parent_id, so the NOT NULL
--    drop is data-safe).
--
-- 2. camp_bookings.booking_source TEXT (default 'public_checkout')
--    Distinguishes parent-self-served bookings from admin-created ones
--    so the roster + revenue stats can render the right "Added by
--    admin" badge and skip Stripe-related assertions on admin entries.
--
-- Both changes are additive and reversible. RLS untouched. No protected
-- system body altered.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. payments.parent_id → nullable ───
ALTER TABLE public.payments
  ALTER COLUMN parent_id DROP NOT NULL;

-- ─── 2. camp_bookings.booking_source ───
ALTER TABLE public.camp_bookings
  ADD COLUMN IF NOT EXISTS booking_source TEXT NOT NULL DEFAULT 'public_checkout';

-- Sanity index — admin roster queries scan all rows for a camp.
CREATE INDEX IF NOT EXISTS idx_camp_bookings_camp_status
  ON public.camp_bookings (camp_id, payment_status);

-- ─── Sanity check ───
-- Run this after applying; the user pastes the row back as proof.
SELECT
  -- Column 1: parent_id is nullable
  (SELECT is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'payments'
     AND column_name = 'parent_id') AS payments_parent_id_nullable,
  -- Column 2: booking_source exists
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'camp_bookings'
      AND column_name = 'booking_source'
  ) AS camp_bookings_booking_source_exists,
  -- Column 3: index present
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'camp_bookings'
      AND indexname = 'idx_camp_bookings_camp_status'
  ) AS roster_index_exists;
-- Expected output: YES, true, true
