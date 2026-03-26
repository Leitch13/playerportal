ALTER TABLE public.session_plans ADD COLUMN IF NOT EXISTS diagram_url text;
ALTER TABLE public.session_plans ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE public.drills ADD COLUMN IF NOT EXISTS pdf_url text;
