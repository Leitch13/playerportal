-- Platform billing: plans & organisation subscription columns
CREATE TABLE IF NOT EXISTS public.platform_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  monthly_price decimal(10,2) NOT NULL,
  transaction_fee_percent decimal(5,2) NOT NULL DEFAULT 0,
  features jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Insert the 3 plans (all plans share the same feature set; only price & transaction fee differ)
INSERT INTO public.platform_plans (name, slug, monthly_price, transaction_fee_percent, features, sort_order) VALUES
  ('Starter', 'starter', 20.00, 3.5, '["Unlimited players", "Unlimited classes", "Full analytics", "Priority support", "Custom branding", "Merch shop", "Session planner", "Drill library", "White-label", "QR attendance", "Parent portal", "Messaging", "Camps & events", "CSV exports", "Audit log"]', 1),
  ('Pro', 'pro', 30.00, 2.0, '["Unlimited players", "Unlimited classes", "Full analytics", "Priority support", "Custom branding", "Merch shop", "Session planner", "Drill library", "White-label", "QR attendance", "Parent portal", "Messaging", "Camps & events", "CSV exports", "Audit log"]', 2),
  ('Enterprise', 'enterprise', 50.00, 1.0, '["Unlimited players", "Unlimited classes", "Full analytics", "Priority support", "Custom branding", "Merch shop", "Session planner", "Drill library", "White-label", "QR attendance", "Parent portal", "Messaging", "Camps & events", "CSV exports", "Audit log"]', 3)
ON CONFLICT (slug) DO NOTHING;

-- Update existing rows if they were already inserted with old features
UPDATE public.platform_plans
SET features = '["Unlimited players", "Unlimited classes", "Full analytics", "Priority support", "Custom branding", "Merch shop", "Session planner", "Drill library", "White-label", "QR attendance", "Parent portal", "Messaging", "Camps & events", "CSV exports", "Audit log"]'
WHERE slug IN ('starter', 'pro', 'enterprise');

-- Add platform plan reference to organisations
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS platform_plan_id uuid REFERENCES public.platform_plans(id);
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS platform_subscription_status text DEFAULT 'trial' CHECK (platform_subscription_status IN ('trial', 'active', 'past_due', 'cancelled'));
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS platform_trial_ends_at timestamptz DEFAULT (now() + interval '14 days');
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS platform_stripe_subscription_id text;

ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read platform plans" ON public.platform_plans FOR SELECT USING (true);
