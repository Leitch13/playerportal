-- 114: optional portrait hero for phones.
-- Wide banners (Rosa Sports: 1886x834, players at both edges, black middle)
-- crop to an empty centre under `background-size: cover` on a near-square
-- phone hero. Academies can upload a portrait crop; the booking page uses it
-- under the sm breakpoint and falls back to hero_image_url when unset.
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS hero_image_mobile_url text;
