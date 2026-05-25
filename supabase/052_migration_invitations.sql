-- Migration invitations: let academies bulk-import subscribers from ClassForKids
-- and send parents a one-click link to confirm their payment details.
-- Each imported player gets a subscription with status='pending_migration' + a unique token.

-- Extend subscriptions table
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS invite_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_source text,
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);

-- Backfill organisation_id where missing (derived from the player's org)
UPDATE public.subscriptions s
SET organisation_id = p.organisation_id
FROM public.players p
WHERE s.player_id = p.id AND s.organisation_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_invite_token
  ON public.subscriptions(invite_token)
  WHERE invite_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_org
  ON public.subscriptions(organisation_id);

-- Sanity
SELECT
  COUNT(*) FILTER (WHERE invite_token IS NOT NULL) AS pending_invites,
  COUNT(*) AS total_subscriptions
FROM public.subscriptions;
