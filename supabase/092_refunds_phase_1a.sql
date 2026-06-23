-- Refunds Phase 1A — Camp refunds (additive schema).
--
-- All changes additive — every existing column, index, query, and code
-- path continues to work unchanged after this migration applies. New
-- columns default to NULL / 0 so existing rows remain valid.
--
-- Pairs with:
--   - /api/admin/payments/[id]/refund/route.ts  (POST endpoint)
--   - /api/stripe/webhooks/route.ts             (charge.refunded handler)
--   - /lib/stripe-refund-resolver.ts            (charge id resolver)
--
-- Rollback: drop the 6 columns + drop the unique index. The 'refunded'
-- enum value cannot be removed without rebuilding the type, but it is
-- never referenced until the new code is deployed, so leaving it after
-- a rollback is safe (orphan, like camp_bookings.payment_status='refunded'
-- which has been orphan in production for months).

-- ─── Refund columns on payments ───
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_refunded numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at     timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_refund_id text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_reason    text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_by      uuid REFERENCES profiles(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_charge_id text;

-- ─── Extend payment_status enum to include 'refunded' ───
-- NB: ALTER TYPE ADD VALUE must NOT be wrapped in a BEGIN/COMMIT in older
-- Postgres versions; we keep this outside any transaction block. The
-- DO block guards against re-running on a DB that already has the value.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'payment_status'::regtype
      AND enumlabel = 'refunded'
  ) THEN
    ALTER TYPE payment_status ADD VALUE 'refunded';
  END IF;
END $$;

-- ─── Partial unique on stripe_refund_id (webhook idempotency safety net) ───
-- The webhook handler will already be idempotent via shouldProcessEvent,
-- but this index is a belt-and-braces guarantee against double-write if
-- the event guard ever misfires.
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_refund_id_uq
  ON payments (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

-- ─── Sanity SELECT (per CLAUDE.md migration rule) ───
-- Confirms every new column exists. Paste the result back to verify.
SELECT
  bool_and(column_name IS NOT NULL) AS all_columns_present,
  array_agg(column_name ORDER BY column_name) AS columns
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN (
    'amount_refunded',
    'refunded_at',
    'stripe_refund_id',
    'refund_reason',
    'refunded_by',
    'stripe_charge_id'
  );
