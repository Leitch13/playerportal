INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can upload branding" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'branding');
CREATE POLICY "Anyone can read branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
