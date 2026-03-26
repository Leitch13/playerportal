ALTER TABLE public.training_groups ADD COLUMN IF NOT EXISTS class_type text DEFAULT 'group' CHECK (class_type IN ('group', 'small_group', '1-2-1', '2-1', 'gk', 'soccer_tots', 'academy', 'accelerator', 'elite', 'camp', 'trial', 'girls', 'adults'));
ALTER TABLE public.training_groups ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE public.training_groups ADD COLUMN IF NOT EXISTS long_description text;
ALTER TABLE public.training_groups ADD COLUMN IF NOT EXISTS benefits text[];
ALTER TABLE public.training_groups ADD COLUMN IF NOT EXISTS suitable_for text;
ALTER TABLE public.training_groups ADD COLUMN IF NOT EXISTS what_to_bring text;
ALTER TABLE public.training_groups ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.training_groups ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
