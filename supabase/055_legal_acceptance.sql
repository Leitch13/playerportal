-- Capture explicit legal acceptance (ToS + DPA) on each organisation row.
-- Without this, academies could sign up and start operating without any
-- record that they agreed to our terms or the data processing agreement
-- they need to have with us for processing kids' coaching data.
--
-- Stored on organisations (not profiles) because acceptance is on behalf
-- of the legal entity, not the individual admin. accepted_by_user_id
-- records *who* clicked "I agree" so we can show that on an audit trail.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS dpa_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS accepted_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_ip text,
  ADD COLUMN IF NOT EXISTS accepted_user_agent text;

COMMENT ON COLUMN public.organisations.terms_accepted_at IS 'When the academy admin accepted the Terms of Service.';
COMMENT ON COLUMN public.organisations.dpa_accepted_at IS 'When the academy admin accepted the Data Processing Agreement.';
COMMENT ON COLUMN public.organisations.terms_version IS 'Version string of the legal terms accepted (e.g. v1.0.0). Bump when terms materially change.';
COMMENT ON COLUMN public.organisations.accepted_by_user_id IS 'The profile that clicked "I agree" on behalf of the organisation.';
COMMENT ON COLUMN public.organisations.accepted_ip IS 'IP address captured at acceptance time, for the audit trail.';
COMMENT ON COLUMN public.organisations.accepted_user_agent IS 'User-Agent captured at acceptance time, for the audit trail.';
