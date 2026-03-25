-- ============================================================
-- Payments Module Upgrade
-- Run this AFTER the initial schema.sql
-- ============================================================

-- 1. Add amount_paid column to track partial payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0;

-- 2. Replace the payment_status enum
-- Supabase doesn't allow ALTER TYPE ... RENAME VALUE easily, so we:
--   a) Add new values
--   b) Update existing data
--   c) (Old values remain in the enum but won't be used)
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'unpaid';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'partial';

-- Migrate existing data to new statuses
UPDATE public.payments SET status = 'unpaid' WHERE status = 'pending';
UPDATE public.payments SET status = 'paid', amount_paid = amount WHERE status = 'paid';
-- 'overdue' stays as-is
-- 'waived' stays as-is (legacy, no longer selectable in UI)

-- 3. Add index for overdue lookups
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date);
