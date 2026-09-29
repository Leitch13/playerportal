-- 121 · Refunds Player Portal covers when an academy's Stripe balance is empty.
--
-- Every academy's payouts sweep their Stripe balance to the bank, so a refund
-- that pulls the money back from the academy (reverse_transfer) fails with
-- "insufficient funds". Instead Player Portal refunds the parent from its own
-- balance and records here what the academy received for that payment. It is
-- taken back as a larger Player Portal fee on the academy's next membership
-- invoices (Stripe lets the platform set its fee while an invoice is a draft).
--
-- Same for every academy. Nobody writes from the browser: the service role does.

CREATE TABLE IF NOT EXISTS public.refund_recoveries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  payment_id        uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  stripe_refund_id  text NOT NULL UNIQUE,
  stripe_charge_id  text,
  amount_pence      integer NOT NULL CHECK (amount_pence > 0),  -- what the academy received and now owes back
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'repaid', 'written_off')),
  description       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  repaid_at         timestamptz
);
CREATE INDEX IF NOT EXISTS refund_recoveries_org_open ON public.refund_recoveries(organisation_id) WHERE status = 'open';

-- One row per invoice a repayment was taken from. Reserved when the draft invoice
-- is changed, collected when it is paid, released if it never is.
CREATE TABLE IF NOT EXISTS public.refund_recovery_deductions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_id       uuid NOT NULL REFERENCES public.refund_recoveries(id) ON DELETE CASCADE,
  organisation_id   uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL,
  amount_pence      integer NOT NULL CHECK (amount_pence > 0),
  status            text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'collected', 'released')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  settled_at        timestamptz,
  UNIQUE (recovery_id, stripe_invoice_id)
);
CREATE INDEX IF NOT EXISTS refund_recovery_deductions_invoice ON public.refund_recovery_deductions(stripe_invoice_id);

ALTER TABLE public.refund_recoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_recovery_deductions ENABLE ROW LEVEL SECURITY;

-- An academy's admins can see what they owe and what has been taken back.
DROP POLICY IF EXISTS refund_recoveries_admin_read ON public.refund_recoveries;
CREATE POLICY refund_recoveries_admin_read ON public.refund_recoveries
  FOR SELECT TO authenticated
  USING (organisation_id = (SELECT p.organisation_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS refund_recovery_deductions_admin_read ON public.refund_recovery_deductions;
CREATE POLICY refund_recovery_deductions_admin_read ON public.refund_recovery_deductions
  FOR SELECT TO authenticated
  USING (organisation_id = (SELECT p.organisation_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
