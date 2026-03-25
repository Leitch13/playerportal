-- ============================================================
-- 006: Subscription Plans & Subscriptions
-- ============================================================

-- Subscription plans (admin-defined tiers)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,                    -- e.g. "1 Session / Week"
  description   text,                             -- optional longer description
  amount        numeric(10,2) NOT NULL,           -- monthly price in GBP
  interval      text NOT NULL DEFAULT 'month',    -- month | year
  sessions_per_week integer DEFAULT 1,            -- how many sessions included
  stripe_price_id  text,                          -- Stripe Price object ID (set after sync)
  stripe_product_id text,                         -- Stripe Product object ID
  active        boolean DEFAULT true,
  sort_order    integer DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Parent subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_id             uuid REFERENCES public.players(id) ON DELETE SET NULL,
  plan_id               uuid NOT NULL REFERENCES public.subscription_plans(id),
  status                text NOT NULL DEFAULT 'incomplete',
  -- status values: incomplete, active, past_due, canceled, unpaid, trialing, paused
  stripe_subscription_id text,
  stripe_customer_id     text,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean DEFAULT false,
  canceled_at            timestamptz,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_parent ON public.subscriptions(parent_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(active);

-- RLS for subscription_plans (everyone can read active plans, admins can manage)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (active = true OR public.get_my_role() IN ('admin', 'coach'));

CREATE POLICY "Admins manage plans"
  ON public.subscription_plans FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- RLS for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents see own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (parent_id = auth.uid() OR public.get_my_role() IN ('admin', 'coach'));

CREATE POLICY "System manages subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.get_my_role() = 'admin' OR parent_id = auth.uid())
  WITH CHECK (public.get_my_role() = 'admin' OR parent_id = auth.uid());
