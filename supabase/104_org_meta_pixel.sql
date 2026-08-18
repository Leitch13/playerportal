-- 104: per-academy Meta Pixel ID ("bring your own Pixel")
-- Academies paste their Pixel ID in Settings; their public booking pages then
-- load THEIR pixel (consent-gated) and fire conversion events so their own
-- Facebook/Instagram ads can optimise on real bookings.
-- Additive, nullable, no backfill. Rollback: ALTER TABLE public.organisations DROP COLUMN meta_pixel_id;

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS meta_pixel_id text;

COMMENT ON COLUMN public.organisations.meta_pixel_id IS
  'Academy''s own Meta (Facebook) Pixel ID — loaded consent-gated on their public booking pages only.';
