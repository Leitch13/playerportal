-- ============================================================================
-- 086_waitlist_accept_token.sql
-- Batch 2a / Finding #1 — per-offer token for the waitlist accept/decline
-- email links. The /api/waitlist/accept and /api/waitlist/decline routes run
-- with the service-role key and previously authenticated nothing but the entry
-- id, so anyone who knew/guessed a waitlist UUID could accept or decline an
-- offer. This column carries a high-entropy token minted when an entry becomes
-- 'offered'; the routes (flag WAITLIST_ACCEPT_TOKEN_ENABLED) require it to match.
--
-- Backward-compat / grace: this migration ADDS the column nullable and does
-- NOT backfill existing 'offered' rows. Those rows' already-sent emails carry
-- token-less links; the route's grace rule (NULL accept_token => allow) keeps
-- them working until they expire. Every offer has a 48h expires_at, so all
-- NULL-token offers age out within 48h of enabling the flag, after which the
-- gate is fully enforced. Backfilling would BREAK in-flight offers (their sent
-- emails have no token to match), so it is deliberately omitted.
--
-- Non-destructive + reversible. ROLLBACK:
--   ALTER TABLE public.waitlist DROP COLUMN IF EXISTS accept_token;
-- (or simply leave the column and set WAITLIST_ACCEPT_TOKEN_ENABLED=false).
-- ============================================================================

ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS accept_token text;

-- Proof row (paste back the result after applying):
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'waitlist'
  AND column_name = 'accept_token';
