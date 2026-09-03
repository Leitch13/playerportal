-- ─────────────────────────────────────────────────────────────────────
-- 110 — Photo and media consent, per child
-- ─────────────────────────────────────────────────────────────────────
--
-- Asked for by an academy on 2026-09-03: a coach wanted to know, before
-- posting a session photo, whether that particular child's family had agreed.
-- There was no way to answer it.
--
-- WHAT EXISTED BEFORE
-- -------------------
--   camp_bookings.consent_given   a real per-booking tick, camps only
--   *.terms_accepted_at           the T&Cs tick, which is NOT photo consent
--
-- A parent booking weekly classes ticked "I've read and agree to the Terms &
-- Conditions and confirm I am the parent or legal guardian". Nothing about
-- photographs. An academy could put media consent into their T&C text and
-- treat the tick as covering it, which is legally something and practically
-- useless: it cannot be read off a register, filtered, or checked for one
-- child before posting one photo.
--
-- THREE STATES, NOT TWO
-- ---------------------
-- photo_consent is deliberately NULLABLE and defaults to NULL:
--   NULL   never asked           — for every child already on the platform
--   true   the parent agreed
--   false  the parent declined
--
-- "Never asked" must never be readable as "yes", and must not silently become
-- "no" either — an academy chasing consent needs to tell the difference
-- between a family that said no and a family nobody asked. A boolean NOT NULL
-- DEFAULT false would erase that distinction for all 302 existing players and
-- make every one of them look like a refusal.
--
-- Deliberately NOT backfilled from terms_accepted_at. A parent who agreed to
-- terms did not thereby consent to photographs, and inferring it would put
-- words in their mouth on a question about their child's image.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS photo_consent        boolean,
  ADD COLUMN IF NOT EXISTS photo_consent_at     timestamptz,
  ADD COLUMN IF NOT EXISTS photo_consent_source text;

COMMENT ON COLUMN public.players.photo_consent IS
  'Photo and media consent for THIS child. NULL = never asked (the default, and true of every player predating migration 110); true = the parent agreed; false = the parent declined. Never infer true from terms acceptance — agreeing to T&Cs is not agreeing to photographs.';
COMMENT ON COLUMN public.players.photo_consent_at IS
  'When the answer was recorded. Set alongside photo_consent so an academy can show what was agreed and when.';
COMMENT ON COLUMN public.players.photo_consent_source IS
  'Where the answer came from: ''booking'' (parent ticked at signup), ''admin'' (recorded by the academy on the parent''s behalf), ''parent_dashboard'' (parent changed it later).';

-- Answering "who has not been asked" and "who said no" is the whole point, and
-- both are the rare case — a partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_players_photo_consent_pending
  ON public.players (organisation_id)
  WHERE photo_consent IS DISTINCT FROM true AND archived_at IS NULL;

-- ── PROOF ────────────────────────────────────────────────────────────
-- select o.name,
--        count(*) filter (where p.photo_consent is true)  as agreed,
--        count(*) filter (where p.photo_consent is false) as declined,
--        count(*) filter (where p.photo_consent is null)  as never_asked
--   from public.players p join public.organisations o on o.id = p.organisation_id
--  where p.archived_at is null
--  group by o.name order by 1;
