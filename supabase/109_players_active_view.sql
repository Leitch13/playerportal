-- ─────────────────────────────────────────────────────────────────────
-- 109 — players_active: the default that makes the right thing easy
-- ─────────────────────────────────────────────────────────────────────
--
-- Archiving a player has always worked. On 2026-09-03 all 66 archived players
-- across the platform were confirmed to hold ZERO active enrolments and ZERO
-- live subscriptions, so the cascade in archive_player_safe does its job.
--
-- What did not work is everything that reads players afterwards. Nine of the
-- surfaces that query the table filtered on archived_at; five did not:
--   admin dashboard (3 count queries), payments page (roster + recently
--   added), enrolments page, reports & analytics, parent-facing child lists.
--
-- At Gold and Gray that meant 236 players counted where 177 are live — a 33%
-- overcount on the academy's headline figure, on the screen the owner opens
-- first, while she spent a week reconciling against those numbers. She would
-- archive a duplicate, watch it vanish from the players list, and see every
-- other number stay exactly the same.
--
-- WHY A VIEW AND NOT RLS
-- ----------------------
-- The rule is not about WHO is asking. The same admin needs the archived row
-- on a financial report and not on a register. Encoding that in a policy means
-- a flag or a bypass, and this week has been a lesson in what those do: the
-- guard inside the quarterly branch, the role check in one of three branches,
-- the price route that checked ownership and the cancel route that did not.
-- A view puts the intent in the query's own name instead.
--
-- WHAT THIS DOES NOT DO
-- ---------------------
-- It does not prevent a future query using `players` and silently including
-- archived rows. Nothing here can. That is what canary 11 is for — it compares
-- the two counts per academy and reports the gap, so the sixth call site
-- nobody converted shows up in the morning rather than in a reconciliation.
--
-- WHEN THE RAW TABLE IS STILL RIGHT
-- ---------------------------------
-- Today every archived player is a duplicate: 0 attendance rows, 0 progress
-- reviews, 2 dead subscriptions between them. So hiding them breaks nothing
-- NOW. But archive_reason has six values and only two are in use. The first
-- genuine `left_academy` has a season of attendance, reports and payments
-- behind them, and dropping that person from a financial view retrospectively
-- rewrites last year. Payment history therefore stays on `players`.
--
-- Reversible: DROP VIEW public.players_active;

CREATE OR REPLACE VIEW public.players_active AS
  SELECT * FROM public.players WHERE archived_at IS NULL;

COMMENT ON VIEW public.players_active IS
  'Players excluding archived ones. The default for any read that means "who is here now" — rosters, counts, pickers, dashboards, parent-facing lists. Use the players table directly ONLY where an archived person must still appear: payment history, financial reconciliation covering a period they were active, historical attendance, and exports. Added in migration 109 after five surfaces were found counting archived players, inflating one academy''s headline figure by 33%.';

-- The view inherits RLS from public.players (security_invoker), so tenant
-- isolation is unchanged — this narrows what is returned, it never widens it.
ALTER VIEW public.players_active SET (security_invoker = true);

GRANT SELECT ON public.players_active TO authenticated, anon, service_role;

-- ── PROOF ────────────────────────────────────────────────────────────
-- select o.name,
--        (select count(*) from public.players p where p.organisation_id = o.id) as raw,
--        (select count(*) from public.players_active p where p.organisation_id = o.id) as active
--   from public.organisations o
--  where o.stripe_account_id is not null
--  order by 1;
