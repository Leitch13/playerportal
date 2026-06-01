-- 069: Webhook reliability — idempotency + duplicate-prevention.
--
-- 1) stripe_events table records every webhook event we receive so the
--    handler can short-circuit on duplicate deliveries (Stripe explicitly
--    documents "at least once" delivery semantics).
--
-- 2) Partial unique indexes on payments.stripe_session_id and
--    subscriptions.stripe_subscription_id so even if a duplicate write
--    slips past the handler, the DB rejects it. Both columns are nullable;
--    the WHERE clause makes NULL rows freely duplicable (intended for
--    manual entries).
--
-- These changes are forward-compatible with the existing webhook handler.
-- The accompanying webhook code change (PR alongside this migration) is
-- required to ACTUALLY use them.

create table if not exists public.stripe_events (
  event_id        text primary key,             -- evt_xxx from Stripe
  event_type      text not null,                -- e.g. "checkout.session.completed"
  livemode        boolean,                       -- copied from event.livemode for filtering
  status          text not null default 'received'
                    check (status in ('received','in_progress','success','error')),
  handler         text,                          -- e.g. "handleCheckoutCompleted"
  error_message   text,                          -- only set when status='error'
  attempt_count   integer not null default 1,
  first_seen_at   timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  completed_at    timestamptz
);

-- Hot-path index for the idempotency check at the top of the handler.
create index if not exists stripe_events_status_idx
  on public.stripe_events (status, last_attempt_at);

-- Audit index: recent failures for the reconciliation cron (Stage E later).
create index if not exists stripe_events_failures_idx
  on public.stripe_events (status, last_attempt_at desc)
  where status = 'error';

-- ── 3) DB-level uniqueness (belt-and-braces) ──────────────────────────────
-- Partial unique indexes so NULL rows (manual entries) stay freely
-- duplicable while Stripe-sourced rows must be unique by their object ID.
--
-- IMPORTANT: these will fail if duplicate rows already exist. The runbook
-- for this migration includes a pre-flight SELECT to confirm no duplicates
-- BEFORE this migration runs. Do not run blindly.

create unique index if not exists payments_stripe_session_id_unique
  on public.payments (stripe_session_id)
  where stripe_session_id is not null;

create unique index if not exists subscriptions_stripe_subscription_id_unique
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- RLS: stripe_events is platform-internal — no academy admin needs to see it.
-- The webhook handler uses the service-role key which bypasses RLS.
alter table public.stripe_events enable row level security;

create policy "no public access to stripe_events"
  on public.stripe_events for all
  using (false) with check (false);
