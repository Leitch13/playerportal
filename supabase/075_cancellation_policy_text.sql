-- 075: Cancellation policy text shown to parents at cancel time
--
-- 061 added cancellation_notice_days (numeric) + refund_policy (text).
-- This migration adds a dedicated cancellation_policy text that parents
-- see in the cancel flow BEFORE confirming. It complements (does not
-- replace) refund_policy — refunds and cancellations are distinct.
--
-- Backwards-compatible: nullable, no defaults required. If null, the cancel
-- flow falls back to a generic "your cancellation will take effect at end
-- of period" message.

alter table public.organisations
  add column if not exists cancellation_policy text;

comment on column public.organisations.cancellation_policy is
  'Free-text policy shown to parents in the cancellation flow. Falls back to a generic notice when null. Separate from refund_policy.';
