-- 064: Hybrid go-live model — academies must pick a plan + add a card before
-- their public booking page accepts bookings.
--
-- New academies default to is_published = false: they can set everything up
-- during the free trial, but their /book/[slug] page isn't publicly bookable
-- until they "go live" (subscribe to a platform plan, which sets is_published
-- = true via the Stripe webhook).
--
-- GRANDFATHER: every academy that already exists is set published = true so
-- nothing currently live (Jamie Allan, JSL, etc.) is disrupted.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organisations.is_published IS
  'Whether the academy has gone live (public booking page accepts bookings). Set true on platform subscription, or grandfathered for pre-existing academies.';

-- Grandfather everything that exists right now.
UPDATE public.organisations SET is_published = true WHERE is_published = false;

-- Pilot academies are always considered published.
-- (Handled in code too, but belt-and-braces here.)
UPDATE public.organisations SET is_published = true WHERE pilot = true;
