-- ─────────────────────────────────────────────────────────────────────
-- 111 — Photo and media consent on camp bookings
-- ─────────────────────────────────────────────────────────────────────
--
-- Migration 110 added photo_consent to public.players and the weekly-class
-- booking form started asking every parent. Camp bookings never asked.
--
-- WHY ON camp_bookings AND NOT players
-- ------------------------------------
-- A camp booking has no link to a players row. camp_bookings carries a
-- denormalised child_name / child_dob and nothing else; the Stripe webhook
-- never creates a player for a camp booking. So the only place the answer
-- can live is on the booking itself. Same three-state rule as 110:
--   NULL   never asked — every booking made before this migration
--   true   the parent agreed
--   false  the parent declined
-- Never inferred from consent_given (participation + medical accuracy) or
-- terms_accepted_at. Neither is consent to photographs.
--
-- WHY THE FLEXIBLE-CAMP RPC IS NOT TOUCHED
-- ----------------------------------------
-- book_flexible_camp_days() (096) inserts the booking row. Its signature is
-- pinned by a GRANT and CREATE OR REPLACE with extra args would create a
-- second overload rather than replace it. Both checkout routes therefore
-- write photo_consent with a separate best-effort UPDATE after the row
-- exists. Purely additive; no existing insert path changes.

ALTER TABLE public.camp_bookings
  ADD COLUMN IF NOT EXISTS photo_consent        boolean,
  ADD COLUMN IF NOT EXISTS photo_consent_at     timestamptz,
  ADD COLUMN IF NOT EXISTS photo_consent_source text;

COMMENT ON COLUMN public.camp_bookings.photo_consent IS
  'Photo and media consent for the child on THIS booking. NULL = never asked (every booking predating migration 111); true = agreed; false = declined. Never infer from consent_given or terms acceptance.';
COMMENT ON COLUMN public.camp_bookings.photo_consent_at IS
  'When the answer was recorded.';
COMMENT ON COLUMN public.camp_bookings.photo_consent_source IS
  'Where the answer came from: ''booking'' (parent answered at checkout), ''admin'' (copied from the player record when an admin added the child).';

-- ── PROOF ────────────────────────────────────────────────────────────
-- select o.name,
--        count(*) filter (where b.photo_consent is true)  as agreed,
--        count(*) filter (where b.photo_consent is false) as declined,
--        count(*) filter (where b.photo_consent is null)  as never_asked
--   from public.camp_bookings b join public.organisations o on o.id = b.organisation_id
--  group by o.name order by 1;
