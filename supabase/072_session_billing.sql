-- 072: Session-based bridge billing — additive support.
--
-- Adds two columns, both nullable / defaulted, both safe to apply with
-- the calendar-day code path live. No existing query path reads them.
--
-- Behavior matrix once the new code ships:
--
--   org.bridge_billing_mode | plan.sessions_per_month | result
--   ------------------------ | ----------------------- | -------
--   'calendar' (default)     | any                     | calendar-day proration (current Stage 3)
--   'session'                | NULL                    | falls back to calendar-day for that plan
--   'session'                | > 0                     | session-based bridge
--
-- Safe to apply BEFORE deploying the session-bridge code because the
-- subscribe route + cron + webhook ignore both columns until the new
-- dispatch branch lands.

-- ─── Step 1: per-org bridge mode ───
do $$ begin
  create type public.bridge_billing_mode as enum ('calendar', 'session');
exception when duplicate_object then null;
end $$;

alter table public.organisations
  add column if not exists bridge_billing_mode public.bridge_billing_mode
  not null default 'calendar';

comment on column public.organisations.bridge_billing_mode is
  'Stage 3 bridge charge mode. calendar = Stripe-native calendar-day proration (default). session = per-session × remaining sessions before anchor, charged at checkout. Falls back to calendar if a plan lacks sessions_per_month.';

-- ─── Step 2: per-plan sessions_per_month ───
-- Nullable on purpose. NULL → bridge always uses calendar-day for THAT plan
-- even when the org is in session mode. Lets an academy use session-mode
-- for their 1-2-1 plans while keeping "Unlimited" / ambiguous plans on
-- calendar without complex rules.
alter table public.subscription_plans
  add column if not exists sessions_per_month smallint
  check (sessions_per_month is null or (sessions_per_month > 0 and sessions_per_month <= 30));

comment on column public.subscription_plans.sessions_per_month is
  'Number of class sessions the plan covers per calendar month. NULL = bridge always uses calendar-day proration for this plan. Set explicitly per plan — do not auto-derive from name.';

-- ─── Step 3: refresh PostgREST cache ───
notify pgrst, 'reload schema';

-- ─── Verification (read-only) ───
-- After running, expect:
--   select column_name from information_schema.columns
--     where table_name in ('organisations','subscription_plans')
--       and column_name in ('bridge_billing_mode','sessions_per_month');
--   → 2 rows
--
--   select count(*) from public.organisations where bridge_billing_mode = 'session';
--   → 0 (no orgs activated yet)
--
--   select count(*) from public.subscription_plans where sessions_per_month is not null;
--   → 0 (no plans backfilled yet)
