-- 071: Stage 3 — future-start billing.
--
-- Adds the columns needed to defer Stripe subscription creation until a
-- chosen future start_date. Parents picking a future start go through Stripe
-- Checkout in SETUP MODE (card collected, £0 today). The webhook writes a
-- subscriptions row with status='scheduled' + start_date + stripe_setup_intent_id
-- and an enrolments row with status='pending' + activates_on = start_date.
--
-- A daily cron then queries scheduled subs where start_date <= today and
-- calls stripe.subscriptions.create with billing_cycle_anchor = 1st of next
-- month — the same primitive Stage 2 already uses for immediate-start signups,
-- just deferred by N days.
--
-- ─── Run order ──────────────────────────────────────────────────────────
-- Apply BEFORE deploying Stage 3 code. The new columns are nullable so
-- existing rows are unaffected. New code paths populate them on insert.
--
-- Safe to run while Stage 3 code is undeployed because:
--   * Existing INSERTs on subscriptions don't reference start_date or
--     stripe_setup_intent_id (PostgREST handles missing columns gracefully)
--   * Existing status enum values are preserved
--   * New 'scheduled' status is additive

-- ─── Step 1: extend status check to include 'scheduled' ───
-- The subscriptions.status column may have a check constraint named
-- subscriptions_status_check (varies between projects). Drop if exists and
-- re-add with 'scheduled' included. Order matters: drop first, recreate.
alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in (
    'scheduled',      -- NEW: card saved, awaiting cron activation on start_date
    'trialing',
    'active',
    'past_due',
    'unpaid',
    'canceled',
    'incomplete',
    'incomplete_expired'
  ));

-- ─── Step 1b: extend enrolment_status enum to include 'pending' ───
-- Stage 3 future-start enrolments are written as 'pending' at signup and
-- flipped to 'active' by the activation cron on start_date. This keeps
-- all existing `WHERE status = 'active'` queries (active-member counts,
-- coach metrics, MRR widgets) correctly excluding future-start customers
-- until they actually start paying.
--
-- The booking gate at /api/enrolments/book/route.ts already handles
-- 'pending' rows via the activates_on check (and the existing duplicate
-- detection logic ignores cancelled/paused). class capacity counts
-- intentionally include 'pending' so the seat is reserved.
alter type public.enrolment_status add value if not exists 'pending';

-- ─── Step 2: add columns for future-start metadata ───
-- training_group_id links the scheduled subscription to the class it was
-- created for, so the activation cron can flip the matching enrolment from
-- 'pending' to 'active' unambiguously. NULL for legacy/immediate signups
-- (the cron only acts on rows with status='scheduled').
alter table public.subscriptions
  add column if not exists start_date date,
  add column if not exists stripe_setup_intent_id text,
  add column if not exists training_group_id uuid references public.training_groups(id);

comment on column public.subscriptions.start_date is
  'Date the subscription should be activated (Stage 3). NULL for immediate-start subs. Cron at /api/cron/activate-scheduled-subs runs daily at 02:00 UTC and creates the Stripe subscription for any row where status=scheduled AND start_date <= today.';

comment on column public.subscriptions.stripe_setup_intent_id is
  'Setup-mode Checkout creates a SetupIntent to save the card. We persist its ID so the activation cron can retrieve the saved payment method even if the customer object is mutated. Only set for Stage 3 future-start subs.';

-- ─── Step 3: index for the cron query ───
-- The activation cron will query: WHERE status = 'scheduled' AND start_date <= today
-- A partial index on (start_date) where status='scheduled' is small and fast.
create index if not exists subscriptions_scheduled_activation_idx
  on public.subscriptions (start_date)
  where status = 'scheduled';

-- ─── Step 3b: partial unique index on stripe_setup_intent_id ───
-- Migration 069 added a partial unique index on stripe_subscription_id (where
-- not null). For Stage 3 SetupIntent-mode signups, stripe_subscription_id is
-- NULL until the cron activates the row; the unique key during scheduled
-- state is stripe_setup_intent_id. Add an analogous partial unique index so
-- duplicate webhook deliveries for the same SetupIntent don't produce
-- duplicate 'scheduled' rows.
create unique index if not exists subscriptions_stripe_setup_intent_id_unique
  on public.subscriptions (stripe_setup_intent_id)
  where stripe_setup_intent_id is not null;

-- ─── Step 4: refresh PostgREST schema cache so the new columns are
--           immediately visible via REST without waiting for natural reload.
notify pgrst, 'reload schema';

-- ─── Verification (read-only — does not affect rollback) ───
-- After running, expect:
--   select count(*) from public.subscriptions where status = 'scheduled';   -- 0 (no Stage 3 signups yet)
--   select column_name from information_schema.columns where table_name = 'subscriptions' and column_name in ('start_date', 'stripe_setup_intent_id'); -- 2 rows
--   select indexname from pg_indexes where tablename = 'subscriptions' and indexname = 'subscriptions_scheduled_activation_idx'; -- 1 row
