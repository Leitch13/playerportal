-- Idempotent re-run of migration 005 — creates the player-photos bucket and policies
-- in case the original migration wasn't applied. Safe to run multiple times.

INSERT INTO storage.buckets (id, name, public)
VALUES ('player-photos', 'player-photos', true)
ON CONFLICT (id) DO NOTHING;

-- INSERT
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload player photos' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can upload player photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'player-photos');
  END IF;
END $$;

-- UPDATE
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update player photos' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can update player photos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'player-photos');
  END IF;
END $$;

-- SELECT (public read so the images load on the parent dashboard)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view player photos' AND tablename = 'objects') THEN
    CREATE POLICY "Anyone can view player photos"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'player-photos');
  END IF;
END $$;

-- DELETE
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete player photos' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can delete player photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'player-photos');
  END IF;
END $$;
