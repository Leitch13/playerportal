-- 128: optional banner video on the public booking page (9 Nov 2026, John's go).
-- A short clip plays muted on a loop behind the academy name. hero_image_url stays
-- the fallback: it shows first, and stays when the video can't play (data saver,
-- slow signal, reduced motion). Unset = the booking page is exactly as before.
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS hero_video_url text;
