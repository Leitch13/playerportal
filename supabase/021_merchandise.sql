-- Merchandise/kit products
CREATE TABLE IF NOT EXISTS public.merchandise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'kit' CHECK (category IN ('kit', 'training_top', 'shorts', 'socks', 'ball', 'bag', 'bundle', 'other')),
  price numeric(10,2) NOT NULL,
  image_url text,
  sizes text[] DEFAULT '{}',
  in_stock boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Merchandise orders
CREATE TABLE IF NOT EXISTS public.merchandise_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  profile_id uuid REFERENCES public.profiles(id),
  player_id uuid REFERENCES public.players(id),
  merchandise_id uuid REFERENCES public.merchandise(id),
  size text,
  quantity integer DEFAULT 1,
  total_price numeric(10,2) NOT NULL,
  player_name_on_shirt text,
  player_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'ordered', 'shipped', 'delivered', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.merchandise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchandise_orders ENABLE ROW LEVEL SECURITY;

-- Everyone can see merchandise for their org
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users see org merchandise' AND tablename = 'merchandise') THEN
    CREATE POLICY "Users see org merchandise" ON public.merchandise
      FOR SELECT USING (organisation_id = public.get_my_org());
  END IF;
END $$;

-- Admins manage merchandise
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage merchandise' AND tablename = 'merchandise') THEN
    CREATE POLICY "Admins manage merchandise" ON public.merchandise
      FOR ALL USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
  END IF;
END $$;

-- Parents see own orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents see own orders' AND tablename = 'merchandise_orders') THEN
    CREATE POLICY "Parents see own orders" ON public.merchandise_orders
      FOR SELECT USING (profile_id = auth.uid());
  END IF;
END $$;

-- Parents can place orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents place orders' AND tablename = 'merchandise_orders') THEN
    CREATE POLICY "Parents place orders" ON public.merchandise_orders
      FOR INSERT WITH CHECK (profile_id = auth.uid());
  END IF;
END $$;

-- Admins manage all orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage orders' AND tablename = 'merchandise_orders') THEN
    CREATE POLICY "Admins manage orders" ON public.merchandise_orders
      FOR ALL USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
  END IF;
END $$;
