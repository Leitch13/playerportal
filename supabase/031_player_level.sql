ALTER TABLE public.players ADD COLUMN IF NOT EXISTS playing_level text DEFAULT 'development' CHECK (playing_level IN ('beginner', 'development', 'intermediate', 'advanced', 'elite'));
