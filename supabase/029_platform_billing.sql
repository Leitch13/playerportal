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

-- Insert the 3 plans
INSERT INTO public.platform_plans (name, slug, monthly_price, transaction_fee_percent, features, sort_order) VALUES
  ('Starter', 'starter', 20.00, 3.5, '["Up to 50 players", "3 classes", "Basic analytics", "Email support", "Parent portal", "QR attendance"]', 1),
  ('Pro', 'pro', 30.00, 2.0, '["Up to 200 players", "Unlimited classes", "Full analytics", "Priority support", "Custom branding", "Merch shop", "Session planner", "Drill library"]', 2),
  ('Enterprise', 'enterprise', 50.00, 0.0, '["Unlimited players", "Unlimited classes", "Advanced analytics", "Dedicated support", "White-label branding", "API access", "Custom integrations", "0% transaction fees"]', 3)
ON CONFLICT (slug) DO NOTHING;

-- Add platform plan reference to organisations
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS platform_plan_id uuid REFERENCES public.platform_plans(id);
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS platform_subscription_status text DEFAULT 'trial' CHECK (platform_subscription_status IN ('trial', 'active', 'past_due', 'cancelled'));
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS platform_trial_ends_at timestamptz DEFAULT (now() + interval '14 days');
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS platform_stripe_subscription_id text;

ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read platform plans" ON public.platform_plans FOR SELECT USING (true);
