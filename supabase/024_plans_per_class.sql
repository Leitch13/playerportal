-- Link subscription plans to specific classes
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS training_group_id uuid REFERENCES public.training_groups(id);
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS class_type text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_plans_org ON public.subscription_plans(organisation_id);
CREATE INDEX IF NOT EXISTS idx_plans_group ON public.subscription_plans(training_group_id);
CREATE INDEX IF NOT EXISTS idx_plans_class_type ON public.subscription_plans(class_type);
