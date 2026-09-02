-- ─────────────────────────────────────────────────────────────────────
-- 107 — Bill for sessions, not calendar days, everywhere
-- ─────────────────────────────────────────────────────────────────────
--
-- Why
-- ---
-- A parent joining mid-month should pay for the sessions their child will
-- actually attend. Billing them for calendar days charges for Tuesdays and
-- Wednesdays a child never trains on, and for the days between signing up and
-- their first session.
--
-- The session model was built, tested and proven — and then enabled for ONE
-- academy. On 2026-09-02, 53 of 54 academies were still on `calendar`, which
-- was the column default, so every academy created since has been wrong from
-- the moment it was created and nobody had to do anything to make it so.
--
-- This makes the correct behaviour the default. An academy now has to opt OUT
-- to bill by calendar day, and a new academy is right on day one with nobody
-- remembering anything.
--
-- Companion change in code: estimateBridgePence() derives the sessions-per-
-- month figure by counting class days when a plan hasn't set one, so this
-- switch works without every academy first filling in a number against every
-- plan. That field stays as a deliberate override.
--
-- Safety
-- ------
--   • Charges can only go DOWN or stay equal for a mid-month joiner: the
--     session bridge is capped at one full month, the same ceiling calendar
--     proration has.
--   • Nothing recurring changes. This affects only the joining-month charge.
--   • No academy loses an explicit choice: `calendar` rows are left alone
--     ONLY where an academy actively set them — but none did, so the backfill
--     below moves every row that still holds the old default.
--   • Reversible: UPDATE organisations SET bridge_billing_mode = 'calendar';
--     plus ALTER ... SET DEFAULT 'calendar'.
--   • A code-level kill switch remains: BILLING_BRIDGE_MODE_KILL=true forces
--     every academy back to calendar without a migration or a redeploy.

-- ── STEP 1 — where we are now ─────────────────────────────────────────
-- SELECT bridge_billing_mode, count(*)
--   FROM public.organisations GROUP BY 1;

-- ── STEP 2 — the default for every academy created from here ──────────
ALTER TABLE public.organisations
  ALTER COLUMN bridge_billing_mode SET DEFAULT 'session';

-- ── STEP 3 — bring the existing 54 with it ────────────────────────────
UPDATE public.organisations
   SET bridge_billing_mode = 'session'
 WHERE bridge_billing_mode IS DISTINCT FROM 'session';

COMMENT ON COLUMN public.organisations.bridge_billing_mode IS
  'How a mid-month joiner is charged for their joining month: ''session'' (default) counts the class days remaining and charges per session, capped at one month; ''calendar'' prorates by day. Defaulted to session in migration 107 (2026-09-02) after 53 of 54 academies were found on the old calendar default, charging joiners for days their children had not trained.';

-- ── STEP 4 — proof it took ────────────────────────────────────────────
SELECT bridge_billing_mode, count(*) AS academies
  FROM public.organisations
 GROUP BY 1
 ORDER BY 1;
