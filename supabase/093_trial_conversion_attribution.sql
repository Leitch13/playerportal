-- Trial Conversion 1A — Phase 3 attribution (additive).
--
-- Two additive changes:
--
-- 1. trial_signup_attributions table — written when a parent visits
--    /book/[slug]?trial=<id>&email=<> via the personalised links the
--    trial-followup + trial-conversion crons now emit. The webhook
--    auto-link reads this table FIRST so a parent who came through a
--    specific trial's email gets linked back to THAT trial, not just
--    the most-recent email match within a 90-day window.
--
-- 2. subscriptions.trial_booking_id column — when the webhook resolves
--    the attribution, it also stores the link permanently on the
--    subscription record. Enables per-source reporting + "this sub came
--    from which trial" queries.
--
-- Both additive. The existing 90-day email-fuzzy-match in the webhook
-- remains as a fallback for organic conversions where no attribution
-- row exists (parents who navigate directly without using the email
-- links).
--
-- Rollback: drop column + table. Webhook handler degrades gracefully
-- if either is missing (try/catch around the SELECT).

-- ─── Attribution table ───
CREATE TABLE IF NOT EXISTS trial_signup_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trial_booking_id uuid NOT NULL REFERENCES trial_bookings(id) ON DELETE CASCADE,
  parent_email     text NOT NULL,
  organisation_id  uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

-- Lookup index used by the webhook auto-link block.
-- NB: we don't use a partial predicate of `WHERE expires_at > now()` here
-- because Postgres requires index predicates to reference only IMMUTABLE
-- functions, and now() is STABLE. The webhook query already applies the
-- expires_at filter at query time, so this full index covers the same
-- access pattern; expired rows live in the index until the cleanup
-- pass deletes them.
CREATE INDEX IF NOT EXISTS trial_signup_attributions_lookup
  ON trial_signup_attributions (lower(parent_email), organisation_id);

-- Optional: idx on trial id for cleanup queries
CREATE INDEX IF NOT EXISTS trial_signup_attributions_trial_idx
  ON trial_signup_attributions (trial_booking_id);

-- RLS: lock the table down to service-role writes only. The booking page
-- writes via a server-side service-role client; the webhook reads via the
-- same. No anon/parent/coach/admin access is needed. Default-deny model
-- matches the 17-table RLS lockdown pattern (migration 077a-d).
ALTER TABLE trial_signup_attributions ENABLE ROW LEVEL SECURITY;

-- ─── Subscription → trial link column ───
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_booking_id uuid
  REFERENCES trial_bookings(id) ON DELETE SET NULL;

-- ─── Sanity SELECT (per CLAUDE.md migration rule) ───
SELECT
  bool_and(present) AS all_present,
  array_agg(thing) AS confirmed
FROM (
  SELECT 'trial_signup_attributions table' AS thing,
         to_regclass('public.trial_signup_attributions') IS NOT NULL AS present
  UNION ALL
  SELECT 'subscriptions.trial_booking_id column' AS thing,
         EXISTS(
           SELECT 1 FROM information_schema.columns
           WHERE table_name='subscriptions' AND column_name='trial_booking_id'
         ) AS present
) x;
