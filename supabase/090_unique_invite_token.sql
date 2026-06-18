-- 090: Enforce uniqueness of migration invite tokens.
--
-- Migration 052 created a NON-unique partial index on subscriptions.invite_token.
-- A token re-issue bug could attach two subscriptions to one token; the confirm
-- page/route then errors on .maybeSingle() and bricks the link. Tokens are
-- 192-bit random (randomBytes(24)), so live data has no collisions — this just
-- makes the guarantee enforceable. Safe + small.
--
-- NOT auto-applied. Run the proof SELECT first; the CREATE UNIQUE INDEX will
-- fail loudly if any duplicate non-null tokens exist (which would itself be a
-- finding worth investigating).

-- 1. Pre-check: tokens must equal distinct_tokens (zero duplicates).
SELECT
  COUNT(*) FILTER (WHERE invite_token IS NOT NULL)                  AS tokens,
  COUNT(DISTINCT invite_token) FILTER (WHERE invite_token IS NOT NULL) AS distinct_tokens
FROM public.subscriptions;

-- 2. The unique guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_subscriptions_invite_token
  ON public.subscriptions(invite_token)
  WHERE invite_token IS NOT NULL;

-- 3. The old non-unique index (052) is now redundant; drop to avoid two indexes
--    on the same predicate.
DROP INDEX IF EXISTS public.idx_subscriptions_invite_token;

-- 4. Proof row: confirm the unique index now exists.
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'subscriptions'
  AND indexname = 'uniq_subscriptions_invite_token';
