-- ─────────────────────────────────────────────────────────────────────
-- 112 — camp_bookings.player_id: a camp child becomes a real player
-- ─────────────────────────────────────────────────────────────────────
--
-- A camp booking has always been free text: child_name, child_dob,
-- parent_email. No players row, no parent account. That was deliberate —
-- the checkout runs unauthenticated so a parent can book in ninety seconds
-- without creating anything.
--
-- The cost is that nothing can follow the child afterwards. Progress
-- reports are keyed on progress_reviews.player_id and emailed via
-- players.parent_id → profiles.email. A child who only ever attends camps
-- has neither, so a coach cannot write them a report and there is nobody
-- to send it to. On 2026-09-04 one academy had promised camp reports in
-- their marketing; of their two booked children, one could receive a
-- report and one could not — and the one that could only could because
-- the parent had spontaneously registered four hours after paying.
--
-- This column is the link. It is written by src/lib/camp-player-link.ts
-- once a booking is PAID — never for a pending booking, because an
-- abandoned checkout must not manufacture a roster entry (see 109 for what
-- phantom players do to an academy's numbers).
--
-- Nullable on purpose: every historical booking starts NULL, and the
-- backfill only links where a parent account already exists. Creating
-- accounts for 160 past campers unasked is a decision, not a migration.
--
-- ON DELETE SET NULL: archiving a player leaves the booking (and its
-- payment history) intact; deleting one does not take the booking with it.
--
-- Reversible:
--   DROP INDEX IF EXISTS idx_camp_bookings_player;
--   ALTER TABLE public.camp_bookings DROP COLUMN IF EXISTS player_id;

ALTER TABLE public.camp_bookings
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.camp_bookings.player_id IS
  'The players row this camp child was linked to once the booking was paid. NULL for pending bookings and for historical bookings whose parent has no account. Set by linkCampBookingToPlayer; see migration 112.';

CREATE INDEX IF NOT EXISTS idx_camp_bookings_player
  ON public.camp_bookings (player_id)
  WHERE player_id IS NOT NULL;

-- ── PROOF ────────────────────────────────────────────────────────────
-- select payment_status,
--        count(*) filter (where player_id is not null) as linked,
--        count(*) filter (where player_id is null)     as unlinked
--   from public.camp_bookings
--  group by 1 order by 1;
