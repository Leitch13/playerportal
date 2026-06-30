-- 095: Restore 'pending_migration' as an allowed subscriptions.status value.
--
-- ─── Why ────────────────────────────────────────────────────────────────
-- Migration 071_future_start_billing.sql dropped + recreated the
-- subscriptions_status_check CHECK constraint to add 'scheduled'. That
-- migration's author listed only Stripe's canonical statuses and forgot
-- 'pending_migration' — the project-custom intermediate state that
-- migration 052_migration_invitations.sql introduced for the bulk-migration
-- invite flow (subscription pre-created with a token; parent confirms via
-- /api/migration/confirm-checkout, Stripe takes over, status transitions to
-- 'active').
--
-- Since 071 shipped, any call to /api/migration/import fails with:
--   new row for relation "subscriptions" violates check constraint
--   "subscriptions_status_check"
--
-- This migration restores the value. It is a pure SUPERSET of the current
-- constraint — no row that satisfied the 071 constraint stops satisfying
-- the new one; no code path changes; no data is touched.
--
-- ─── Run order ──────────────────────────────────────────────────────────
-- Safe to apply at any time. Idempotent (DROP IF EXISTS + recreate). No
-- downtime, no row rewrite, no index rebuild. ALTER TABLE ... ADD CONSTRAINT
-- on a small text column with full table scan in deferrable form completes
-- in milliseconds on the current production volume.

-- ─── Step 1: drop the existing constraint (idempotent) ───
-- 071 named it subscriptions_status_check. DROP IF EXISTS handles both
-- "071 was applied" and "071 was somehow skipped" cases without error.
alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

-- ─── Step 2: recreate with pending_migration restored ───
-- The 8 values from 071, in the same order for diff readability, plus
-- 'pending_migration' from 052.
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in (
    'scheduled',          -- 071: card saved, awaiting cron activation
    'trialing',           -- Stripe canonical
    'active',             -- Stripe canonical
    'past_due',           -- Stripe canonical
    'unpaid',             -- Stripe canonical
    'canceled',           -- Stripe canonical (American spelling)
    'incomplete',         -- Stripe canonical
    'incomplete_expired', -- Stripe canonical
    'pending_migration'   -- RESTORED: 052 bulk-migration intermediate state
  ));

-- ─── Step 3: refresh PostgREST schema cache ───
-- Forces an immediate cache reload so any service-role insert via REST
-- sees the new constraint on the next call without waiting for natural
-- refresh.
notify pgrst, 'reload schema';

-- ─── Verification (read-only — paste output back to confirm) ───

-- 1. Constraint exists with the expected definition (should show all 9 values)
select
  conname                       as constraint_name,
  pg_get_constraintdef(c.oid)   as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
where t.relname = 'subscriptions'
  and conname = 'subscriptions_status_check';

-- 2. No existing row violates the new constraint (expect 0)
select count(*) as rows_violating_new_constraint
from public.subscriptions
where status not in (
  'scheduled','trialing','active','past_due','unpaid',
  'canceled','incomplete','incomplete_expired','pending_migration'
);

-- 3. How many rows currently use each status (sanity)
select status, count(*) as n
from public.subscriptions
group by status
order by n desc;
