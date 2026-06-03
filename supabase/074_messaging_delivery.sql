-- 069: Messaging delivery columns
--
-- Day 1 — make in-app messaging trustworthy. Adds delivery tracking +
-- channel routing to the legacy `messages` table so the academy owner
-- can answer "did the parent actually receive my message?"
--
-- WhatsApp readiness: `channel` defaults to 'email' but accepts
-- 'whatsapp' / 'sms' / 'in_app' so a future Cloud API integration
-- can route through the same send pipeline.
--
-- Backwards-compatible: every column has a default; no rewrite of
-- existing rows required.

alter table public.messages add column if not exists channel text not null default 'email'
  check (channel in ('email', 'whatsapp', 'sms', 'in_app'));

alter table public.messages add column if not exists delivery_status text not null default 'pending'
  check (delivery_status in ('pending', 'sent', 'delivered', 'failed', 'skipped'));

-- Timestamps for the send pipeline.
alter table public.messages add column if not exists delivery_attempted_at timestamptz;
alter table public.messages add column if not exists delivery_completed_at timestamptz;

-- Failure context when delivery_status='failed'. Keep concise — this is
-- shown back to the academy owner if we surface a "delivery failed"
-- badge in the future.
alter table public.messages add column if not exists delivery_failure_reason text;

-- Snapshot the recipient's email at send time. The profiles.email column
-- may change after we sent; this preserves what we actually attempted.
-- Also enables async webhook updates to find the original row when the
-- delivery provider (Resend / WhatsApp) sends status callbacks.
alter table public.messages add column if not exists recipient_email_snapshot text;

-- External delivery-provider message id (Resend / Twilio / WhatsApp).
-- Stored for future delivery-status webhook routing.
alter table public.messages add column if not exists provider_message_id text;

-- Indexes for the delivery-status surfaces we may build later.
create index if not exists idx_messages_delivery_status on public.messages (organisation_id, delivery_status);
create index if not exists idx_messages_channel on public.messages (organisation_id, channel);

-- Comment block documenting the rollout. The `messages` table is the
-- ACTIVE messaging surface. The newer `conversations` /
-- `conversation_messages` / `conversation_participants` tables (from
-- migration 043) have zero writers and zero production rows; they are
-- left in place but considered DEPRECATED until a future phase migrates.
comment on column public.messages.channel is
  'Delivery channel for the message. Default email. Set to whatsapp/sms when those channels are wired.';
comment on column public.messages.delivery_status is
  'Tracks the delivery pipeline. pending → sent → delivered (with potential webhook updates) | failed | skipped.';
comment on column public.messages.recipient_email_snapshot is
  'Email address used at send time. Stored for audit and for matching async provider webhooks.';
