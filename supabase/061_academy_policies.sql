-- 061: Per-academy policies + T&Cs acceptance tracking
--
-- Adds four policy columns to organisations and a new table to track when
-- each parent accepts each academy's T&Cs (with version snapshot for
-- legal compliance if terms change later).
--
-- All columns nullable / safe defaults. Idempotent — safe to re-run.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS cancellation_notice_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_policy text,
  ADD COLUMN IF NOT EXISTS late_payment_grace_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terms_text text;

COMMENT ON COLUMN public.organisations.cancellation_notice_days IS
  'Number of days notice a parent must give before subscription cancellation takes effect. 0 = immediate cancel allowed.';
COMMENT ON COLUMN public.organisations.refund_policy IS
  'Free text refund policy shown to parents on the booking + terms pages.';
COMMENT ON COLUMN public.organisations.late_payment_grace_days IS
  'Number of days after a failed payment before access is suspended. 0 = immediate.';
COMMENT ON COLUMN public.organisations.terms_text IS
  'Academy-specific terms & conditions text. Markdown supported. Shown at /book/{slug}/terms and on signup.';

-- Track each parent's acceptance of each academy's T&Cs. Snapshot the terms
-- length + a hash so we can prove which version they accepted if academy
-- updates their T&Cs later.
CREATE TABLE IF NOT EXISTS public.academy_terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  terms_version_hash text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  UNIQUE (profile_id, organisation_id, terms_version_hash)
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_profile ON public.academy_terms_acceptances(profile_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_org ON public.academy_terms_acceptances(organisation_id);

ALTER TABLE public.academy_terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Parents can read their own acceptances; admins can read all in their org.
DROP POLICY IF EXISTS "Parents read own acceptances" ON public.academy_terms_acceptances;
CREATE POLICY "Parents read own acceptances"
  ON public.academy_terms_acceptances FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Org admins read all acceptances" ON public.academy_terms_acceptances;
CREATE POLICY "Org admins read all acceptances"
  ON public.academy_terms_acceptances FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

-- Authenticated users can insert their own acceptance row (signup flow).
DROP POLICY IF EXISTS "Anyone can record own acceptance" ON public.academy_terms_acceptances;
CREATE POLICY "Anyone can record own acceptance"
  ON public.academy_terms_acceptances FOR INSERT
  WITH CHECK (profile_id = auth.uid());
