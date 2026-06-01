-- 068: Lock down the branding storage bucket.
-- Previously the bucket policy allowed `anyone` (including unauthenticated
-- requests) to upload — meaning any internet visitor could overwrite any
-- academy's logo or hero image. We restrict INSERT/UPDATE/DELETE to
-- authenticated users only. Reads stay public because the bucket is used
-- for public booking pages (academy logo / hero on /book/[slug]).

-- Permissions on the storage.objects schema-level policies vary across
-- Supabase versions, so we DROP IF EXISTS first and re-create.

DROP POLICY IF EXISTS "Anyone can upload to branding" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update branding" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete branding" ON storage.objects;

CREATE POLICY "Authenticated users can upload to branding"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'branding');

CREATE POLICY "Authenticated users can update branding"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'branding')
  WITH CHECK (bucket_id = 'branding');

CREATE POLICY "Authenticated users can delete branding"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'branding');

-- Public read stays in place (created in branding_storage.sql); we don't
-- touch it because parents on the public booking page need to load the
-- academy logo and hero without being logged in.
