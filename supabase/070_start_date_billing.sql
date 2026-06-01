-- 070: Start-date-driven billing — additive, fully reversible.
--
-- Adds enrolments.activates_on so the booking gate can require a chosen
-- start date in addition to an active subscription. This decouples
-- "has paid" from "may attend" — supports both:
--   - immediate-start prorated signups (Stage 2): activates_on = today
--   - future-start signups (Stage 3, separate rollout): activates_on > today
--
-- Backfill sets activates_on = enrolled_at::date for every existing row,
-- so the booking-gate change is invisible to existing customers (their
-- start date is in the past → date check is trivially satisfied).
--
-- ─── Run order ──────────────────────────────────────────────────────────
-- 1. Apply this migration to prod Supabase.
-- 2. Verify 0 rows have NULL activates_on (the backfill is in the same TX).
-- 3. Deploy Stage 1 + Stage 2 code (feature flag OFF — code reads/writes
--    activates_on but the new billing branch isn't taken yet).
-- 4. Flip flag for Jamie's org → soak → flip for all.
--
-- Safe to run while Stage 1/2 code is undeployed because every existing
-- query against enrolments uses explicit columns; an extra column is a
-- no-op for the running production code.

-- ─── Step 1: add column (nullable initially so backfill is clean) ───
alter table public.enrolments
  add column if not exists activates_on date;

-- ─── Step 2: backfill existing rows ───
-- enrolled_at exists on every row (default now() not null), so this never
-- produces NULL even for legacy rows.
update public.enrolments
  set activates_on = enrolled_at::date
  where activates_on is null;

-- ─── Step 3: enforce NOT NULL going forward ───
-- Code in webhooks/route.ts will write activates_on on every new insert.
alter table public.enrolments
  alter column activates_on set not null;

-- ─── Step 4: index for the booking-gate query ───
-- enrolments/book/route.ts will check (player_id, group_id, activates_on)
-- on every booking attempt. The existing (player_id, group_id) unique
-- constraint already handles the duplicate check; this index is for the
-- "is the chosen session date >= activates_on" comparison.
create index if not exists enrolments_activation_idx
  on public.enrolments (activates_on)
  where status in ('active','pending');

-- ─── Step 5: column comment for future readers ───
comment on column public.enrolments.activates_on is
  'Date the enrolment is bookable from. Set by the subscribe flow from the start-date picker. Backfilled to enrolled_at::date for legacy rows so existing customers are unaffected.';

-- ─── Verification (read-only — does not affect rollback) ───
-- After running, expect:
--   select count(*) from public.enrolments where activates_on is null;  -- 0
--   select count(*) from public.enrolments;                              -- unchanged from before
