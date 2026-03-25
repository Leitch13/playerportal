-- Create a storage bucket for player photos
-- Run this in your Supabase SQL Editor

-- 1. Create the bucket (if using SQL — alternatively create via Dashboard > Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('player-photos', 'player-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload player photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'player-photos');

-- 3. Allow authenticated users to update/replace their own photos
CREATE POLICY "Authenticated users can update player photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'player-photos');

-- 4. Allow anyone to view photos (public bucket)
CREATE POLICY "Anyone can view player photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'player-photos');

-- 5. Allow authenticated users to delete photos
CREATE POLICY "Authenticated users can delete player photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'player-photos');
